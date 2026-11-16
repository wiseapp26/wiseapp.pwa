const CACHE = 'wis-pwa-v1.3.1';
const ASSETS = ['./', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png'];

self.addEventListener('install', (e) => {
  // 'reload' : on repart toujours des fichiers du serveur, jamais d'une copie intermédiaire du navigateur
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(ASSETS.map((u) => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  // La page de l'appli : réseau d'abord (toujours la dernière version, y compris pour
  // « Sur l'écran d'accueil »), et la copie en mémoire seulement si on est hors-ligne.
  if (req.mode === 'navigate' || req.destination === 'document') {
    e.respondWith(
      fetch(req.url, { cache: 'no-cache' })
        .then((resp) => {
          if (resp && resp.ok) {
            // on fait les copies AVANT de rendre la réponse à la page (sinon elle est déjà « consommée »)
            const copyA = resp.clone(), copyB = resp.clone();
            caches.open(CACHE).then((c) => { c.put(req, copyA); c.put('index.html', copyB); });
          }
          return resp;
        })
        .catch(() => caches.match(req, { ignoreSearch: true }).then((r) => r || caches.match('index.html')))
    );
    return;
  }

  // Icônes et manifeste : copie en mémoire d'abord, rafraîchie en arrière-plan
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then((cached) => {
      const network = fetch(req).then((resp) => {
        if (resp && resp.ok) { const copy = resp.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
        return resp;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
