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
    // [{d: km parcourus, t: secondes de course effective}] : sert à retrouver
    // après coup les meilleurs temps sur 400 m, 5 km, etc. On compte le temps
    // *actif* (hors pause) en cumulant les écarts entre points consécutifs :
    // après une reprise, dernierPointAccepte est remis à null, donc le trou de
    // la pause n'est jamais additionné.
    this.profil = [];
    this.tempsActifMs = 0;
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
      this.tempsActifMs += dtSec * 1000;
      this.historiqueRecent.push({ t, distanceCumuleeKm: this.distanceTotaleKm });
      this.historiqueRecent = this.historiqueRecent.filter(
        (p) => t - p.t <= FENETRE_ALLURE_SEC * 1000
      );
    } else {
      this.historiqueRecent.push({ t, distanceCumuleeKm: this.distanceTotaleKm });
    }

    this.dernierPointAccepte = { lat: latitude, lon: longitude, t };
    this.trace.push({ lat: latitude, lon: longitude, ele: position.coords.altitude || 0, t });
    this.profil.push({ d: this.distanceTotaleKm, t: this.tempsActifMs / 1000 });
    this.onMiseAJour(this._etat(accuracy, latitude, longitude));
  }

  /** Retourne la trace des positions acceptées pendant la course (pour export GPX). */
  obtenirTrace() {
    return this.trace;
  }

  /**
   * Profil distance/temps allégé, destiné à être conservé dans l'historique
   * pour recalculer les records. On échantillonne (un point tous les ~15 m ou
   * ~2 s suffit très largement, même pour un record sur 400 m) et on arrondit,
   * sinon une heure de course occuperait à elle seule ~90 Ko de localStorage.
   */
  obtenirProfil() {
    if (this.profil.length < 2) return [];

    const echantillon = [this.profil[0]];
    for (const point of this.profil) {
      const precedent = echantillon[echantillon.length - 1];
      if ((point.d - precedent.d) * 1000 >= 15 || point.t - precedent.t >= 2) {
        echantillon.push(point);
      }
    }
    const dernier = this.profil[this.profil.length - 1];
    if (echantillon[echantillon.length - 1] !== dernier) echantillon.push(dernier);

    // Filet de sécurité pour les très longues sorties : on garde un point sur N.
    const MAX_POINTS = 1200;
    const pas = Math.ceil(echantillon.length / MAX_POINTS);
    const reduit = pas > 1 ? echantillon.filter((_, i) => i % pas === 0 || i === echantillon.length - 1) : echantillon;

    return reduit.map((p) => ({ d: Number(p.d.toFixed(3)), t: Number(p.t.toFixed(1)) }));
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
