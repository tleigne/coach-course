// Fonctions utilitaires partagées : distance GPS, formatage des nombres/temps.

/** Échappe un texte avant de l'insérer dans du HTML (ex. nom de parcours
 * venant d'un fichier importé par l'utilisateur). */
export function echapperHTML(texte) {
  const div = document.createElement('div');
  div.textContent = texte;
  return div.innerHTML;
}

/** Distance en kilomètres entre deux points GPS (formule de Haversine). */
export function distanceHaversine(lat1, lon1, lat2, lon2) {
  const R = 6371; // rayon de la Terre en km
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/** Formate une distance en km avec 2 décimales : "5,32 km". */
export function formatDistance(km) {
  return `${km.toFixed(2).replace('.', ',')} km`;
}

/** Formate une durée en millisecondes pour un chronomètre : "m:ss.d" ou
 * "h:mm:ss.d", avec un dixième de seconde (précision d'affichage courante
 * pour un chronomètre, sans prétendre à une précision GPS/matérielle réelle). */
export function formatChrono(ms) {
  ms = Math.max(0, Math.round(ms));
  const dixiemes = Math.floor((ms % 1000) / 100);
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}.${dixiemes}` : `${m}:${ss}.${dixiemes}`;
}

/** Formate une durée en secondes en "h:mm:ss" ou "m:ss". */
export function formatDuree(sec) {
  sec = Math.max(0, Math.round(sec));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}

/** Formate une durée en secondes pour l'énoncer à voix haute, de façon
 * naturelle : "1 heure, 15 minutes et 20 secondes", ou juste "5 minutes"
 * si les heures/secondes valent zéro. Distinct de formatDuree (affichage
 * visuel "h:mm:ss"), car lire "35:20" tel quel prête à confusion pour une
 * synthèse vocale (risque de l'interpréter comme une heure de la journée). */
export function formatDureeParlee(sec) {
  sec = Math.max(0, Math.round(sec));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;

  const parties = [];
  if (h > 0) parties.push(`${h} heure${h > 1 ? 's' : ''}`);
  if (m > 0) parties.push(`${m} minute${m > 1 ? 's' : ''}`);
  if (s > 0 || parties.length === 0) parties.push(`${s} seconde${s > 1 ? 's' : ''}`);

  if (parties.length === 1) return parties[0];
  return parties.slice(0, -1).join(', ') + ' et ' + parties[parties.length - 1];
}

/** Formate une allure (secondes par km) en "m:ss /km". */
export function formatAllure(secParKm) {
  if (!isFinite(secParKm) || secParKm <= 0) return '--:-- /km';
  const m = Math.floor(secParKm / 60);
  const s = Math.round(secParKm % 60);
  return `${m}:${String(s).padStart(2, '0')} /km`;
}

/** Convertit "1:45:00" ou "45:00" en secondes. Retourne null si invalide. */
export function parseHMS(texte) {
  if (!texte) return null;
  const parts = texte.trim().split(':').map((p) => parseInt(p, 10));
  if (parts.some((p) => isNaN(p))) return null;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 1) return parts[0] * 60;
  return null;
}

/** Convertit une allure texte "5:30" (min:sec par km) en secondes/km. */
export function parseAllure(texte) {
  if (!texte) return null;
  const parts = texte.trim().split(':').map((p) => parseInt(p, 10));
  if (parts.length !== 2 || parts.some((p) => isNaN(p))) return null;
  return parts[0] * 60 + parts[1];
}

/** Formate une durée signée pour l'avance/retard : "+0:45" ou "-1:20". */
export function formatEcart(sec) {
  const signe = sec >= 0 ? '+' : '-';
  return signe + formatDuree(Math.abs(sec));
}
