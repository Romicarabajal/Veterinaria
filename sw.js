/* ==========================================================
   sw.js · Service worker de Veterinaria Patitas
   Guarda una copia de la app la primera vez (con internet) y
   después la entrega aunque no haya conexión.

   Ejemplo de la vida real: es como un portero que tiene fotocopias
   de todo. Si alguien pide un papel, primero busca la fotocopia;
   solo sale a la calle (internet) si no la tiene.

   PARA PUBLICAR UNA ACTUALIZACIÓN: cambiá VERSION ("v1" → "v2")
   y subí los archivos modificados. Así los celulares piden
   una copia nueva.
   ========================================================== */

const VERSION = "v1";
const PREFIJO_CACHE = "veterinaria-patitas-";
const NOMBRE_CACHE = PREFIJO_CACHE + VERSION;

// Todos los archivos que usa la app. Si agregás otros (imágenes, librerías), sumalos acá.
const ARCHIVOS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.json",
  "./icono-192.png",
  "./icono-512.png"
];

// INSTALL: ocurre la primera vez (o cuando cambia sw.js). Es como llenar el estante de fotocopias.
self.addEventListener("install", evento => {
  evento.waitUntil(
    caches.open(NOMBRE_CACHE).then(cache => cache.addAll(ARCHIVOS))
  );
});

// ACTIVATE: el service worker nuevo toma el mando. Es como tirar las fotocopias viejas.
self.addEventListener("activate", evento => {
  evento.waitUntil(
    caches.keys().then(nombres =>
      Promise.all(
        nombres
          .filter(nombre => nombre.startsWith(PREFIJO_CACHE) && nombre !== NOMBRE_CACHE)
          .map(nombre => caches.delete(nombre))
      )
    ).then(() => self.clients.claim())
  );
});

// FETCH: cada vez que la app pide un archivo. Estrategia "primero la caché".
self.addEventListener("fetch", evento => {
  if (evento.request.method !== "GET") return;               // solo respondemos pedidos de lectura

  evento.respondWith(
    caches.match(evento.request, { ignoreSearch: true }).then(copia => {
      if (copia) return copia;                               // 1) hay copia guardada: se usa
      return fetch(evento.request).catch(() => {             // 2) no hay: se busca en internet
        if (evento.request.mode === "navigate") return caches.match("./index.html");
        return Response.error();                             // 3) sin internet y sin copia (ej.: fuentes de Google)
      });
    })
  );
});
