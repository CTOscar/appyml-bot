// Foto de perfil: leer la imagen, encuadrarla (zoom, desplazamiento, giro) y reducirla a size×size JPEG para subirla a la API (máx. 400 KB).
// Las cuentas (cropRect, panDelta, validarArchivoImagen…) son puras y se prueban aparte; el resto usa canvas del navegador.
export const FORMATOS = ['image/jpeg', 'image/png', 'image/webp'];
export const MAX_ORIGINAL = 12 * 1024 * 1024; // lo que se acepta del archivo elegido
export const MAX_FOTO = 400 * 1024; // lo que acepta la API (bytes ya reducida)
export const ZOOM_MAX = 4;

/** Mensaje de error si el archivo no sirve; null si está bien. */
export function validarArchivoImagen(file) {
  if (!file) return 'Elige una imagen.';
  if (/heic|heif/i.test(file.type || '') || /\.(heic|heif)$/i.test(file.name || '')) return 'Ese formato (HEIC, del iPhone) no se puede leer aquí. Guárdala como JPG o PNG e inténtalo de nuevo.';
  if (!FORMATOS.includes(file.type)) return 'Elige una imagen JPG, PNG o WebP.';
  if (file.size > MAX_ORIGINAL) return 'La imagen pesa más de 12 MB. Elige una más pequeña.';
  return null;
}

/**
 * Cuadrado de recorte sobre una imagen w×h. `zoom` ≥ 1 acerca; `dx` y `dy` (−1…1) lo desplazan dentro del margen que queda
 * (0 = centrado, −1 = pegado arriba/izquierda, 1 = pegado abajo/derecha). → { sx, sy, side } en píxeles de la imagen.
 */
export function cropRect(w, h, zoom = 1, dx = 0, dy = 0) {
  const z = Math.min(ZOOM_MAX, Math.max(1, Number(zoom) || 1));
  const side = Math.min(w, h) / z;
  const slackX = Math.max(0, w - side), slackY = Math.max(0, h - side);
  const cl = (v) => Math.max(-1, Math.min(1, Number(v) || 0));
  return { sx: (slackX / 2) * (1 + cl(dx)), sy: (slackY / 2) * (1 + cl(dy)), side };
}

/**
 * Cuánto cambia dx/dy (−1…1) al arrastrar `dScreen` píxeles de pantalla sobre una vista de `viewPx`.
 * Arrastrar hacia la derecha mueve la imagen a la derecha, o sea la ventana de recorte a la izquierda (signo negativo).
 */
export function panDelta(slackPx, sidePx, viewPx, dScreen) {
  if (!(slackPx > 0) || !(viewPx > 0)) return 0;
  return (-dScreen * (sidePx / viewPx)) / (slackPx / 2);
}

/** Bytes de una imagen en data URL base64. */
export const bytesDeDataUrl = (url) => Math.max(0, Math.floor(((String(url).length - String(url).indexOf(',') - 1) * 3) / 4));

/** Lee la imagen respetando la orientación EXIF. → { src, w, h, close() }. Lanza Error con un texto claro. */
export async function cargarImagen(file) {
  const err = validarArchivoImagen(file);
  if (err) throw new Error(err);
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
    return { src: bmp, w: bmp.width, h: bmp.height, close: () => bmp.close?.() };
  } catch { /* se intenta con <img> */ }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => bad(new Error('x')); i.src = url; });
    return { src: img, w: img.naturalWidth, h: img.naturalHeight, close: () => URL.revokeObjectURL(url) };
  } catch {
    URL.revokeObjectURL(url);
    throw new Error('No se pudo leer esa imagen. Prueba con otra en JPG o PNG.');
  }
}

// Gira la imagen `quarter` cuartos de vuelta (a la derecha). → { c (canvas), w, h }.
function girada(src, w, h, quarter) {
  const q = ((quarter % 4) + 4) % 4;
  const c = document.createElement('canvas');
  c.width = q % 2 ? h : w; c.height = q % 2 ? w : h;
  const x = c.getContext('2d');
  x.translate(c.width / 2, c.height / 2); x.rotate((q * Math.PI) / 2); x.drawImage(src, -w / 2, -h / 2);
  return { c, w: c.width, h: c.height };
}

/** Dibuja el recorte cuadrado en un canvas size×size (fondo blanco para PNG con transparencia). */
export function renderAvatar(img, { zoom = 1, dx = 0, dy = 0, quarter = 0, size = 256 } = {}) {
  const r0 = quarter % 4 ? girada(img.src, img.w, img.h, quarter) : { c: img.src, w: img.w, h: img.h };
  const { sx, sy, side } = cropRect(r0.w, r0.h, zoom, dx, dy);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, size, size);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(r0.c, sx, sy, side, side, 0, 0, size, size);
  return canvas;
}

/** JPEG en data URL; si pasara de 400 KB baja la calidad hasta que quepa. */
export function avatarDataUrl(canvas) {
  let url = '';
  for (const q of [0.86, 0.75, 0.6, 0.45]) { url = canvas.toDataURL('image/jpeg', q); if (bytesDeDataUrl(url) <= MAX_FOTO * 0.95) break; }
  return url;
}

/** Compatibilidad (la usa la app del bot): recorta al centro y reduce a size×size. */
export async function resizeImage(file, size = 256) {
  const img = await cargarImagen(file);
  try { return avatarDataUrl(renderAvatar(img, { size })); } finally { img.close(); }
}

/** Imagen pegada con Ctrl+V (captura o «copiar imagen»): devuelve el File o null. */
export function archivoDePegado(ev) {
  const items = ev?.clipboardData?.items ? [...ev.clipboardData.items] : [];
  const it = items.find((i) => i.kind === 'file' && /^image\//.test(i.type));
  return it ? it.getAsFile() : null;
}

export const initials = (name = '') => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?';
