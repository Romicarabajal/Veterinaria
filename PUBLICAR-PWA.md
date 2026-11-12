# Práctico 11 · Veterinaria Patitas en el celular

Este proyecto ya trae los pasos 1 a 4 y 7 a 8 hechos. Faltan los pasos 5 y 6, que hacés vos con tu cuenta de GitHub y tu celular.

## Qué ya está hecho

| Paso | Qué se hizo | Dónde |
|---|---|---|
| 1. Celular | Menú fijo abajo en pantallas de menos de 600 px, botones y campos de 44 px o más, letra de 16 px, teclados correctos (`type="tel"`, `inputmode="decimal"`) | `styles.css`, `index.html` |
| 2. Íconos | `icono-192.png` e `icono-512.png` (el generador está en `herramientas/`) | raíz |
| 3. Manifest | Nombre, colores, íconos, `display: standalone` | `manifest.json`, `<head>` de `index.html` |
| 4. Service worker | Guarda copias y abre sin internet (`VERSION`, `ARCHIVOS`) | `sw.js`, final de `app.js` |
| 7. Sin conexión | Aviso «Sin conexión…» y botón Exportar que comparte el JSON (`navigator.share`) | `app.js` |
| 8. Actualizar | Aviso «Hay una versión nueva…» cuando `sw.js` cambia | `app.js` |
| Práctico 10 | Agenda del día como pantalla principal, «Recordar por WhatsApp» y «Llamar» (`tel:`) en cada turno pendiente | `app.js` |

## Archivos que se suben a GitHub (7)

`index.html`, `styles.css`, `app.js`, `manifest.json`, `sw.js`, `icono-192.png`, `icono-512.png`

No subas la carpeta `herramientas/` ni este archivo: son para vos.

## Paso 5 · Publicar en internet

1. Entrá a **github.com** → **Sign up** con el mail de la escuela y verificá el código.
2. **+ → New repository**. Nombre: `tp10-veterinaria` (minúsculas, sin espacios). **Public** y **Add a README file**. **Create repository**.
3. **Add file → Upload files**. Arrastrá los 7 archivos sueltos (no la carpeta). **Commit changes**.
4. **Settings → Pages**. En **Branch** elegí **main** y **/ (root)**, y tocá **Save**.
5. Esperá 1 o 2 minutos y recargá: aparece la dirección `https://TUUSUARIO.github.io/tp10-veterinaria/`.
6. Probala en una ventana de incógnito (Ctrl + Shift + N).

Alternativa sin cuenta: Netlify Drop (app.netlify.com/drop), arrastrando la carpeta.

## Paso 6 · Instalar en el celular

- **Código QR:** en Chrome de la compu, abrí la dirección, clic derecho → **Crear código QR para esta página**, y escaneálo con el celular.
- **Android (Chrome):** menú ⋮ → **Instalar app** (o **Agregar a la pantalla principal**).
- **iPhone (Safari):** botón **Compartir** → **Agregar a inicio** → **Agregar**.
- Abrí la app desde su ícono: tiene que verse a pantalla completa, sin barra de direcciones.

## Probar sin conexión (paso 7)

- En la compu, con Live Server: F12 → **Application → Service workers** debe decir «activated and is running». Marcá **Offline** y recargá: la app abre con tus datos.
- En el celular: modo avión, abrí la app, cargá dos datos, cerrala y volvé a abrirla.
- Los datos viven en el celular: para pasarlos de la compu al celular usá **Exportar** e **Importar**.

## Publicar una actualización (paso 8)

1. Hacé el cambio en tus archivos.
2. En `sw.js` cambiá `const VERSION = "v1";` por `"v2"` (después `"v3"`, etc.).
3. En GitHub: **Add file → Upload files** con los archivos modificados (reemplaza los que tienen el mismo nombre) y **Commit changes**.
4. Esperá a que en la pestaña **Actions** aparezca el tilde verde.
5. En el celular, abrí la app con internet, cerrala del todo y volvé a abrirla.

## Si algo falla

- **No aparece «Instalar app»:** la página no está en https (por ejemplo, abierta con doble clic) o el manifest tiene un error. Revisá F12 → Application → Manifest.
- **Abre en blanco o con error 404:** las rutas tienen que ser relativas (`./sw.js`, `./`), nunca `/`.
- **No funciona sin conexión:** falta algún archivo en la lista `ARCHIVOS` de `sw.js`, o el service worker no se registró (mirá Console y Application → Service workers).
- **Sigue mostrando lo viejo:** no cambiaste `VERSION`.
- **«Failed to register a ServiceWorker»:** estás en `file://`. Usá Live Server o la dirección publicada.
- **Los datos de la compu no están en el celular:** es lo esperado; `localStorage` es de cada dispositivo.

## Lista de verificación · Práctico 11

- [ ] La app abre sin errores en la consola, en la compu y en el celular.
- [ ] F12 → Application → Manifest sin errores y con los dos íconos.
- [ ] El service worker figura como activo y la app abre con la casilla Offline marcada.
- [ ] La app está publicada en una dirección https y funciona igual que en la carpeta.
- [ ] Se instaló en un celular y abre desde su ícono, a pantalla completa.
- [ ] En modo avión se pueden cargar datos y siguen ahí al volver a abrirla.
- [ ] Se pasaron datos de la compu al celular (o al revés) con Exportar e Importar JSON.
- [ ] Una actualización publicada (VERSION cambiada) llegó al celular sin perder datos.
- [ ] Puedo explicar con mis palabras qué hacen manifest.json y sw.js.
- [ ] El uso de la IA quedó registrado (comentario en app.js y bitácora).
