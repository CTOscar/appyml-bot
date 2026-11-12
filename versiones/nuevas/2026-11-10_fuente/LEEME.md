# Panel de flota · código fuente (reconstrucción, 10 nov 2026)

Reemplazo del bundle parchado (`../2026-11-07_recuperado`). Mismo panel, diseño nuevo y código fuente normal:
React 19 + Vite 8 + Tailwind 4. **Sin desplegar**: el oficial sigue siendo `2026-11-07_recuperado` hasta que este esté a la par.

Estilo: noche azul marino, títulos grandes y ligeros con resplandor (DM Sans 300), texto en Inter, superficies de cristal,
fondo con estrellas y órbitas, botón principal blanco y barra superior flotante. Referencia: jimo.ai/product/ai (solo el estilo).

## Comandos

```bash
npm install            # .npmrc trae legacy-peer-deps (npm 10 falla con las peer opcionales de @vitejs/plugin-react 6)
npm run dev            # http://localhost:5174 ; /api/panel se reenvía a PANEL_PROXY (por defecto http://localhost:3000)
npm test               # Vitest
npm run build          # dist/ (se publica el contenido)
```

Si la API no tiene `http://localhost:5174` en `ALLOWED_ORIGINS`, en desarrollo se puede arrancar con
`PANEL_ORIGIN=http://localhost:5173 npm run dev` (el proxy manda ese Origin). Ver `.env.example`.

## Estructura

| Carpeta | Qué hay |
|---|---|
| `src/api/` | Clientes de datos tomados del fuente archivado: API del panel (`panel.js`), Traccar con WebSocket (`traccar.js`), simulado (`mock.js`) e `index.js` que los une |
| `src/app/` | Sesión (`auth.jsx`, reglas de contraseña) y enrutador por hash (`router.js`, `#/tractores`) |
| `src/layout/` | Barra superior flotante (`TopBar.jsx`) y fondo espacial (`Cosmos.jsx`) |
| `src/ui/` | Componentes base: `Button`, `IconButton`, `Input`, `Field`, `Card`, `Badge`, `Stat`, `Divider`, `Spinner` |
| `src/pages/` | `Login` (entrar, crear cuenta, recuperar, Google/Apple), `Home` (en vivo), `MapPage` (mapa en vivo), `Search`, `Pending` (secciones por construir) |
| `src/fleet/` | Estado en vivo (`store.js` + `FleetProvider.jsx`/`useFleet`), lógica de operación (`ops.js`, portada de `mapops.js`), el mapa Leaflet (`MapView.jsx`) y el mapa incrustado de Inicio (`MiniMap.jsx`: filtro por estado, capa, ficha del tractor; la rueda solo acerca con Ctrl) |
| `src/lib/` | `fleet.js` (estado de cada tractor y resumen), `format.js` |
| `src/styles.css` | Sistema de diseño: colores, tipografías, `.glass`, `.menu-surface`, `.display`, `.glow`, animaciones |
| `public/brand`, `public/brands` | Logos y favicons (copiados del panel actual) |

## Fases

| Fase | Contenido | Estado |
|---|---|---|
| 1 | Base, sistema de diseño, acceso y barra superior flotante, Inicio | **Hecha** |
| 2 | Mapa en vivo (Leaflet), lista de tractores, filtros, operación de hoy, búsqueda | **Hecha** |
| 3 | Tractores, Lotes, Alertas, Reportes, Costeo, Enlaces, Status, Perfil | **Hecha** (`src/pages/*.jsx`; 27 pruebas y build en verde) |
| 4 | Taller (OT, almacén, costos/KPIs) y Automatización | **Hecha** (Tablero, Órdenes, Almacén, Costos y KPIs y Automatización; el chat usa la librería assistant-ui: `src/taller/AsistenteChat.jsx`) |
| 5 | Comparar pantalla por pantalla con el panel actual y publicar | Revisión hecha (Enlaces, Acceso y recuperar contraseña iguales al bundle; 8 enlaces idénticos). Falta probar en celular y con `panel-flota-agents/` real, y publicar `dist/` |

