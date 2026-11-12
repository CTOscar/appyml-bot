// Fichas, tiendas y servicios del proyecto (los mismos del panel actual, constante _d del bundle).
// Cada enlace tiene `id`: es la ruta de su ficha interna (#/enlaces/<id>), que se escribe en linkDetails.js.
// Para agregar o quitar enlaces se edita esta lista. Solo se aceptan enlaces http(s).
export const LINK_GROUPS = [
  {
    "title": "Rastreadores",
    "links": [
      {
        "id": "fmc130",
        "label": "Teltonika FMC130",
        "note": "Nivel A · tractores sin electrónica",
        "href": "https://www.teltonika-gps.com/products/trackers/advanced/fmc130",
        "image": "/links/fmc130.png"
      },
      {
        "id": "fmc150",
        "label": "Teltonika FMC150",
        "note": "Nivel B · lectura CAN",
        "href": "https://www.teltonika-gps.com/products/trackers/can-data/fmc150",
        "image": "/links/fmc150.png"
      }
    ]
  },
  {
    "title": "Sensores",
    "links": [
      {
        "id": "escort-tdble1000",
        "label": "Escort TD-BLE 1000",
        "note": "Sonda de combustible BLE · CJP México",
        "href": "https://tienda.cjp.mx/compra/escort-tdble1000-sensor-de-combustible-conectividad-ble-4-0-sin-cables-176985",
        "image": "/links/escort-tdble1000.jpg"
      }
    ]
  },
  {
    "title": "Instalación",
    "links": [
      {
        "id": "caja-ip67",
        "label": "Caja IP67 con prensaestopas",
        "note": "Zulkit · Amazon MX",
        "href": "https://www.amazon.com.mx/Zulkit-conexiones-impermeable-transparente-prensaestopas/dp/B09FL2VKJY",
        "image": "/links/zulkit-ip67.jpg"
      },
      {
        "id": "sello-acero",
        "label": "Sello de acero con folio",
        "note": "$584 por 50 piezas · Amazon MX",
        "href": "https://www.amazon.com.mx/contenedores-antimanipulaci%C3%B3n-seguridad-autobloqueantes-certificadas/dp/B0CHYK7ZP7",
        "image": "/links/sello-cable.jpg"
      }
    ]
  },
  {
    "title": "Plataforma",
    "links": [
      {
        "id": "traccar",
        "label": "Traccar",
        "note": "Servidor de rastreo y documentación",
        "href": "https://www.traccar.org/",
        "image": "/links/traccar.jpg"
      },
      {
        "id": "buildwise",
        "label": "BuildWise Labs",
        "note": "Sitio y servicios",
        "href": "https://buildwiselabs.net",
        "image": "/links/buildwise.webp"
      }
    ]
  },
  {
    "title": "Otros",
    "links": [
      {
        "id": "aliexpress-pendiente",
        "label": "Producto AliExpress",
        "note": "Por identificar",
        "href": "https://es.aliexpress.com/item/1005010414603740.html",
        "image": "/links/aliexpress.webp"
      }
    ]
  }
];

export const safeHref = (u) => (/^https?:\/\/[^\s"'<>]+$/i.test(String(u || '')) ? String(u) : '#');
export const hostOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };
