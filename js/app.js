// Orchestration de l'appli : écrans, état de la course, décisions du coaching vocal.
import { parserGPX, chercherMonteeAVenir, denivelePositifRestant, chercherVirageAVenir } from './gpx.js';
import { parserKML, extraireKMLDeKMZ } from './kml.js';
import { SuiviGPS } from './geo.js';
import {
  CoachVocal,
  phraseEncouragementAleatoire,
  phraseHydratation,
  phraseMontee,
  phraseVirage,
  phrasePointInteret,
  phraseDepart,
  phraseFin,
  phraseAvanceRetard,
  phraseRapportAllure,
  phraseFaisabilite,
  phraseSegment,
  phraseFinSeance,
  deviterGenreVoix,
} from './coach.js';
import {
  formatDistance,
  formatDuree,
  formatAllure,
  formatEcart,
  parseHMS,
  parseAllure,
  echapperHTML,
  distanceHaversine,
} from './utils.js';
import { evaluerFaisabilite } from './profil.js';
import { sauvegarderCourse, listerCourses, viderHistorique } from './historique.js';
import { genererGPXDepuisTrace, telechargerFichier } from './export.js';
import {
  genererSeanceSeuil,
  genererSeanceTempo,
  genererSeanceVMA,
  genererSeanceFractionnePersonnalise,
  SuiviSeance,
} from './seances.js';

// --- Intervalles du coaching (en millisecondes) ---
const INTERVALLE_RAPPORT_MS = 150000; // rapport d'allure / avance-retard : ~2,5 min
const INTERVALLE_HYDRATATION_MS = 20 * 60 * 1000; // rappel de boire : 20 min
const INTERVALLE_ENCOURAGEMENT_MS = 90000; // encouragement : ~1,5 min
const COOLDOWN_MONTEE_MS = 60000; // ne pas re-signaler la même montée trop vite
const DISTANCE_LOOKAHEAD_MONTEE_KM = 1;
const COOLDOWN_VIRAGE_MS = 15000; // les virages peuvent s'enchaîner plus vite que les montées
const DISTANCE_LOOKAHEAD_VIRAGE_KM = 0.15;

const etat = {
  parcours: null,
  objectif: null, // { type: 'temps' | 'allure' | 'effort', paceCibleSecParKm }
  course: {
    enCours: false,
    enPause: false,
    tempsEcouleSec: 0,
    distanceParcourueKm: 0,
    allureSecParKm: null,
    precisionM: null,
    derniereMajCoaching: {
      rapport: 0,
      hydratation: 0,
      encouragement: 0,
      derniereMonteeDistanceKm: null,
      derniereMonteeTemps: 0,
      dernierVirageDistanceKm: null,
      dernierVirageTemps: 0,
    },
  },
};

const coach = new CoachVocal();
let tracker = null;
let idIntervalleChrono = null;
let idIntervalleCoaching = null;
let dernierEncouragement = null;
let projecteurParcours = null; // projection lat/lon -> coordonnées SVG du parcours en cours
let derniereTraceEnregistree = []; // positions GPS de la dernière course terminée, pour export GPX
let verrouEcran = null; // Wake Lock actif pendant la course, pour empêcher l'écran de s'éteindre
let pointsInteretAnnonces = new Set(); // index des points d'intérêt déjà annoncés pendant la course
const SEUIL_ANNONCE_POINT_INTERET_M = 300;
let suiviSeance = null; // suivi du segment courant si l'objectif est une séance structurée

/** Empêche l'écran de s'éteindre/se verrouiller automatiquement pendant la
 * course (sans quoi le GPS et la voix peuvent être suspendus par le
 * téléphone). Si le navigateur ne supporte pas l'API, l'appli continue sans. */
async function demanderVerrouEcran() {
  if (!('wakeLock' in navigator)) return;
  try {
    verrouEcran = await navigator.wakeLock.request('screen');
    verrouEcran.addEventListener('release', () => {
      verrouEcran = null;
    });
  } catch (e) {
    // Refus ou indisponibilité ponctuelle : l'appli continue sans verrou d'écran.
  }
}

function relacherVerrouEcran() {
  if (verrouEcran) {
    verrouEcran.release();
    verrouEcran = null;
  }
}

// Le verrou est automatiquement relâché quand l'onglet passe en arrière-plan
// (ex. bascule vers une autre appli) ; on le redemande dès que l'appli
// redevient visible, si une course est toujours en cours.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && etat.course.enCours && !verrouEcran) {
    demanderVerrouEcran();
  }
});

// --- Références DOM ---
const ecrans = {
  import: document.getElementById('ecran-import'),
  objectif: document.getElementById('ecran-objectif'),
  course: document.getElementById('ecran-course'),
  resume: document.getElementById('ecran-resume'),
  historique: document.getElementById('ecran-historique'),
  reglages: document.getElementById('ecran-reglages'),
};

function afficherEcran(nom) {
  Object.entries(ecrans).forEach(([cle, el]) => {
    el.classList.toggle('actif', cle === nom);
  });
}

// ===================== ÉCRAN 1 : IMPORT GPX =====================