## Mapa en vivo (fase 2)

- **Datos:** `src/fleet/store.js` carga dispositivos, posiciones, lotes, horas de motor y eventos de hoy, y escucha el WebSocket de
  Traccar (o el simulado). Acumula por tractor el tiempo de hoy en cada estado de trabajo (trabajando = encendido, en movimiento
  y dentro de un lote; tránsito; parado con motor; apagado; sin señal). Se guarda por día en `localStorage` (`pf2-ops-AAAAMMDD`);
  los huecos de más de 5 min entre reportes no se cuentan.
- **Pantalla:** el mapa ocupa todo; flotan la barra superior, el panel «Flota» (indicadores que filtran por estado, búsqueda, marca,
  nivel, lista y ficha del tractor con Centrar/Seguir), los controles (zoom, ver toda la flota, capa, lotes) y «Operación de hoy».
  En celular el panel es una hoja inferior de tres alturas. `#/mapa?d=ID` abre un tractor (lo usa la búsqueda).
- **Capas:** «Mapa oscuro» = teselas de OpenStreetMap con filtro CSS (`.pf-dark-tiles`; CARTO oscuro ya pide clave de API),
  «Satélite» e «Híbrido» de Esri. **Antes de producción** hay que revisar las políticas de uso de OSM/Esri o contratar un proveedor.
- **Herramientas del mapa:** botón de llave en los controles → `MapToolsPanel.jsx` (rastro por velocidad, calor, etiquetas, alertas de lote, lluvia, paradas, cobertura, NDVI, agrupar, seguir, historial demo, simular salida de lote, pantalla completa) y `PlaybackBar` (reproducción de ruta). Lógica en `mapTools.js`, conectada con `useMapTools`.
- **Servicios del mapa sin clave** (`src/lib/mapApis.js`, `geoFormats.js`; detalle y pendientes en `docs/backend/MAPA-SERVICIOS-EXTERNOS.md`): el Inspector suma lugar (Nominatim), elevación (Open-Meteo), **Ruta por camino** (OSRM; tramo sólido + enlaces punteados, con aviso si el punto no está sobre un camino) y enlaces «Cómo llegar», «Street View» y «Google Maps» (solo abren Google, sin clave). La ficha del tractor tiene la tarjeta **Ubicación** (`UbicacionTractor.jsx`, a petición). La herramienta **Clima por lote** pinta temperatura, viento y veredicto de aplicación (mismo criterio de Inicio) sobre cada lote. **Importar y exportar** (`ImportarExportar.jsx`): KML/GeoJSON → lotes (vista previa y confirmación; con Traccar crea geocercas reales: `createGeofence`, por confirmar) y GPX/KML/GeoJSON de recorridos y lotes.
- **Mi perfil** (`pages/Perfil.jsx`, `PerfilFoto.jsx`, `lib/perfil.js`, `lib/photo.js`, `app/avatar.js`): foto con editor de encuadre (zoom, arrastrar, girar) que se puede subir eligiendo archivo, arrastrando o pegando con Ctrl+V; datos con validación, «Descartar» y aviso al salir con cambios; puesto (en `attributes.puesto`); tarjeta de seguridad que pide la contraseña actual; rol, fechas y permisos; y roles al día en «Cuentas». La foto se comparte con la barra superior.
- **Pantalla por rol** (`lib/roles.js` → `vistaDe()`; la API manda `permissions` en `/session`): **super_admin** → panel completo `/`, bot y Accounts · **admin** → ERP de supervisión, **solo lectura** (`src/erp/`: Resumen, Tractores, Costeo de diésel, Informes y Taller; barra lateral, ruta de navegación y etiqueta «Solo lectura»; el taller ignora cualquier captura y la API rechaza las escrituras) · **jefe_taller** → ERP del Taller con captura (Tablero, Órdenes de trabajo, Almacén y Costos y KPIs) · **operador** → bot (`/bot/`; si abre el panel, `App.jsx` lo manda ahí) · **pendiente** → «Tu cuenta está pendiente de aprobación» (`pages/CuentaPendiente.jsx`, con «Revisar de nuevo» y «Salir»), en el panel y en el bot. Sin `permissions` en la sesión (datos simulados) no se restringe nada. El bot sigue pudiendo abrirse sin cuenta (solo usa datos locales del taller). **Límite:** los datos del Taller están en el `localStorage` de cada navegador, así que lo que captura el jefe de taller no lo ve el admin desde otro equipo hasta que el taller pase a la API.
- **Barra superior:** Inicio, Mapa, Tractores, Taller y Más abren su contenido al pasar el cursor o enfocar con teclado (`HoverMenu` en `TopBar.jsx`; el clic sigue navegando).
- **Búsqueda (`#/buscar`):** tractores (nombre o IMEI; primero los que coinciden por nombre), lotes y páginas; ↑↓ y Enter.


