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

export function viderHistorique() {
  try {
    localStorage.removeItem(CLE_STOCKAGE);
  } catch (e) {
    // ignore
  }
}