const inputFichier = document.getElementById('fichier-gpx');
const zoneErreurImport = document.getElementById('erreur-import');
const blocResumeParcours = document.getElementById('resume-parcours');

inputFichier.addEventListener('change', async () => {
  const fichier = inputFichier.files[0];
  if (!fichier) return;
  zoneErreurImport.textContent = '';
  blocResumeParcours.classList.add('cache');

  try {
    const nomFichier = fichier.name.toLowerCase();
    let parcours;

    if (nomFichier.endsWith('.kmz')) {
      const donnees = await fichier.arrayBuffer();
      const texteKML = await extraireKMLDeKMZ(donnees);
      parcours = parserKML(texteKML);
    } else if (nomFichier.endsWith('.kml')) {
      const texte = await fichier.text();
      parcours = parserKML(texte);
    } else {
      const texte = await fichier.text();
      parcours = parserGPX(texte);
    }

    etat.parcours = parcours;
    afficherResumeParcours(parcours);
  } catch (e) {
    zoneErreurImport.textContent = e.message || "Impossible de lire ce fichier de parcours.";
  }
});

function afficherResumeParcours(parcours) {
  document.getElementById('parcours-nom').textContent = parcours.nom;
  document.getElementById('parcours-distance').textContent = formatDistance(parcours.distanceTotale);
  document.getElementById('parcours-denivele-plus').textContent = `+${parcours.denivelePositif} m`;
  document.getElementById('parcours-denivele-moins').textContent = `-${parcours.deniveleNegatif} m`;
  document.getElementById('profil-parcours').innerHTML = genererProfilSVG(parcours.points);

  projecteurParcours = creerProjecteur(parcours.points);
  document.getElementById('trace-parcours').innerHTML = genererTraceSVG(projecteurParcours, parcours.points);

  blocResumeParcours.classList.remove('cache');
}

/**
 * Calcule une projection simple (équirectangulaire, corrigée par le cosinus
 * de la latitude) des points lat/lon du parcours vers un repère SVG, pour
 * afficher la forme du tracé sans dépendre d'un service de carte externe.
 */
function creerProjecteur(points, tailleCible = 260) {
  const lats = points.map((p) => p.lat);
  const lons = points.map((p) => p.lon);
  const latMin = Math.min(...lats);
  const latMax = Math.max(...lats);
  const lonMin = Math.min(...lons);
  const lonMax = Math.max(...lons);
  const latMoyenne = (latMin + latMax) / 2;
  const facteurLon = Math.cos((latMoyenne * Math.PI) / 180) || 1;

  const largeurBrute = (lonMax - lonMin) * facteurLon || 0.0001;
  const hauteurBrute = latMax - latMin || 0.0001;
  const echelle = tailleCible / Math.max(largeurBrute, hauteurBrute);
  const marge = tailleCible * 0.1;

  function projeter(lat, lon) {
    return {
      x: (lon - lonMin) * facteurLon * echelle + marge,
      y: (latMax - lat) * echelle + marge, // nord en haut
    };
  }

  return { projeter, taille: tailleCible + marge * 2 };
}

