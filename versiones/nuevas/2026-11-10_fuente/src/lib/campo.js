// Fotos del campo para Inicio (portada y galería), en varios tamaños WebP (public/campo/<nombre>-<ancho>.webp).
// La primera es la portada; la galería aparece con 3 o más. Las licencias CC BY / CC BY-SA piden dar crédito al autor:
// por eso cada foto lleva autor, licencia y página de origen (se muestran en la galería y en el pie de la portada).
// Para agregar una: guarda sus tamaños en public/campo/ y añádela aquí.
export const CAMPO_FOTOS = [
  { id: 'granja-tractores', alt: 'Granja con bodegas y tractores al atardecer', autor: 'Jean and Fred (Perth, Australia)', licencia: 'CC BY 2.0', origen: 'https://commons.wikimedia.org/wiki/File:The_golden_hour_-_Flickr_-_jeans_Photos.jpg', anchos: [640, 1280, 1920, 2560], foco: '50% 55%' },
  { id: 'amanecer-dorado', alt: 'Campo con niebla dorada al amanecer, árboles al fondo', autor: 'Dietmar Rabich', licencia: 'CC BY-SA 4.0', origen: 'https://commons.wikimedia.org/wiki/File:D%C3%BClmen,_B%C3%B6rnste,_Feld_--_2015_--_4640.jpg', anchos: [640, 1280, 1920, 2560], foco: '50% 70%' },
  { id: 'campo-verde', alt: 'Campo verde de avena y centeno con la huella del tractor', autor: 'W.carter', licencia: 'CC0', origen: 'https://commons.wikimedia.org/wiki/File:Field_with_mixed_intercropping_of_oat_and_rye_2.jpg', anchos: [640, 1280, 1920, 2560], foco: '50% 60%' },
  { id: 'campo-granja', alt: 'Campo cosechado con una granja en el horizonte', autor: 'Jean and Fred (Perth, Australia)', licencia: 'CC BY 2.0', origen: 'https://commons.wikimedia.org/wiki/File:The_golden_hour_-_Flickr_-_jeans_Photos_(1).jpg', anchos: [640, 1280, 1920, 2560], foco: '50% 60%' },
];

export const fotoSrc = (f, w) => `/campo/${f.id}-${w}.webp`;
export const fotoSrcSet = (f) => f.anchos.map((w) => `${fotoSrc(f, w)} ${w}w`).join(', ');
