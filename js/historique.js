// Historique des courses terminées, conservé en local (pas de backend).
const CLE_STOCKAGE = 'coach-course-historique';
const MAX_COURSES_CONSERVEES = 50;

/** Ajoute une course terminée en tête de l'historique (la plus récente en premier). */
export function sauvegarderCourse(resume) {
  const historique = listerCourses();
  historique.unshift({ ...resume, date: new Date().toISOString() });
  try {
    localStorage.setItem(CLE_STOCKAGE, JSON.stringify(historique.slice(0, MAX_COURSES_CONSERVEES)));
  } catch (e) {
    // Stockage plein ou indisponible (navigation privée, etc.) : l'appli continue sans historique.
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

export function viderHistorique() {
  try {
    localStorage.removeItem(CLE_STOCKAGE);
  } catch (e) {
    // ignore
  }
}
