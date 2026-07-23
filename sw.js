// Service worker : mise en cache des fichiers de l'appli pour un fonctionnement hors-ligne.
// Change ce numéro de version à chaque mise à jour du code pour forcer le rafraîchissement du cache.
const CACHE_VERSION = 'coach-course-v7';

const FICHIERS_A_METTRE_EN_CACHE = [
  './',
  './index.html',
  './style.css',
  './manifest.json',
  './js/app.js',
  './js/gpx.js',
  './js/geo.js',
  './js/coach.js',
  './js/utils.js',
  './js/profil.js',
  './js/historique.js',
  './js/kml.js',
  './js/export.js',
  './js/seances.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(FICHIERS_A_METTRE_EN_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((noms) =>
      Promise.all(noms.filter((nom) => nom !== CACHE_VERSION).map((nom) => caches.delete(nom)))
    )
  );
  self.clients.claim();
});

// Réseau en priorité (pour toujours avoir la dernière version quand il y a du
// signal), avec repli sur le cache si le réseau échoue OU met trop longtemps
// à répondre (signal faible en pleine nature pendant une course : mieux vaut
// basculer vite sur la version en cache que de laisser l'appli attendre).
// On force `cache: 'no-store'` sur la requête réseau : sinon ce fetch peut
// lui-même être satisfait par le cache HTTP normal du navigateur (distinct du
// Cache Storage ci-dessus), qui a pu mémoriser une ancienne réponse — ce qui
// annule tout l'intérêt du réseau-prioritaire.
const DELAI_MAX_RESEAU_MS = 4000;

function fetchAvecDelaiMax(url, delaiMs) {
  const controleur = new AbortController();
  const minuteur = setTimeout(() => controleur.abort(), delaiMs);
  return fetch(url, { cache: 'no-store', signal: controleur.signal }).finally(() => clearTimeout(minuteur));
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetchAvecDelaiMax(event.request.url, DELAI_MAX_RESEAU_MS)
      .then((reponseReseau) => {
        const copie = reponseReseau.clone();
        caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, copie));
        return reponseReseau;
      })
      .catch(() => caches.match(event.request))
  );
});
