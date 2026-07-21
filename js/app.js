// Orchestration de l'appli : écrans, état de la course, décisions du coaching vocal.
import { parserGPX, chercherMonteeAVenir, denivelePositifRestant } from './gpx.js';
import { SuiviGPS } from './geo.js';
import {
  CoachVocal,
  phraseEncouragementAleatoire,
  phraseHydratation,
  phraseMontee,
  phraseDepart,
  phraseFin,
  phraseAvanceRetard,
  phraseRapportAllure,
  phraseFaisabilite,
} from './coach.js';
import { formatDistance, formatDuree, formatAllure, formatEcart, parseHMS, parseAllure } from './utils.js';
import { evaluerFaisabilite } from './profil.js';

// --- Intervalles du coaching (en millisecondes) ---
const INTERVALLE_RAPPORT_MS = 150000; // rapport d'allure / avance-retard : ~2,5 min
const INTERVALLE_HYDRATATION_MS = 20 * 60 * 1000; // rappel de boire : 20 min
const INTERVALLE_ENCOURAGEMENT_MS = 90000; // encouragement : ~1,5 min
const COOLDOWN_MONTEE_MS = 60000; // ne pas re-signaler la même montée trop vite
const DISTANCE_LOOKAHEAD_MONTEE_KM = 1;

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
    },
  },
};

const coach = new CoachVocal();
let tracker = null;
let idIntervalleChrono = null;
let idIntervalleCoaching = null;
let dernierEncouragement = null;

// --- Références DOM ---
const ecrans = {
  import: document.getElementById('ecran-import'),
  objectif: document.getElementById('ecran-objectif'),
  course: document.getElementById('ecran-course'),
  resume: document.getElementById('ecran-resume'),
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
    const texte = await fichier.text();
    const parcours = parserGPX(texte);
    etat.parcours = parcours;
    afficherResumeParcours(parcours);
  } catch (e) {
    zoneErreurImport.textContent = e.message || "Impossible de lire ce fichier GPX.";
  }
});

function afficherResumeParcours(parcours) {
  document.getElementById('parcours-nom').textContent = parcours.nom;
  document.getElementById('parcours-distance').textContent = formatDistance(parcours.distanceTotale);
  document.getElementById('parcours-denivele-plus').textContent = `+${parcours.denivelePositif} m`;
  document.getElementById('parcours-denivele-moins').textContent = `-${parcours.deniveleNegatif} m`;
  document.getElementById('profil-parcours').innerHTML = genererProfilSVG(parcours.points);
  blocResumeParcours.classList.remove('cache');
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

// ===================== ÉCRAN 2 : OBJECTIF =====================

const radiosObjectif = document.querySelectorAll('input[name="type-objectif"]');
const blocs = {
  temps: document.getElementById('bloc-temps'),
  allure: document.getElementById('bloc-allure'),
  effort: document.getElementById('bloc-effort'),
};

radiosObjectif.forEach((radio) => {
  radio.addEventListener('change', () => {
    Object.entries(blocs).forEach(([cle, el]) => el.classList.toggle('cache', cle !== radio.value));
  });
});

const zoneErreurObjectif = document.getElementById('erreur-objectif');

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
    },
  };

  document.getElementById('course-ecart-ligne').classList.toggle('cache', etat.objectif.type === 'effort');
  boutonPause.textContent = 'Pause';
  afficherEcran('course');

  tracker = new SuiviGPS({
    onMiseAJour: surMiseAJourGPS,
    onErreur: surErreurGPS,
  });
  tracker.demarrer();

  idIntervalleChrono = setInterval(() => {
    if (!etat.course.enPause) {
      etat.course.tempsEcouleSec += 1;
      renderCourse();
    }
  }, 1000);

  idIntervalleCoaching = setInterval(() => {
    if (!etat.course.enPause) tickCoaching();
  }, 20000);

  renderCourse();
}

function surMiseAJourGPS(etatGPS) {
  etat.course.distanceParcourueKm = etatGPS.distanceTotaleKm;
  etat.course.allureSecParKm = etatGPS.allureSecParKm;
  etat.course.precisionM = etatGPS.precisionM;
  renderCourse();
  verifierMonteeAVenir();
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

  const objectifChiffre = etat.objectif.type !== 'effort';

  if (objectifChiffre && maintenant - c.rapport > INTERVALLE_RAPPORT_MS) {
    const ecart = calculerEcartSec();
    let message = phraseAvanceRetard(ecart);
    const niveauFaisabilite = calculerFaisabilite(ecart);
    if (niveauFaisabilite) message += ' ' + phraseFaisabilite(niveauFaisabilite);
    coach.parler(message);
    c.rapport = maintenant;
    return;
  }
  if (!objectifChiffre && maintenant - c.rapport > INTERVALLE_RAPPORT_MS) {
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
  clearInterval(idIntervalleChrono);
  clearInterval(idIntervalleCoaching);
  if (tracker) tracker.arreter();

  const distanceFinale = etat.course.distanceParcourueKm;
  const dureeTexte = formatDuree(etat.course.tempsEcouleSec);
  const allureMoyenne = distanceFinale > 0 ? etat.course.tempsEcouleSec / distanceFinale : null;

  document.getElementById('resume-distance-finale').textContent = formatDistance(distanceFinale);
  document.getElementById('resume-temps-finale').textContent = dureeTexte;
  document.getElementById('resume-allure-moyenne').textContent = formatAllure(allureMoyenne);

  coach.parler(phraseFin(distanceFinale.toFixed(2).replace('.', ','), dureeTexte), { prioritaire: true });

  afficherEcran('resume');
}

// ===================== ÉCRAN 4 : RÉSUMÉ =====================

document.getElementById('bouton-nouvelle-course').addEventListener('click', () => {
  etat.parcours = null;
  etat.objectif = null;
  inputFichier.value = '';
  blocResumeParcours.classList.add('cache');
  afficherEcran('import');
});

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

afficherEcran('import');