function genererTraceSVG(projecteur, points, idMarqueur) {
  const coords = points
    .map((p) => {
      const { x, y } = projecteur.projeter(p.lat, p.lon);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  const marqueur = idMarqueur
    ? `<circle id="${idMarqueur}" class="marqueur-position" r="5" cx="-100" cy="-100"></circle>`
    : '';

  return `<svg viewBox="0 0 ${projecteur.taille.toFixed(1)} ${projecteur.taille.toFixed(1)}">
    <polyline points="${coords}" class="trace-ligne"></polyline>
    ${marqueur}
  </svg>`;
}

function genererProfilSVG(points) {
  const largeur = 320;
  const hauteur = 90;
  const altitudes = points.map((p) => p.ele);
  const min = Math.min(...altitudes);
  const max = Math.max(...altitudes);
  const ecart = max - min || 1;
  const distanceTotale = points[points.length - 1].distanceCumulee || 1;

  const coords = points
    .map((p) => {
      const x = (p.distanceCumulee / distanceTotale) * largeur;
      const y = hauteur - ((p.ele - min) / ecart) * (hauteur - 10) - 5;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  const zoneRemplie = `0,${hauteur} ${coords} ${largeur},${hauteur}`;

  return `<svg viewBox="0 0 ${largeur} ${hauteur}" preserveAspectRatio="none">
    <polygon points="${zoneRemplie}" class="profil-remplissage"></polygon>
    <polyline points="${coords}" class="profil-ligne"></polyline>
  </svg>`;
}

document.getElementById('bouton-continuer-objectif').addEventListener('click', () => {
  if (!etat.parcours) return;
  afficherEcran('objectif');
});

document.getElementById('bouton-voir-historique').addEventListener('click', () => {
  afficherHistorique();
  afficherEcran('historique');
});

document.getElementById('bouton-voir-reglages').addEventListener('click', () => {
  afficherReglages();
  afficherEcran('reglages');
});

// ===================== ÉCRAN 2 : OBJECTIF =====================

document.getElementById('bouton-retour-import').addEventListener('click', () => {
  afficherEcran('import');
});

const radiosObjectif = document.querySelectorAll('input[name="type-objectif"]');
const blocs = {
  temps: document.getElementById('bloc-temps'),
  allure: document.getElementById('bloc-allure'),
  effort: document.getElementById('bloc-effort'),
  seance: document.getElementById('bloc-seance'),
};

radiosObjectif.forEach((radio) => {
  radio.addEventListener('change', () => {
    Object.entries(blocs).forEach(([cle, el]) => el.classList.toggle('cache', cle !== radio.value));
  });
});

const sousBlocsSeance = {
  seuil: document.getElementById('sous-bloc-seuil'),
  tempo: document.getElementById('sous-bloc-tempo'),
  vma: document.getElementById('sous-bloc-vma'),
  fractionne: document.getElementById('sous-bloc-fractionne'),
};

document.querySelectorAll('input[name="type-seance"]').forEach((radio) => {
  radio.addEventListener('change', () => {
    Object.entries(sousBlocsSeance).forEach(([cle, el]) => el.classList.toggle('cache', cle !== radio.value));
  });
});

const zoneErreurObjectif = document.getElementById('erreur-objectif');

// Mémorise la dernière configuration de séance utilisée, pour éviter de tout
// ressaisir à chaque course (ex. si Thibault refait le même 4x800m chaque semaine).
const CLE_PREFS_SEANCE = 'coach-course-prefs-seance';
const CHAMPS_PREFS_SEANCE = [
  'seuil-duree-min',
  'tempo-duree-min',
  'vma-repetitions',
  'vma-effort-sec',
  'vma-recup-sec',
  'fractionne-repetitions',
  'fractionne-distance-m',
  'fractionne-allure',
  'fractionne-recup-m',
];

function sauvegarderPrefsSeance() {
  try {
    const prefs = { typeSeance: document.querySelector('input[name="type-seance"]:checked').value };
    for (const id of CHAMPS_PREFS_SEANCE) prefs[id] = document.getElementById(id).value;
    localStorage.setItem(CLE_PREFS_SEANCE, JSON.stringify(prefs));
  } catch (e) {
    // Stockage indisponible : la prochaine séance repartira sur les valeurs par défaut.
  }
}

function restaurerPrefsSeance() {
  let prefs;
  try {
    const brut = localStorage.getItem(CLE_PREFS_SEANCE);
    if (!brut) return;
    prefs = JSON.parse(brut);
  } catch (e) {
    return;
  }

  if (prefs.typeSeance) {
    const radio = document.querySelector(`input[name="type-seance"][value="${prefs.typeSeance}"]`);
    if (radio) {
      radio.checked = true;
      radio.dispatchEvent(new Event('change'));
    }
  }
  for (const id of CHAMPS_PREFS_SEANCE) {
    if (prefs[id]) document.getElementById(id).value = prefs[id];
  }
}

/** Construit la séance choisie à partir du sous-formulaire. Retourne
 * { seance } ou { erreur } (message destiné à l'utilisateur). */
function construireSeanceDepuisFormulaire() {
  const typeSeance = document.querySelector('input[name="type-seance"]:checked').value;

  if (typeSeance === 'seuil') {
    const dureeMin = parseInt(document.getElementById('seuil-duree-min').value, 10);
    if (!dureeMin || dureeMin <= 0) return { erreur: "Indique une durée d'effort valide." };
    return { seance: genererSeanceSeuil(dureeMin) };
  }

  if (typeSeance === 'tempo') {
    const dureeMin = parseInt(document.getElementById('tempo-duree-min').value, 10);
    if (!dureeMin || dureeMin <= 0) return { erreur: "Indique une durée d'effort valide." };
    return { seance: genererSeanceTempo(dureeMin) };
  }

  if (typeSeance === 'vma') {
    const repetitions = parseInt(document.getElementById('vma-repetitions').value, 10);
    const dureeEffortSec = parseInt(document.getElementById('vma-effort-sec').value, 10);
    const dureeRecupSec = parseInt(document.getElementById('vma-recup-sec').value, 10);
    if (!repetitions || repetitions <= 0 || !dureeEffortSec || dureeEffortSec <= 0 || !dureeRecupSec || dureeRecupSec <= 0) {
      return { erreur: 'Indique un nombre de répétitions et des durées valides.' };
    }
    return { seance: genererSeanceVMA(repetitions, dureeEffortSec, dureeRecupSec) };
  }

  // typeSeance === 'fractionne'
  const repetitions = parseInt(document.getElementById('fractionne-repetitions').value, 10);
  const distanceEffortM = parseInt(document.getElementById('fractionne-distance-m').value, 10);
  const distanceRecupM = parseInt(document.getElementById('fractionne-recup-m').value, 10);
  const allureTexte = document.getElementById('fractionne-allure').value;
  const allureCibleSecParKm = allureTexte ? parseAllure(allureTexte) : null;

  if (!repetitions || repetitions <= 0 || !distanceEffortM || distanceEffortM <= 0 || !distanceRecupM || distanceRecupM <= 0) {
    return { erreur: 'Indique un nombre de répétitions et des distances valides.' };
  }
  if (allureTexte && !allureCibleSecParKm) {
    return { erreur: "L'allure cible n'est pas valide (ex : 4:30)." };
  }
  return { seance: genererSeanceFractionnePersonnalise(repetitions, distanceEffortM, allureCibleSecParKm, distanceRecupM) };
}

document.getElementById('bouton-demarrer-course').addEventListener('click', () => {
  const typeChoisi = document.querySelector('input[name="type-objectif"]:checked').value;
  zoneErreurObjectif.textContent = '';

  let objectif = { type: typeChoisi, paceCibleSecParKm: null };

  if (typeChoisi === 'temps') {
    const sec = parseHMS(document.getElementById('valeur-temps-cible').value);
    if (!sec || sec <= 0 || !etat.parcours || etat.parcours.distanceTotale <= 0) {
      zoneErreurObjectif.textContent = 'Indique un temps cible valide (ex : 1:45:00).';
      return;
    }
    objectif.paceCibleSecParKm = sec / etat.parcours.distanceTotale;
  } else if (typeChoisi === 'allure') {
    const secParKm = parseAllure(document.getElementById('valeur-allure-cible').value);
    if (!secParKm || secParKm <= 0) {
      zoneErreurObjectif.textContent = "Indique une allure cible valide (ex : 5:30).";
      return;
    }
    objectif.paceCibleSecParKm = secParKm;
  } else if (typeChoisi === 'seance') {
    const resultat = construireSeanceDepuisFormulaire();
    if (resultat.erreur) {
      zoneErreurObjectif.textContent = resultat.erreur;
      return;
    }
    objectif.seance = resultat.seance;
    sauvegarderPrefsSeance();
  }

  etat.objectif = objectif;

  // Déverrouille la synthèse vocale pendant le geste utilisateur (politique autoplay).
  coach.parler(phraseDepart(), { prioritaire: true });

  demarrerCourse();
});

// ===================== ÉCRAN 3 : COURSE =====================

const elCourseDistance = document.getElementById('course-distance');
const elCourseAllure = document.getElementById('course-allure');
const elCourseTemps = document.getElementById('course-temps');
const elCourseEcart = document.getElementById('course-ecart');
const elCourseGpsEtat = document.getElementById('course-gps-etat');
const boutonPause = document.getElementById('bouton-pause');

function demarrerCourse() {
  if (etat.course.enCours) return; // évite un double-démarrage (double-clic / double-tap)
  pointsInteretAnnonces = new Set();
  etat.course = {
    enCours: true,
    enPause: false,
    tempsEcouleSec: 0,
    distanceParcourueKm: 0,
    allureSecParKm: null,
    precisionM: null,
    derniereMajCoaching: {
      rapport: Date.now(),
      hydratation: Date.now(),
      encouragement: Date.now(),
      derniereMonteeDistanceKm: null,
      derniereMonteeTemps: 0,
      dernierVirageDistanceKm: null,
      dernierVirageTemps: 0,
    },
  };

  const enSeance = etat.objectif.type === 'seance';
  document.getElementById('course-ecart-ligne').classList.toggle('cache', etat.objectif.type === 'effort' || enSeance);
  document.getElementById('segment-seance').classList.toggle('cache', !enSeance);
  boutonPause.textContent = 'Pause';
  afficherEcran('course');

  if (projecteurParcours) {
    document.getElementById('trace-course').innerHTML = genererTraceSVG(
      projecteurParcours,
      etat.parcours.points,
      'marqueur-position-course'
    );
  }

  if (enSeance) {
    suiviSeance = new SuiviSeance(etat.objectif.seance);
    renderSegmentSeance();
    coach.parler(phraseSegment(suiviSeance.segmentActuel()));
  } else {
    suiviSeance = null;
  }

  tracker = new SuiviGPS({
    onMiseAJour: surMiseAJourGPS,
    onErreur: surErreurGPS,
  });
  tracker.demarrer();
  demanderVerrouEcran();

  idIntervalleChrono = setInterval(() => {
    if (!etat.course.enPause) {
      etat.course.tempsEcouleSec += 1;
      renderCourse();
      if (suiviSeance) avancerSeance();
    }
  }, 1000);

  idIntervalleCoaching = setInterval(() => {
    if (!etat.course.enPause) tickCoaching();
  }, 20000);

  renderCourse();
}

/** Vérifie si la séance passe au segment suivant, et gère l'annonce +
 * l'affichage si c'est le cas. Appelé à chaque tick du chrono. */
function avancerSeance() {
  const transition = suiviSeance.mettreAJour(etat.course.distanceParcourueKm, etat.course.tempsEcouleSec);
  if (!transition) {
    renderSegmentSeance();
    return;
  }
  if (transition.fin) {
    coach.parler(phraseFinSeance());
    document.getElementById('segment-seance').classList.add('cache');
    return;
  }
  coach.parler(phraseSegment(transition.segment), { prioritaire: true });
  renderSegmentSeance();
}

const TEXTE_TYPE_SEGMENT = {
  echauffement: 'Échauffement',
  effort: 'Effort',
  recuperation: 'Récupération',
  retour_au_calme: 'Retour au calme',
};

function renderSegmentSeance() {
  if (!suiviSeance) return;
  const segment = suiviSeance.segmentActuel();
  if (!segment) return;

  document.getElementById('segment-seance-type').textContent = TEXTE_TYPE_SEGMENT[segment.type] || segment.type;

  document.getElementById('segment-seance-repetition').textContent = segment.numeroRepetition
    ? `Répétition ${segment.numeroRepetition} / ${segment.totalRepetitions}`
    : '';

  document.getElementById('segment-seance-allure').textContent = segment.allureCibleSecParKm
    ? `Allure cible : ${formatAllure(segment.allureCibleSecParKm)}`
    : 'Allure libre';

  const reste = suiviSeance.resteDansSegment(etat.course.distanceParcourueKm, etat.course.tempsEcouleSec);
  document.getElementById('segment-seance-reste').textContent =
    segment.mode === 'distance'
      ? `Reste : ${formatDistance(reste)}`
      : `Reste : ${formatDuree(reste)}`;
}

function surMiseAJourGPS(etatGPS) {
  etat.course.distanceParcourueKm = etatGPS.distanceTotaleKm;
  etat.course.allureSecParKm = etatGPS.allureSecParKm;
  etat.course.precisionM = etatGPS.precisionM;
  renderCourse();
  verifierMonteeAVenir();
  verifierVirageAVenir();

  if (projecteurParcours && etatGPS.lat != null && etatGPS.lon != null) {
    const marqueur = document.getElementById('marqueur-position-course');
    if (marqueur) {
      const { x, y } = projecteurParcours.projeter(etatGPS.lat, etatGPS.lon);
      marqueur.setAttribute('cx', x.toFixed(1));
      marqueur.setAttribute('cy', y.toFixed(1));
    }
  }

  if (etatGPS.lat != null && etatGPS.lon != null) {
    verifierPointsInteret(etatGPS.lat, etatGPS.lon);
  }
}

function verifierPointsInteret(latActuelle, lonActuelle) {
  if (!etat.parcours || !etat.parcours.pointsInteret) return;
  etat.parcours.pointsInteret.forEach((point, index) => {
    if (pointsInteretAnnonces.has(index)) return;
    const distanceM = distanceHaversine(latActuelle, lonActuelle, point.lat, point.lon) * 1000;
    if (distanceM <= SEUIL_ANNONCE_POINT_INTERET_M) {
      coach.parler(phrasePointInteret(point.nom, distanceM));
      pointsInteretAnnonces.add(index);
    }
  });
}

function surErreurGPS(err) {
  elCourseGpsEtat.textContent = "GPS indisponible — vérifie l'autorisation de localisation.";
  coach.parler("Attention, je n'arrive pas à accéder à ta position.", { prioritaire: true });
}

function calculerEcartSec() {
  if (!etat.objectif || etat.objectif.type === 'effort' || !etat.objectif.paceCibleSecParKm) return null;
  const tempsPrevu = etat.course.distanceParcourueKm * etat.objectif.paceCibleSecParKm;
  return tempsPrevu - etat.course.tempsEcouleSec;
}

/** N'a de sens qu'en cas de retard réel : est-ce rattrapable vu la suite du
 * parcours (dénivelé restant) et le profil de performance du coureur ? */
function calculerFaisabilite(ecartSec) {
  if (ecartSec === null || ecartSec >= -20 || !etat.parcours || !etat.objectif.paceCibleSecParKm) return null;
  const distanceRestanteKm = etat.parcours.distanceTotale - etat.course.distanceParcourueKm;
  if (distanceRestanteKm <= 0.05) return null;

  const tempsCibleTotalSec = etat.objectif.paceCibleSecParKm * etat.parcours.distanceTotale;
  const tempsRestantObjectifSec = tempsCibleTotalSec - etat.course.tempsEcouleSec;
  const allureNecessaireSecParKm = tempsRestantObjectifSec / distanceRestanteKm;
  const deniveleRestantM = denivelePositifRestant(etat.parcours, etat.course.distanceParcourueKm);

  return evaluerFaisabilite(allureNecessaireSecParKm, deniveleRestantM, distanceRestanteKm);
}

function renderCourse() {
  elCourseDistance.textContent = formatDistance(etat.course.distanceParcourueKm);
  elCourseAllure.textContent = formatAllure(etat.course.allureSecParKm);
  elCourseTemps.textContent = formatDuree(etat.course.tempsEcouleSec);

  if (etat.objectif && etat.objectif.type !== 'effort') {
    const ecart = calculerEcartSec();
    elCourseEcart.textContent = formatEcart(ecart);
    elCourseEcart.classList.toggle('negatif', ecart < 0);
  }

  if (etat.course.precisionM !== null) {
    elCourseGpsEtat.textContent =
      etat.course.precisionM <= 15
        ? 'GPS : bonne précision'
        : `GPS : précision moyenne (±${Math.round(etat.course.precisionM)} m)`;
  } else {
    elCourseGpsEtat.textContent = 'GPS : recherche du signal...';
  }
}

function tickCoaching() {
  const maintenant = Date.now();
  const c = etat.course.derniereMajCoaching;

  // Pendant une séance structurée, le coaching de segment (voir avancerSeance)
  // remplace déjà le rapport d'allure générique : pas besoin de le répéter ici.
  const enSeance = etat.objectif.type === 'seance';
  const objectifChiffre = !enSeance && etat.objectif.type !== 'effort';

  if (!enSeance && objectifChiffre && maintenant - c.rapport > INTERVALLE_RAPPORT_MS) {
    const ecart = calculerEcartSec();
    let message = phraseAvanceRetard(ecart);
    const niveauFaisabilite = calculerFaisabilite(ecart);
    if (niveauFaisabilite) message += ' ' + phraseFaisabilite(niveauFaisabilite);
    coach.parler(message);
    c.rapport = maintenant;
    return;
  }
  if (!enSeance && !objectifChiffre && maintenant - c.rapport > INTERVALLE_RAPPORT_MS) {
    coach.parler(phraseRapportAllure(formatAllure(etat.course.allureSecParKm)));
    c.rapport = maintenant;
    return;
  }
  if (maintenant - c.hydratation > INTERVALLE_HYDRATATION_MS) {
    coach.parler(phraseHydratation());
    c.hydratation = maintenant;
    return;
  }
  if (maintenant - c.encouragement > INTERVALLE_ENCOURAGEMENT_MS) {
    const phrase = phraseEncouragementAleatoire(dernierEncouragement);
    dernierEncouragement = phrase;
    coach.parler(phrase);
    c.encouragement = maintenant;
  }
}

function verifierMonteeAVenir() {
  if (!etat.parcours) return;
  const c = etat.course.derniereMajCoaching;
  const maintenant = Date.now();
  if (maintenant - c.derniereMonteeTemps < COOLDOWN_MONTEE_MS) return;

  const montee = chercherMonteeAVenir(
    etat.parcours,
    etat.course.distanceParcourueKm,
    DISTANCE_LOOKAHEAD_MONTEE_KM
  );
  if (!montee) return;

  const positionAbsolueKm = etat.course.distanceParcourueKm + montee.distanceAvantKm;
  if (
    c.derniereMonteeDistanceKm !== null &&
    Math.abs(positionAbsolueKm - c.derniereMonteeDistanceKm) < 0.3
  ) {
    return;
  }

  coach.parler(phraseMontee(montee.distanceAvantKm * 1000));
  c.derniereMonteeDistanceKm = positionAbsolueKm;
  c.derniereMonteeTemps = maintenant;
}

function verifierVirageAVenir() {
  if (!etat.parcours) return;
  const c = etat.course.derniereMajCoaching;
  const maintenant = Date.now();
  if (maintenant - c.dernierVirageTemps < COOLDOWN_VIRAGE_MS) return;

  const virage = chercherVirageAVenir(
    etat.parcours,
    etat.course.distanceParcourueKm,
    DISTANCE_LOOKAHEAD_VIRAGE_KM
  );
  if (!virage) return;

  const positionAbsolueKm = etat.course.distanceParcourueKm + virage.distanceAvantKm;
  if (
    c.dernierVirageDistanceKm !== null &&
    Math.abs(positionAbsolueKm - c.dernierVirageDistanceKm) < 0.05
  ) {
    return;
  }

  coach.parler(phraseVirage(virage.distanceAvantKm * 1000, virage.angle));
  c.dernierVirageDistanceKm = positionAbsolueKm;
  c.dernierVirageTemps = maintenant;
}

boutonPause.addEventListener('click', () => {
  etat.course.enPause = !etat.course.enPause;
  if (etat.course.enPause) {
    tracker.mettreEnPause();
    boutonPause.textContent = 'Reprendre';
    coach.parler('Course en pause.');
  } else {
    tracker.reprendre();
    boutonPause.textContent = 'Pause';
    coach.parler('Reprise de la course.');
  }
});

document.getElementById('bouton-terminer').addEventListener('click', () => {
  terminerCourse();
});

function terminerCourse() {
  if (!etat.course.enCours) return; // évite une double-terminaison (double-clic / double-tap)
  etat.course.enCours = false;
  clearInterval(idIntervalleChrono);
  clearInterval(idIntervalleCoaching);
  derniereTraceEnregistree = tracker ? tracker.obtenirTrace() : [];
  if (tracker) tracker.arreter();
  relacherVerrouEcran();
  suiviSeance = null;

  const distanceFinale = etat.course.distanceParcourueKm;
  const dureeTexte = formatDuree(etat.course.tempsEcouleSec);
  const allureMoyenne = distanceFinale > 0 ? etat.course.tempsEcouleSec / distanceFinale : null;

  document.getElementById('resume-distance-finale').textContent = formatDistance(distanceFinale);
  document.getElementById('resume-temps-finale').textContent = dureeTexte;
  document.getElementById('resume-allure-moyenne').textContent = formatAllure(allureMoyenne);

  const boutonTelecharger = document.getElementById('bouton-telecharger-gpx');
  boutonTelecharger.disabled = derniereTraceEnregistree.length < 2;

  coach.parler(phraseFin(distanceFinale.toFixed(2).replace('.', ','), etat.course.tempsEcouleSec), { prioritaire: true });

  const nomBase = etat.parcours ? etat.parcours.nom : 'Parcours';
  const nomAvecSeance = etat.objectif && etat.objectif.type === 'seance' ? `${nomBase} (${etat.objectif.seance.nom})` : nomBase;

  sauvegarderCourse({
    nomParcours: nomAvecSeance,
    distanceKm: distanceFinale,
    dureeSec: etat.course.tempsEcouleSec,
    allureMoyenneSecParKm: allureMoyenne,
  });

  afficherEcran('resume');
}

document.getElementById('bouton-telecharger-gpx').addEventListener('click', () => {
  if (derniereTraceEnregistree.length < 2) return;
  const nomCourse = `${etat.parcours ? etat.parcours.nom : 'Course'} - ${new Date().toLocaleDateString('fr-FR')}`;
  const contenuGPX = genererGPXDepuisTrace(derniereTraceEnregistree, nomCourse);
  telechargerFichier(`course-${Date.now()}.gpx`, contenuGPX);
});

// ===================== ÉCRAN 4 : RÉSUMÉ =====================

document.getElementById('bouton-nouvelle-course').addEventListener('click', () => {
  etat.parcours = null;
  etat.objectif = null;
  inputFichier.value = '';
  blocResumeParcours.classList.add('cache');
  afficherEcran('import');
});

// ===================== ÉCRAN 5 : HISTORIQUE =====================

document.getElementById('bouton-retour-historique').addEventListener('click', () => {
  afficherEcran('import');
});

document.getElementById('bouton-vider-historique').addEventListener('click', () => {
  if (!confirm('Supprimer définitivement tout ton historique de courses ?')) return;
  viderHistorique();
  afficherHistorique();
});

function afficherHistorique() {
  const conteneur = document.getElementById('liste-historique');
  const courses = listerCourses();

  if (courses.length === 0) {
    conteneur.innerHTML = '<p class="historique-vide">Aucune course enregistrée pour l\'instant.</p>';
    return;
  }

  conteneur.innerHTML = courses
    .map((c) => {
      const date = new Date(c.date);
      const dateTexte = date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
      const heureTexte = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      return `
        <div class="course-historique">
          <div class="course-historique-details">
            <h3>${echapperHTML(c.nomParcours)}</h3>
            <p>${dateTexte} à ${heureTexte}</p>
          </div>
          <div class="course-historique-stats">
            <span class="valeur">${formatDistance(c.distanceKm)}</span><br>
            <span class="etiquette">${formatDuree(c.dureeSec)} · ${formatAllure(c.allureMoyenneSecParKm)}</span>
          </div>
        </div>
      `;
    })
    .join('');
}

// ===================== ÉCRAN 6 : RÉGLAGES =====================

const CLE_THEME = 'coach-course-theme'; // 'sombre' | 'clair' | 'systeme'

function appliquerTheme(theme) {
  if (theme === 'systeme') {
    document.documentElement.removeAttribute('data-theme');
  } else {
    document.documentElement.setAttribute('data-theme', theme);
  }

  const estSombre =
    theme === 'sombre' ||
    (theme === 'systeme' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const metaThemeColor = document.querySelector('meta[name="theme-color"]');
  if (metaThemeColor) metaThemeColor.setAttribute('content', estSombre ? '#0d1117' : '#f5f6f8');

  try {
    localStorage.setItem(CLE_THEME, theme);
  } catch (e) {
    // Stockage indisponible : le thème reste actif pour cette session seulement.
  }
}

function themePrefereActuel() {
  try {
    return localStorage.getItem(CLE_THEME) || 'sombre';
  } catch (e) {
    return 'sombre';
  }
}

document.querySelectorAll('#choix-theme .bouton-choix').forEach((bouton) => {
  bouton.addEventListener('click', () => {
    appliquerTheme(bouton.dataset.themeValeur);
    afficherEtatTheme();
  });
});

function afficherEtatTheme() {
  const themeActuel = themePrefereActuel();
  document.querySelectorAll('#choix-theme .bouton-choix').forEach((bouton) => {
    bouton.classList.toggle('selectionne', bouton.dataset.themeValeur === themeActuel);
  });
}

document.getElementById('bouton-retour-reglages').addEventListener('click', () => {
  afficherEcran('import');
});

function afficherReglages() {
  afficherEtatTheme();
  afficherListeVoix();
}

function afficherListeVoix() {
  const conteneur = document.getElementById('liste-voix');
  const voix = coach.listerVoixDisponibles();

  if (voix.length === 0) {
    conteneur.innerHTML = '<p class="info">Aucune voix française détectée pour l\'instant. Réessaie dans quelques secondes.</p>';
    return;
  }

  const voixActuelle = coach.voixActuelle();

  conteneur.innerHTML = voix
    .map((v) => {
      const genre = deviterGenreVoix(v.name);
      const etiquetteGenre = genre === 'feminine' ? ' (voix féminine)' : genre === 'masculine' ? ' (voix masculine)' : '';
      const estActive = voixActuelle && voixActuelle.name === v.name;
      return `
        <div class="voix-item${estActive ? ' selectionne' : ''}">
          <span class="voix-item-nom">${echapperHTML(v.name)}${etiquetteGenre}</span>
          <div class="voix-item-boutons">
            <button data-action="tester" data-voix="${echapperHTML(v.name)}">Tester</button>
            <button data-action="choisir" data-voix="${echapperHTML(v.name)}">${estActive ? 'Choisie' : 'Choisir'}</button>
          </div>
        </div>
      `;
    })
    .join('');

  conteneur.querySelectorAll('button[data-action="tester"]').forEach((bouton) => {
    bouton.addEventListener('click', () => coach.previsualiserVoix(bouton.dataset.voix));
  });
  conteneur.querySelectorAll('button[data-action="choisir"]').forEach((bouton) => {
    bouton.addEventListener('click', () => {
      coach.definirVoixPreferee(bouton.dataset.voix);
      afficherListeVoix();
    });
  });
}

// ===================== SERVICE WORKER =====================

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      // L'appli fonctionne même si le service worker échoue à s'enregistrer.
    });
  });
}

