# Servicio de agentes (Prototipo 1)

Servicio Node aparte de `panel-flota-api`. Comparte **la misma base MySQL** y valida la sesión contra la API del panel.
Diseño completo: `docs/agentes/prototipo-agentes.txt`. Diagrama de datos: `docs/diagramas/prototipov1-panelpack-las-cabras.jpeg`.

## Estado

| Pieza | Estado |
|---|---|
| Bot_Campo (Haiku) | Hecho, solo lectura |
| MCP Fleet-DB | `leer_catalogo`, `leer_telemetria_actual`, `mi_asignacion` (ninguna escribe) |
| Router por rol | Hecho. El rol manda sobre el canal |
| Log de tokens | `agent_usage_log`, un registro por consulta |
| Bot_Taller (Sonnet), Bot_Estrategia (Opus) | Pendientes: `/chat` responde 501 para esos roles |
| MCP Telemetry-IoT, Python-Sandbox, Docs-Flows | Pendientes |
| `crear_checklist`, `reportar_falla` | Pendientes (Paso 4) |
| `agentes.html` en el panel | Pendiente |

## Arrancar

```bash
cd agents
cp .env.example .env     # DB_*, ANTHROPIC_API_KEY, PANEL_API_URL
npm install
npm test                 # 25 pruebas, sin MySQL ni llamadas a Claude
npm run check:db         # conecta, crea las tablas y cuenta filas
npm run sync:equipos     # crea en `equipos` un registro por cada tractor de device_settings
npm start                # http://localhost:3100/health
```

## Desarrollo local: base real o en memoria

Hay dos formas de correr la API del panel en tu computadora. Elige según lo que pruebes:

| Modo | Comando (en `panel-flota-api/`) | Datos | Cuándo usarlo |
|---|---|---|---|
| En memoria | `npm run dev:memory` | Se pierden al detenerla. Ignora MySQL. | Desarrollar el panel (simulado) sin tocar la base |
| MySQL real | `npm start` | Se guardan en `panel_flota` | Probar los agentes, el login real y el historial |

- La base real arranca **sin cuentas**: la primera que se registra queda como administradora. Las cuentas del modo memoria no pasan a MySQL.
- El panel simulado (`VITE_USE_MOCK=true`) no usa Traccar ni MySQL; no cambia por nada de esto.
- Preparar MySQL local: `bash panel-flota-agents/scripts/setup-mysql-local.sh` (crea la base `panel_flota`, el usuario de la API y `agents_ro`, de solo lectura, y escribe las contraseñas en los `.env`).
- Traccar local: se instala con el `traccar.run` oficial y queda en `http://localhost:8082` (rastreadores en el puerto 5027). Con IMEI de prueba (`99000000000000N`) los dispositivos existen pero no reportan posiciones.
- Traer los tractores de Traccar a `equipos`: llena `TRACCAR_URL`, `TRACCAR_EMAIL` y `TRACCAR_PASSWORD` en `panel-flota-agents/.env`; prueba con `npm run sync:equipos:traccar -- --dry` y, si la lista es correcta, sin `--dry`.

## Antes de la primera consulta real

1. `npm run sync:equipos` y completa a mano marca, modelo, IMEI y `sensor_diesel` de cada tractor.
2. Da de alta el operador: `INSERT INTO operadores (user_id, nombre) VALUES (<users.id>, '...')`.
3. Crea una asignación de hoy en `asignaciones` para probar "¿qué tractor tengo?".
4. Asigna el rol: `INSERT INTO agent_roles (user_id, agent_role) VALUES (<users.id>, 'operador')`.
   Sin fila en `agent_roles` se usa Bot_Campo como respaldo. Un administrador puede forzar un agente con `"agent": "campo"`.

## API

| Ruta | Qué hace |
|---|---|
| `GET /health` | público |
| `GET /me` | con cookie de sesión: rol de agente y agente que le toca |
| `POST /chat` | `{ messages: [{role, content}], channel? }` → `{ agent, model, reply, usage }` |

El historial lo manda el panel en cada llamada (máx. 20 mensajes de texto). No se guarda conversación en el servidor.

## Seguridad

- `ANTHROPIC_API_KEY` solo vive aquí.
- El rol sale de `agent_roles` (MySQL), nunca del navegador. La identidad (`userId`) la inyecta el servicio en cada herramienta; el modelo no la ve ni la puede cambiar.
- Cada agente tiene una lista de herramientas permitida, también verificada al ejecutar.
- Recomendado: `MCP_DB_USER` con permiso solo `SELECT`. Así "Opus solo lee" lo impone MySQL y no el prompt.
- Para que la cookie viaje, publica el servicio en un subdominio de `buildwiselabs.net` (ej. `api-agentes.`) y añade el origen del panel a `ALLOWED_ORIGINS`.

## Modelos

Los IDs viven en `.env` (`MODEL_CAMPO`, `MODEL_TALLER`, `MODEL_ESTRATEGIA`). Bot_Campo usa `effort: low` y no envía
`temperature` ni `thinking`, porque Haiku 5.5 rechaza valores de muestreo no estándar.
