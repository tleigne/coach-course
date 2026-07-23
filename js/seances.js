// Séances d'entraînement structurées (seuil, tempo, VMA, fractionné
// personnalisé), inspirées de ce que proposent les montres de sport.
// Une séance est une liste ordonnée de segments ; chaque segment est défini
// soit par une durée (secondes), soit par une distance (km), avec une allure
// cible (ou "libre" si null).
import { PROFIL_COUREUR } from './profil.js';

function segmentEchauffement(dureeMin = 10) {
  return {
    type: 'echauffement',
    mode: 'duree',
    valeur: dureeMin * 60,
    allureCibleSecParKm: PROFIL_COUREUR.allureConfortableSecParKm,
  };
}

function segmentRetourAuCalme(dureeMin = 5) {
  return {
    type: 'retour_au_calme',
    mode: 'duree',
    valeur: dureeMin * 60,
    allureCibleSecParKm: null,
  };
}

/** Séance continue à allure seuil (~85-90% VMA), pour un travail de fond. */
export function genererSeanceSeuil(dureeMin) {
  return {
    nom: `Seuil ${dureeMin} min`,
    segments: [
      segmentEchauffement(),
      { type: 'effort', mode: 'duree', valeur: dureeMin * 60, allureCibleSecParKm: PROFIL_COUREUR.allureSeuilSecParKm },
      segmentRetourAuCalme(),
    ],
  };
}

/** Séance continue à allure tempo (soutenue mais sous-maximale). */
export function genererSeanceTempo(dureeMin) {
  return {
    nom: `Tempo ${dureeMin} min`,
    segments: [
      segmentEchauffement(),
      { type: 'effort', mode: 'duree', valeur: dureeMin * 60, allureCibleSecParKm: PROFIL_COUREUR.allureTempoSecParKm },
      segmentRetourAuCalme(),
    ],
  };
}

/** Fractionné court à allure VMA (ex. 30/30, 200m...), défini par des durées. */
export function genererSeanceVMA(nbRepetitions, dureeEffortSec, dureeRecupSec) {
  const segments = [segmentEchauffement()];
  for (let i = 1; i <= nbRepetitions; i++) {
    segments.push({
      type: 'effort',
      mode: 'duree',
      valeur: dureeEffortSec,
      allureCibleSecParKm: PROFIL_COUREUR.allureVMASecParKm,
      numeroRepetition: i,
      totalRepetitions: nbRepetitions,
    });
    if (i < nbRepetitions) {
      segments.push({
        type: 'recuperation',
        mode: 'duree',
        valeur: dureeRecupSec,
        allureCibleSecParKm: null,
        numeroRepetition: i,
        totalRepetitions: nbRepetitions,
      });
    }
  }
  segments.push(segmentRetourAuCalme());
  return { nom: `VMA ${nbRepetitions} x ${dureeEffortSec}s / ${dureeRecupSec}s récup`, segments };
}

/** Fractionné personnalisé défini par des distances (ex. 4x800m / 400m récup). */
export function genererSeanceFractionnePersonnalise(nbRepetitions, distanceEffortM, allureCibleSecParKm, distanceRecupM) {
  const segments = [segmentEchauffement()];
  for (let i = 1; i <= nbRepetitions; i++) {
    segments.push({
      type: 'effort',
      mode: 'distance',
      valeur: distanceEffortM / 1000,
      allureCibleSecParKm: allureCibleSecParKm || PROFIL_COUREUR.allureVMASecParKm,
      numeroRepetition: i,
      totalRepetitions: nbRepetitions,
    });
    if (i < nbRepetitions) {
      segments.push({
        type: 'recuperation',
        mode: 'distance',
        valeur: distanceRecupM / 1000,
        allureCibleSecParKm: null,
        numeroRepetition: i,
        totalRepetitions: nbRepetitions,
      });
    }
  }
  segments.push(segmentRetourAuCalme());
  return { nom: `${nbRepetitions} x ${distanceEffortM} m`, segments };
}

/**
 * Suit la progression d'une séance segment par segment, à partir de la
 * distance et du temps cumulés depuis le DÉBUT DE LA COURSE (pas du segment).
 */
export class SuiviSeance {
  constructor(seance) {
    this.seance = seance;
    this.indexSegment = 0;
    this.distanceDebutSegmentKm = 0;
    this.tempsDebutSegmentSec = 0;
    this.terminee = false;
  }

  segmentActuel() {
    return this.seance.segments[this.indexSegment] || null;
  }

  /** À appeler régulièrement (chrono ou GPS) avec les valeurs cumulées
   * depuis le début de la course. Retourne { fin: true } si la séance vient
   * de se terminer, { fin: false, segment, indexSegment } si on vient de
   * passer au segment suivant, ou null si rien de nouveau. */
  mettreAJour(distanceTotaleKm, tempsEcouleSec) {
    if (this.terminee) return null;
    const segment = this.segmentActuel();
    if (!segment) {
      this.terminee = true;
      return null;
    }

    const progression =
      segment.mode === 'distance'
        ? distanceTotaleKm - this.distanceDebutSegmentKm
        : tempsEcouleSec - this.tempsDebutSegmentSec;

    if (progression < segment.valeur) return null;

    this.indexSegment++;
    this.distanceDebutSegmentKm = distanceTotaleKm;
    this.tempsDebutSegmentSec = tempsEcouleSec;

    const suivant = this.segmentActuel();
    if (!suivant) {
      this.terminee = true;
      return { fin: true };
    }
    return { fin: false, segment: suivant, indexSegment: this.indexSegment };
  }

  /** Ce qu'il reste dans le segment actuel (en km ou en secondes, selon son mode). */
  resteDansSegment(distanceTotaleKm, tempsEcouleSec) {
    const segment = this.segmentActuel();
    if (!segment) return 0;
    const progression =
      segment.mode === 'distance'
        ? distanceTotaleKm - this.distanceDebutSegmentKm
        : tempsEcouleSec - this.tempsDebutSegmentSec;
    return Math.max(0, segment.valeur - progression);
  }
}