## Taller (fase 4, en curso)

- `src/taller/logic.js`: reglas del taller extraídas **sin cambios** de `panelpack/assets/taller.js` del panel actual (líneas 15-741; sin DOM). Estado en `localStorage` (`pf-taller-v1`), con datos de ejemplo. La fuente de GPS se inyecta con `setGpsSource()` (falta conectarla al store de la flota).
- `src/taller/useTaller.js`: `useTaller()` (suscribe la vista), `mutate(fn)` (cambia, guarda y repinta), `resetDemo()`, `useToast()`.
- `src/taller/Ordenes.jsx`: lista, nueva OT, pasos, refacciones, mano de obra, clasificación de falla e historial. Ruta `#/taller/ordenes?ot=ID`.
- `Tablero.jsx`, `Almacen.jsx` (existencias, requisiciones, entradas, movimientos) y `Kpis.jsx` (costos y KPIs por periodo); prueba de humo en `Vistas.test.jsx`. El horómetro de los equipos vinculados se sincroniza con la flota en vivo.
- `src/pages/Taller.jsx`: pestañas; las que faltan muestran un aviso.
- Pruebas: `logic.test.js` (las 11 de `patch/taller.test.cjs`, portadas) y `Ordenes.test.jsx` (renderizado y flujo de una OT).

## Paridad con el panel recuperado (mapa y operación)

- **Operación de flota** (`mapops.js`): estado de trabajo con anillos en el mapa, superficie trabajada por lote (`avanceLotes`), alertas de combustible, velocidad y horario con detalle, pines y tramo; tarjeta «Operación de hoy» con pestañas Estado / Avance / Alertas. Los parámetros y los seis interruptores viven en `#/ajustes` (`src/fleet/opsConfig.js`, `src/pages/Ajustes.jsx`).
- **Herramientas interactivas** (`maptools.js`): Inspector, Radio de alcance, Notas (clave `pf-mapnotes-v1`), Buscar (tecla `/`) y Compartir vista (`?mv=`). Lógica pura en `geoTools.js`, controlador en `mapInteract.js`, interfaz en `MapInteractUI.jsx`.
- **Herramientas del mapa** (`mapx.js`): ver la sección «Mapa en vivo».
- **Lotes**: detalle con tractores dentro, avance, malla y registros. **Tractores**: alertas de hoy por modelo.
- **Automatización** (`src/taller/Automatizacion.jsx`): chat con assistant-ui (`AsistenteChat.jsx`), al estilo de un asistente moderno, un chat por operador, avisos al jefe, reglas activas y reporte semanal en la barra lateral (en celular, panel deslizable). Responde el agente de `panel-flota-agents/` (`VITE_AGENTS_URL`, por defecto `http://localhost:3100`) y, si no está en línea, las reglas locales.

## Inicio (orden de secciones)

**Actual:** portada larga con la estructura de una página de producto (solo estilo, contenido del panel): portada con foto y logos → frase fija al hacer scroll → «Una flota. Tres vistas.» (mapa, atención, campo en ventanas con foto) → «Lo que lee el panel» en perspectiva → franja de confianza con logos → rejilla bento → conexión por API → números fijos → «Hecho para el campo» con fotos → cita → piloto → preguntas → cierre. Código en `src/pages/Home.jsx` y `src/pages/HomeSections.jsx`; prueba de humo en `Home.test.jsx`.

