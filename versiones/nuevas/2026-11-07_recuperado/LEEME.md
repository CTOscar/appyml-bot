# Versión recuperada · 7 de noviembre de 2026

**Qué es:** copia recuperada de un despliegue del Panel de Flota (Las Cabras Sinaloa) ya compilado
y parcheado a mano. No es código fuente: no tiene `src/` ni `package.json`.

| Carpeta | Contenido |
|---|---|
| `panelpack/` | El sitio listo para publicar (`index.html`, `assets/`, `brand/`, `brands/`, `links/`) |
| `patch/` | Scripts `*.cjs` que editan el build, más `home.js` y sus respaldos `.bak` |
| `debian/` | Página de inicio estática |

**Qué la distingue**
- Incluye `home.js` (dashboard con noticias desde `https://buildwiselabs.net/api/news`) y `statuspage.js`.
  Esto **no está** en `../../antiguas/panel-flota/src` ni en `../../antiguas/panel-flota/dist`.
- Su `index-Bka7l8xf.js` pesa 460,537 bytes. El desplegado en `panelpack.buildwiselabs.net` (5 nov, 00:49)
  pesa 428,159: esta copia es posterior a ese despliegue.

**Estado:** sin desplegar en producción (verificado por tamaño de archivos el 8 nov 2026).

**Dependencias del servidor**
- API del panel: `../../../panel-flota-api` (`/api/panel`, MySQL).
- Noticias: backend de `buildwiselabs.net` (`/api/news`, categoría `agro`).
- Posiciones en vivo: Traccar (`/api/session`, `/api/devices`, `/api/positions`, `/api/socket`).

## Publicar en Hostinger

El bundle de trabajo usa `same-origin` (`/api/panel`, con el proxy local). En Hostinger la API vive en
`api-panelpack.buildwiselabs.net`, así que se arma una copia con la dirección cambiada:

```bash
cd versiones/nuevas/2026-11-07_recuperado
node patch/make-deploy.cjs          # API de producción, datos simulados
node patch/make-deploy.cjs --live   # además, Traccar real (VITE_USE_MOCK=false)
```

Genera `deploy-hostinger/` (sin `*.bak*`; no se versiona) y no toca `panelpack/`. Sube **el contenido** de esa carpeta
a `public_html` de `panelpack.buildwiselabs.net`. Antes, en la API: `ALLOWED_ORIGINS` con
`https://panelpack.buildwiselabs.net`, `PANEL_URL` igual, y en Google Cloud el URI
`https://api-panelpack.buildwiselabs.net/api/panel/auth/google/callback`.

## Operación de flota, Tractores y Ajustes de mapa (10 nov 2026)

Archivos nuevos en `panelpack/assets/`: **`mapops.js`** (operación de flota y página de Ajustes), **`tractores.js`** (tarjetas por marca y modelo), **`maptools.js`** (herramientas interactivas del mapa) y **`enlaces.js`** (página Enlaces).
**Inicio conserva sus noticias** (no se tocaron); las tarjetas de tractores viven solo en la página Tractores.
Se conectan con **`node patch/mapops-hook.cjs`**, que **parte siempre de los respaldos originales** (`index-*.js.bak-mapops` y `home.js.bak-tractores`) y aplica todos
los cambios en orden: se puede correr las veces que haga falta y el resultado es el mismo. Si un cambio no coincide, o el resultado tuviera un error de sintaxis, no
escribe nada de ese archivo. **No edites a mano `index-*.js` ni `home.js`**: el script los regenera desde el respaldo y perdería tu cambio; agrégalo como entrada del script.
`home.js` conserva sus saltos de línea CRLF. Si se vuelve a generar el
bundle o se restaura `home.js`, hay que volver a correrlo. Pruebas de la lógica: `node --test patch/*.test.cjs`.

