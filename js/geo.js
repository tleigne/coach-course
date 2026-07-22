// Suivi GPS temps réel : distance parcourue, allure lissée, filtrage du bruit.
import { distanceHaversine } from './utils.js';

const PRECISION_MAX_ACCEPTABLE_M = 30; // on ignore les points trop imprécis
const VITESSE_MAX_PLAUSIBLE_KMH = 30; // filtre les sauts GPS aberrants
const FENETRE_ALLURE_SEC = 30; // fenêtre glissante pour lisser l'allure affichée

/**
 * Encapsule navigator.geolocation.watchPosition et transforme les positions
 * brutes en distance parcourue + allure instantanée exploitables par l'appli.
 */
export class SuiviGPS {
  constructor({ onMiseAJour, onErreur }) {
    this.onMiseAJour = onMiseAJour;
    this.onErreur = onErreur;
    this.watchId = null;
    this.dernierPointAccepte = null; // {lat, lon, t}
    this.distanceTotaleKm = 0;
    this.historiqueRecent = []; // [{t, distanceCumuleeKm}] pour lisser l'allure
    this.trace = []; // [{lat, lon, ele, t}] positions acceptées, pour l'export GPX en fin de course
    this.enPause = false;
  }

  demarrer() {
    if (!('geolocation' in navigator)) {
      this.onErreur(new Error("Ce téléphone/navigateur ne propose pas la géolocalisation."));
      return;
    }
    this.watchId = navigator.geolocation.watchPosition(
      (position) => this._traiterPosition(position),
      (err) => this.onErreur(err),
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 }
    );
  }

  mettreEnPause() {
    this.enPause = true;
  }

  reprendre() {
    this.enPause = false;
    this.dernierPointAccepte = null; // évite de compter la distance pendant la pause
  }

  arreter() {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
  }

  _traiterPosition(position) {
    if (this.enPause) return;

    const { latitude, longitude, accuracy } = position.coords;
    const t = position.timestamp;

    if (accuracy && accuracy > PRECISION_MAX_ACCEPTABLE_M) {
      this.onMiseAJour(this._etat(accuracy, latitude, longitude));
      return;
    }

    if (this.dernierPointAccepte) {
      const dtSec = (t - this.dernierPointAccepte.t) / 1000;
      if (dtSec <= 0) return;

      const dKm = distanceHaversine(
        this.dernierPointAccepte.lat,
        this.dernierPointAccepte.lon,
        latitude,
        longitude
      );
      const vitesseKmh = (dKm / dtSec) * 3600;

      if (vitesseKmh > VITESSE_MAX_PLAUSIBLE_KMH) {
        // Saut GPS aberrant : on ignore ce point mais on ne le perd pas comme référence
        this.onMiseAJour(this._etat(accuracy, latitude, longitude));
        return;
      }

      this.distanceTotaleKm += dKm;
      this.historiqueRecent.push({ t, distanceCumuleeKm: this.distanceTotaleKm });
      this.historiqueRecent = this.historiqueRecent.filter(
        (p) => t - p.t <= FENETRE_ALLURE_SEC * 1000
      );
    } else {
      this.historiqueRecent.push({ t, distanceCumuleeKm: this.distanceTotaleKm });
    }

    this.dernierPointAccepte = { lat: latitude, lon: longitude, t };
    this.trace.push({ lat: latitude, lon: longitude, ele: position.coords.altitude || 0, t });
    this.onMiseAJour(this._etat(accuracy, latitude, longitude));
  }

  /** Retourne la trace des positions acceptées pendant la course (pour export GPX). */
  obtenirTrace() {
    return this.trace;
  }

  _etat(accuracy, lat, lon) {
    let allureSecParKm = null;
    if (this.historiqueRecent.length >= 2) {
      const premier = this.historiqueRecent[0];
      const dernier = this.historiqueRecent[this.historiqueRecent.length - 1];
      const dtSec = (dernier.t - premier.t) / 1000;
      const dKm = dernier.distanceCumuleeKm - premier.distanceCumuleeKm;
      if (dtSec > 3 && dKm > 0.005) {
        allureSecParKm = dtSec / dKm;
      }
    }
    return {
      distanceTotaleKm: this.distanceTotaleKm,
      allureSecParKm,
      precisionM: accuracy || null,
      lat,
      lon,
    };
  }
}