// ===================== INSTALLATION SUR L'ÉCRAN D'ACCUEIL =====================
// Affiche toujours un moyen visible d'installer l'appli : soit le bouton natif
// (si le navigateur propose l'événement beforeinstallprompt), soit, à défaut,
// des instructions manuelles claires. On n'attend pas silencieusement un
// événement qui peut ne jamais arriver (heuristiques d'engagement variables
// selon les versions de Chrome).

let evenementInstallDiffere = null;
const bandeauInstallation = document.getElementById('bandeau-installation');
const texteInstallation = document.getElementById('texte-installation');
const boutonInstaller = document.getElementById('bouton-installer');
const boutonInstallerPlusTard = document.getElementById('bouton-installer-plus-tard');

const TEXTE_INSTALLATION_DEFAUT = "Installe l'appli sur ton écran d'accueil pour un accès plus rapide, comme une vraie application.";
const TEXTE_INSTALLATION_MANUELLE =
  "Appuie sur le menu ⋮ en haut à droite de Chrome, puis sur « Installer l'application » (ou « Ajouter à l'écran d'accueil »).";
const TEXTE_INSTALLATION_FIREFOX =
  "Firefox ne permet pas d'installer complètement cette appli (elle continuerait à s'ouvrir comme une page web classique). Ouvre ce lien dans Chrome pour une vraie installation.";