**Anterior (referencia):**

Portada con los 6 indicadores montados sobre su borde → accesos rápidos → **Operación** (mapa en vivo 7/12; clima y carrusel de resumen 5/12) → **Atención** (alertas y lotes) → Actualidad (noticias) → **El campo** (océano/Earth y 2 fotos). Las fotos de la galería ya no forman una franja aparte. Los ids `dh-now` y `dh-flota` los usan los indicadores y accesos para desplazarse.

## Diseño y temas

Los colores, el grosor de líneas, los radios y el brillo salen de **`design/tokens.json`** (fuente única) → `npm run tokens` genera `src/theme/tokens.css` (corre solo antes de `dev` y `build`; no se edita a mano).
Temas: **noche** (actual, predeterminado), **claro**, **bosque** y **contraste** (bordes de 2 px). Selector en el menú del perfil y en `#/perfil` (Apariencia); «Automático» sigue al sistema. Se guarda en `localStorage` (`pf-theme`).

- En los componentes se usan los tokens de Tailwind (`bg-night`, `text-fg`, `text-onfg` sobre `bg-fg`, `bg-ink/10` para velos y rellenos translúcidos) o variables (`rgb(var(--ink-rgb)/…)`, `var(--t-hair-w)`). No se escriben colores a mano.
- Texto o controles sobre **fotos y mapas**: clase `on-photo` (conserva los valores oscuros en cualquier tema).
- `src/theme/theme.js` (estado y aplicación del tema), `ThemePicker.jsx` (selector), `design/lib.mjs` (validación, contraste WCAG, generación del CSS, derivación de temas).
- **Servidor MCP** `design/mcp-server.mjs` (sin dependencias; registrado en `.mcp.json` de la raíz como `panel-design`): `list_themes`, `get_theme`, `set_token`, `create_theme` (desde fondo + acento), `delete_theme`, `check_contrast`, `find_hardcoded_colors`, `rebuild_css`. Cada cambio valida, avisa si rompe el contraste WCAG y regenera el CSS.
- Pendiente: ~74 colores escritos a mano en JS (herramientas del mapa, gráficas de Costeo, marcas de estado). `find_hardcoded_colors` los lista.

## Bot instalable (PWA) · `/bot/`

El asistente del taller también existe como app aparte, solo el chat (estilo ChatGPT/DeepSeek con assistant-ui), sin el resto del panel.

- Entrada: `bot/index.html` → `src/bot/main.jsx` → `src/bot/BotApp.jsx` (reusa `Automatizacion.jsx` a pantalla completa). Se compila junto al panel y sale en `dist/bot/`.
- PWA: `public/bot/manifest.webmanifest` (alcance `/bot/`, íconos y atajos «Nuevo chat» / «Avisos al jefe»), `public/bot/sw.js` (guarda solo la app; no toca `/api/` ni el servicio de agentes) e íconos `icon-*.png` (generados de `public/brand/las-cabras-logo.webp`).
- Instalar: Chrome/Edge/Android muestran «Instalar la app» en la barra lateral; en iPhone, Safari → Compartir → Agregar a pantalla de inicio (el botón explica los pasos).
- Sin conexión abre la app y responde con las reglas locales; avisa cuando hay versión nueva. Desarrollo: `http://localhost:5174/bot/` (el service worker solo se registra en el build; probar con `npm run build && npx vite preview`).
- Para que la app instalada use el agente real, `VITE_AGENTS_URL` debe apuntar a una dirección HTTPS con CORS hacia el dominio del panel.

## Accounts y Aplicaciones

- **Accounts** (`#/accounts`, solo administradores): las tablas `users`, `login_log`, `oauth_accounts`, `invitations` y la matriz de roles/permisos al estilo de un cliente MySQL; marca lo nuevo desde tu última visita, cambia roles, invita y exporta CSV.
- **Aplicaciones** (`#/apps`): descarga del bot para Windows, Linux y Android (ver `apps/README.md`). Los binarios no van a git; se generan con `npm run apps:manifest`.
