# Mapa en vivo: servicios externos

Qué consulta el mapa de `versiones/nuevas/2026-11-10_fuente/` fuera del panel y de Traccar, qué datos salen y qué hay que revisar antes de publicar.
Ninguno necesita clave de API. Código: `src/lib/mapApis.js` (consultas) y `src/lib/geoFormats.js` (archivos).

## Qué se usa y para qué

| Función en el panel | Servicio | Endpoint | Cuándo se consulta |
|---|---|---|---|
| Ruta por camino, distancia y tiempo (Inspector → «Ruta por camino») | OSRM (demo público) | `router.project-osrm.org/route/v1/driving/…` | Al pulsar el botón |
| Lugar más cercano (Inspector y ficha del tractor) | Nominatim (OpenStreetMap) | `nominatim.openstreetmap.org/reverse` | Al hacer clic con el Inspector o al pulsar «¿Dónde está?» |
| Elevación (Inspector y ficha del tractor) | Open-Meteo | `api.open-meteo.com/v1/elevation` | Igual que el lugar |
| Clima y viento por lote (herramienta «Clima por lote») | Open-Meteo | `api.open-meteo.com/v1/forecast` (una llamada con todos los lotes) | Al encender la herramienta y cada 15 min mientras siga encendida |
| «Cómo llegar», «Street View», «Google Maps» | Google Maps URLs | `google.com/maps/dir`, `/maps/@?api=1&map_action=pano`, `/maps/search` | Solo abren una pestaña; el panel no llama a Google |

Ya existían: teselas de OpenStreetMap y Esri, radar de lluvia de RainViewer, NDVI de NASA GIBS y el clima de Inicio (Open-Meteo).

## Qué datos salen del panel

Solo **coordenadas** (del punto del Inspector, del tractor o del centro de cada lote). No se envían nombres de tractores, de lotes ni de personas.
Lugar y elevación **no se piden solos**: hace falta un clic. El clima por lote sí se pide al encender la herramienta (envía el centro de cada lote).
Importar y exportar lotes y recorridos ocurre en el navegador: los archivos no se suben a ningún servicio.

## Antes de producción (pendiente)

- **OSRM demo:** es un servidor de demostración, sin garantía de disponibilidad ni de uso intensivo. Para producción, montar OSRM propio o contratar un servicio de rutas.
- **Nominatim:** su política pide máx. 1 consulta por segundo, un identificador de la aplicación y no uso masivo. El panel encola las consultas (1.1 s entre una y otra) y guarda resultados por celda de ~100 m. Si el uso crece, usar una instancia propia o un proveedor.
- **Open-Meteo:** el servicio gratuito es **para uso no comercial**. El panel ya lo usa en Inicio; si el rancho o BuildWise Labs lo opera comercialmente hay que contratar su plan de pago o cambiar de proveedor.
- **Teselas de OpenStreetMap y Esri:** siguen pendientes de revisar sus políticas (ver `LEEME.md` de la fuente).
- **Google:** solo se usan enlaces (Maps URLs), que no requieren clave ni facturación. Geocoding, Elevation, Routes o Street View Static de Google sí requieren clave con facturación y no se usan.

## Importar lotes (crea geocercas)

«Importar lotes» (herramientas del mapa) acepta KML o GeoJSON (hasta 5 MB y 200 polígonos). Muestra una vista previa en el mapa y **solo crea al confirmar**; omite los lotes cuyo nombre ya existe.

- **Modo simulado:** se guardan en el navegador (`pf-mock-fences-extra`).
- **Con Traccar:** hace `POST /api/geofences` con `{ id: 0, name, description, area, attributes }`, donde `area` es WKT `POLYGON((lat lon, …))` (orden «lat lon», anillo cerrado).
  **Falta confirmar** el cuerpo y el orden de coordenadas contra la versión instalada de Traccar antes de usarlo con datos reales, y probar primero con un lote de prueba. Borrar una geocerca creada por error se hace desde Traccar.

## Exportar

GPX (solo recorridos, con hora y velocidad), KML y GeoJSON (recorridos y lotes). Los recorridos son los del historial en memoria del navegador (máx. 1300 puntos por tractor); respetan el botón «Tractor elegido / Toda la flota».
