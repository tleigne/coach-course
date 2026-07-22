// Service worker : mise en cache des fichiers de l'appli pour un fonctionnement hors-ligne.
// Change ce numéro de version à chaque mise à jour du code pour forcer le rafraîchissement du cache.
const CACHE_VERSION = 'coach-course-v5';

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
// signal), avec repli sur le cache seulement si le réseau échoue (vraiment
// hors-ligne, ex. en pleine nature pendant une course). On force `cache:
// 'no-store'` sur la requête réseau : sinon ce fetch peut lui-même être
// satisfait par le cache HTTP normal du navigateur (distinct du Cache Storage
// ci-dessus), qui a pu mémoriser une ancienne réponse — ce qui annule tout
// l'intérêt du réseau-prioritaire.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request.url, { cache: 'no-store' })
      .then((reponseReseau) => {
        const copie = reponseReseau.clone();
        caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, copie));
        return reponseReseau;
      })
      .catch(() => caches.match(event.request))
  );
});