function estFirefox() {
  return /firefox/i.test(navigator.userAgent);
}

function appliDejaInstallee() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

if (!appliDejaInstallee()) {
  if (estFirefox()) {
    // Firefox Android ne déclenche jamais beforeinstallprompt et ne propose pas
    // de vrai mode autonome : inutile d'attendre, on informe tout de suite.
    texteInstallation.textContent = TEXTE_INSTALLATION_FIREFOX;
    boutonInstaller.classList.add('cache');
    bandeauInstallation.classList.remove('cache');
  } else {
    // Laisse une chance à beforeinstallprompt d'arriver avant d'afficher le bandeau,
    // pour privilégier le bouton natif quand il est disponible.
    setTimeout(() => {
      if (!appliDejaInstallee()) bandeauInstallation.classList.remove('cache');
    }, 1200);
  }
}

appliquerTheme(themePrefereActuel());
restaurerPrefsSeance();

window.addEventListener('beforeinstallprompt', (evenement) => {
  evenement.preventDefault();
  evenementInstallDiffere = evenement;
  if (!appliDejaInstallee()) {
    bandeauInstallation.classList.remove('cache');
  }
});

boutonInstaller.addEventListener('click', async () => {
  if (evenementInstallDiffere) {
    bandeauInstallation.classList.add('cache');
    evenementInstallDiffere.prompt();
    await evenementInstallDiffere.userChoice;
    evenementInstallDiffere = null;
  } else {
    // Le navigateur n'a pas proposé d'installation automatique : on montre la marche à suivre.
    texteInstallation.textContent = TEXTE_INSTALLATION_MANUELLE;
    boutonInstaller.classList.add('cache');
  }
});

boutonInstallerPlusTard.addEventListener('click', () => {
  bandeauInstallation.classList.add('cache');
  texteInstallation.textContent = TEXTE_INSTALLATION_DEFAUT;
  boutonInstaller.classList.remove('cache');
});

window.addEventListener('appinstalled', () => {
  bandeauInstallation.classList.add('cache');
  evenementInstallDiffere = null;
});

// Gère les raccourcis d'application (appui long sur l'icône) définis dans manifest.json.
const actionDemandee = new URLSearchParams(window.location.search).get('action');
if (actionDemandee === 'historique') {
  afficherHistorique();
  afficherEcran('historique');
} else {
  afficherEcran('import');
}
