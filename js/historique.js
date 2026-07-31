// Historique des courses terminées, conservé en local (pas de backend).
const CLE_STOCKAGE = 'coach-course-historique';
const MAX_COURSES_CONSERVEES = 50;

/** Ajoute une course terminée en tête de l'historique (la plus récente en premier). */
export function sauvegarderCourse(resume) {
  const historique = listerCourses();
  historique.unshift({ ...resume, date: new Date().toISOString() });
  const courses = historique.slice(0, MAX_COURSES_CONSERVEES);

  if (ecrire(courses)) return;

  // Le profil distance/temps (utile aux records) est de loin la partie la plus
  // volumineuse. Si le stockage sature, on préfère perdre les profils des
  // courses les plus anciennes plutôt que la course qui vient d'être courue :
  // on les retire une par une, de la plus ancienne à la plus récente.
  for (let i = courses.length - 1; i > 0; i--) {
    if (!courses[i].profil) continue;
    courses[i] = { ...courses[i], profil: null };
    if (ecrire(courses)) return;
  }

  // En dernier recours, on enregistre au moins le résumé de la course actuelle.
  ecrire(courses.map((c) => ({ ...c, profil: null })));
}

function ecrire(courses) {
  try {
    localStorage.setItem(CLE_STOCKAGE, JSON.stringify(courses));
    return true;
  } catch (e) {
    // Stockage plein ou indisponible (navigation privée, etc.).
    return false;
  }
}

/** Retourne les courses enregistrées, la plus récente en premier. */
export function listerCourses() {
  try {
    const brut = localStorage.getItem(CLE_STOCKAGE);
    return brut ? JSON.parse(brut) : [];
  } catch (e) {
    return [];
  }
}

/** Supprime une seule course, repérée par sa position dans la liste
 * retournée par listerCourses(). */
export function supprimerCourse(index) {
  const historique = listerCourses();
  if (index < 0 || index >= historique.length) return;
  historique.splice(index, 1);
  try {
    localStorage.setItem(CLE_STOCKAGE, JSON.stringify(historique));
  } catch (e) {
    // Stockage indisponible : la suppression ne sera pas conservée.
  }
}

/** Totaux affichés en tête de l'historique. Les courses sans distance
 * exploitable (ex. GPS jamais capté) comptent quand même comme une course. */
export function totauxHistorique() {
  const courses = listerCourses();
  return {
    nombre: courses.length,
    distanceKm: courses.reduce((somme, c) => somme + (c.distanceKm || 0), 0),
    dureeSec: courses.reduce((somme, c) => somme + (c.dureeSec || 0), 0),
  };
}

export const PERIODES = {
  semaine: { nom: '7 jours', jours: 7 },
  mois: { nom: '1 mois', jours: 30 },
  trimestre: { nom: '3 mois', jours: 90 },
};

/** Courses des `jours` derniers jours, de la plus ancienne à la plus récente
 * (sens naturel de lecture d'un graphique de progression). */
export function coursesSurPeriode(jours) {
  const debut = Date.now() - jours * 24 * 60 * 60 * 1000;
  return listerCourses()
    .filter((c) => new Date(c.date).getTime() >= debut)
    .reverse();
}

/** Remplace tout l'historique (utilisé par la restauration d'une sauvegarde,
 * qui a déjà fusionné et dédoublonné de son côté). */
export function remplacerCourses(courses) {
  return ecrire(courses.slice(0, MAX_COURSES_CONSERVEES));
}

export function viderHistorique() {
  try {
    localStorage.removeItem(CLE_STOCKAGE);
  } catch (e) {
    // ignore
  }
}

// ===================== OBJECTIF HEBDOMADAIRE =====================

const CLE_OBJECTIF_HEBDO = 'coach-course-objectif-hebdo';

export function lireObjectifHebdo() {
  try {
    const brut = localStorage.getItem(CLE_OBJECTIF_HEBDO);
    const valeur = brut ? Number(brut) : 0;
    return Number.isFinite(valeur) && valeur > 0 ? valeur : 0;
  } catch (e) {
    return 0;
  }
}

export function ecrireObjectifHebdo(km) {
  try {
    if (km > 0) localStorage.setItem(CLE_OBJECTIF_HEBDO, String(km));
    else localStorage.removeItem(CLE_OBJECTIF_HEBDO);
  } catch (e) {
    // ignore
  }
}

/** Kilomètres parcourus depuis lundi 0h (semaine civile française, et non
 * les 7 derniers jours glissants : un objectif hebdomadaire se remet à zéro
 * en début de semaine). */
export function distanceSemaineEnCours() {
  const maintenant = new Date();
  const jour = maintenant.getDay(); // 0 = dimanche
  const joursDepuisLundi = (jour + 6) % 7;
  const lundi = new Date(maintenant);
  lundi.setDate(maintenant.getDate() - joursDepuisLundi);
  lundi.setHours(0, 0, 0, 0);

  return listerCourses()
    .filter((c) => new Date(c.date).getTime() >= lundi.getTime())
    .reduce((somme, c) => somme + (c.distanceKm || 0), 0);
}