### Páginas nuevas (se abren como Status: migas «Inicio / …»)
| Página | Cómo se llega | Contenido |
|---|---|---|
| **Tractores** | Tools → Configuración → Tractores, enlace «Tractores» de la barra, buscador | Tarjetas por marca y modelo (John Deere 5075E/5090E/6110J; New Holland TT4.75/T6.110): unidades, nivel A/B, en marcha/apagados/sin señal, horas de motor y operación de hoy; filtro por marca; clic en una tarjeta = detalle por unidad; clic en una unidad = verla en el mapa |
| **Enlaces** | Barra del marco, Tools → Enlaces del proyecto y todo botón «Enlaces» del panel, buscador | Las fichas, tiendas y servicios del proyecto como tarjetas con imagen, por categoría (Rastreadores, Sensores, Instalación, Plataforma, Otros), con buscador; se abren en otra pestaña. Reemplaza al menú desplegable antiguo, que ya no se abre. La lista sale de la constante `_d` del bundle (expuesta como `window.__pfLinks`) |
| **Ajustes de mapa** | Tools → Configuración → Ajustes de mapa, Preferencias de organización, buscador, enlace en el panel rápido de la rueda dentada | Unidades y visualización del mapa (controlan los ajustes del bundle) + Operación de flota (abajo) |

### Simulador de instalación y Vista 3D: quitados de la navegación
`patch/mapops-hook.cjs` los saca de la barra, del menú Tools, de Inicio, del buscador, del menú Enlaces y de las rutas `#/simulador` y `#/vista-3d`.
**Solo se quitaron los accesos**: las vistas siguen dentro del bundle (inalcanzables) y la escena 3D (`tractorScene-*.js`) se conserva porque el diálogo de
instalación de cada equipo la usa. Para recuperarlos se restauran `index-*.js.bak-mapops` y `home.js.bak-tractores` (copias previas a todos los parches).

### Ilustración del tractor: quitada
Se quitó el dibujo del tractor (función `Pa` del bundle) de la **tarjeta de detalle** de cada unidad y del **encabezado de configuración del tractor**. La función queda
definida pero sin uso. Se restaura con `index-*.js.bak-mapops`.

