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