### Herramientas interactivas del mapa (`maptools.js`)
Un botón nuevo en la botonera del mapa (debajo de «Herramientas del mapa») abre un menú. **Esc** sale de la herramienta activa; la tecla **/** abre el buscador.

| Herramienta | Qué hace |
|---|---|
| **Inspector** | Clic en cualquier punto: coordenadas, lote que lo contiene (con su superficie), tractor más cercano y distancia. Con un tractor seleccionado, dibuja la línea y estima el tiempo (a su velocidad si se mueve; si no, a 15 km/h). Acciones: copiar coordenadas, abrir en Google Maps, crear una nota o un radio ahí |
| **Radio** | Clic + deslizador de 0.1 a 10 km: qué tractores hay dentro, con distancia y estado, en vivo; el centro se arrastra; clic en una fila = volar al tractor |
| **Notas** | Pines propios (pozo, bodega, taller, combustible, riesgo, otro) con título y texto; se arrastran, se editan y se borran. Se guardan en `localStorage` (`pf-mapnotes-v1`); el texto se escapa (sin HTML) |
| **Buscar** | Tractores (nombre, marca, modelo), lotes y notas, sin acentos; flechas + Enter |
| **Compartir vista** | Copia un enlace `?mv=capa,lat,lon,zoom[,tID]` que al abrirse lleva al mapa con esa capa, centro, zoom y tractor seleccionado |

La barra verde de arriba indica el modo activo. Activar la medición del panel apaga la herramienta y viceversa. Las notas solo existen en el navegador donde se crearon.

### Operación de flota en el mapa
Tarjeta **«Operación de hoy»** (Estado · Avance · Alertas) **a la derecha del mapa**; se oculta en las páginas del marco y mientras estén abiertos el panel rápido
de Ajustes o el de herramientas.

| Función | Qué hace | Ajustes |
|---|---|---|
| Estado de trabajo | Anillo de color por tractor: trabajando (motor + velocidad + dentro de lote), en tránsito, parado, apagado, sin señal; tiempos del día | velocidad mínima de trabajo |
| Superficie trabajada | ha hechas, pendientes y % por lote (cuadrícula del implemento, sin doble conteo; aproximado) | ancho del implemento |
| Combustible | Pin: posible extracción (motor apagado), caída brusca (motor encendido) y carga | cambio mínimo en L |
| Velocidad | Pin y tramo en rojo al pasar el límite | límite en lote (12) y en tránsito (30) |
| Horario | Anillo morado punteado y alerta si avanza con motor encendido fuera de horario | desde / hasta (admite turnos nocturnos) |

- **Datos:** `localStorage` del navegador (`pf-mapops-v1` ajustes, `pf-mapops-d-AAAAMMDD` datos del día; se conservan 7 días). Los tiempos y la superficie se
  acumulan **solo mientras el panel está abierto**. Con datos simulados, «Cargar demostración» llena valores de ejemplo.
- **Catálogo de modelos:** `CATALOG` en `tractores.js`. La potencia (hp) es **referencial**: confírmala con la ficha del fabricante. Un modelo fuera del
  catálogo aparece igual, sin potencia.
- **Velocidad:** Traccar entrega nudos; estos módulos convierten a km/h (× 1.852), igual que el panel. Ojo: `mapx.js` (rastro por velocidad, paradas)
  usa `p.speed` como km/h sin convertir.
- **Pendiente para datos reales:** guardar el historial en `panel-flota-api` (`position_samples`) para que los tiempos y la superficie sobrevivan entre
  navegadores y días, y calibrar el umbral de combustible con las lecturas reales de la sonda.

## Taller (`taller.js`, 10 nov 2026)

Página **Taller** del marco (barra de navegación, buscador). Adapta la lógica del prototipo «Taller y Almacén Las Cabras» a la flota del piloto
(JD-01 John Deere 6110J, JD-02 John Deere 5090E, NH-01 New Holland T6.110, IM-01 rastra). Cubre los módulos 04 Taller, 05 Almacén y 06 Costos
de `docs/agentes/prototipo-agentes.txt`. Se conecta con `node patch/mapops-hook.cjs` (entradas «Taller: …»). Pruebas: `node --test patch/taller.test.cjs`.

| Pestaña | Qué hace |
|---|---|
| Tablero | Disponibilidad, descompuestos, servicios vencidos, reportes de falla → «Crear OT», flota con semáforo de servicio, costo por hora, fallas por causa, operadores, inventario por pedir |
| Órdenes de trabajo | Recepción → diagnóstico → reparación → terminada → liberada. Tareas del plan, refacciones (se apartan), mano de obra, clasificación de la falla (obligatoria para terminar una correctiva) |
| Almacén | Existencias con mínimo/máximo, por surtir, requisiciones (Jefe de taller hasta $10,000; arriba, Dirección), entradas con costo promedio, conteo físico, diésel del tanque, kardex |
| Costos y KPIs | Costo total, por hora y por hectárea, disponibilidad, MTBF, MTTR, cumplimiento preventivo, correctivo por sistema y causa, costo por lote, tiempo parado |
| Automatización | Chat estilo assistant-ui (hilo, sugerencias, compositor). Si el servicio `panel-flota-agents/` responde (`window.PF_AGENTS_URL`, por defecto `http://localhost:3100`, `POST /chat`), contesta el agente; si no, un intérprete de reglas registra jornadas, diésel y fallas, abre OTs y avisa al jefe de taller |

- **Datos:** `localStorage` (`pf-taller-v1`), con datos de ejemplo; «Reiniciar demo» los restaura. Pendiente: tablas en MySQL y rutas en la API.
- **GPS:** en Tablero → Flota se vincula cada tractor con su dispositivo de Traccar; si la posición trae `attributes.hours`, el horómetro toma esa lectura cuando es mayor.
- **assistant-ui (real):** el chat de Automatización es React 19 + `@assistant-ui/react` 0.15 (primitivos `Thread`, `Message`, `Composer`, `ActionBar`,
  `Suggestion` y Markdown), con `useExternalStoreRuntime`: los mensajes y las reglas siguen en `taller.js` y el componente solo los pinta.
  Fuente en `chat-ui/` (`npm install`, `npm run build` → `panelpack/assets/taller-chat.js`, ~720 KB, se descarga solo al abrir Automatización).
  Son dos hilos: el **chat del operador** (con sugerencias y compositor) y los **Avisos del taller** al jefe (solo lectura, con botones
  «Aprobar compra», «Registrar llegada» y «Ver OT»). Puente: `window.__taller.chat` (`snapshot`, `avisos`, `subscribe`, `send`, `action`).
  Si `taller-chat.js` no carga, quedan los dos hilos en HTML de antes.
  **Después de editar `chat-ui/src/` hay que correr `npm run build`**; el `.js` compilado es el que se publica.
- **CSS:** el bundle trae `.info{opacity:0}`; por eso las etiquetas del taller usan clases `p-ok`, `p-info`, etc.
