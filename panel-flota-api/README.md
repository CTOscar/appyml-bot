# API del panel de flota (Las Cabras)

Backend en Node.js + Express que guarda en **MySQL** lo propio del panel:

| Qué | Tablas |
|---|---|
| Cuentas, perfiles y roles | `users` (contraseñas con scrypt, nunca en claro) |
| Sesiones por cookie | `sessions` |
| Recuperar contraseña | `password_resets` |
| Bitácora de accesos | `login_log` |
| Ajustes de tractores y lotes | `device_settings`, `fence_settings` |
| Correos que entran con Google o Apple (ligados a `users`) | `oauth_accounts` |
| Foto de perfil (una por cuenta) | `user_photos` |
| Historial de combustible y velocidad | `position_samples` |

Traccar sigue siendo la fuente de posiciones en vivo; esta API guarda su historial y todo lo demás.
Las tablas se crean solas al arrancar.

## Probar en tu computadora

```bash
cd Rastreo_medicion/panel-flota-api
cp .env.example .env      # llena DB_USER, DB_PASSWORD, DB_NAME (una base MySQL 8 tuya)
npm install
npm run check:db          # prueba la conexión y cada consulta; no deja datos
npm start                 # http://localhost:3000/api/panel/health
npm test                  # pruebas del resumen de combustible y su ruta (sin necesitar MySQL)
```

## Publicar en Hostinger

1. **Base de datos:** hPanel → Bases de datos → Administración de MySQL → crea base, usuario y contraseña.
   Anota los tres y el host (normalmente `localhost`).
2. **Aplicación Node.js:** hPanel → Sitios web → (tu dominio) → Node.js → crea la aplicación.
   - Versión de Node: 18 o superior. Archivo de entrada: `server.js` (no cambies a otro).
   - Sube el contenido de esta carpeta (sin `node_modules` ni `.env`) y pulsa "Ejecutar NPM Install".
3. **Variables de entorno** (en la misma pantalla o en un `.env` que no se comparta):
   `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `ALLOWED_ORIGINS`, `INGEST_KEY`, `NODE_ENV=production`.
   Para la base también se aceptan estos nombres equivalentes (sin importar mayúsculas):
   `name_database` (= `DB_NAME`), `user_database` (= `DB_USER`), `password_database` (= `DB_PASSWORD`),
   `host_database` (= `DB_HOST`) y `port_database` (= `DB_PORT`). Si defines las dos formas, gana `DB_*`.
4. **Dirección de la API:** usa un subdominio del mismo dominio que el panel, por ejemplo
   `api-panelpack.buildwiselabs.net` junto a `panelpack.buildwiselabs.net`. Así la cookie de sesión
   funciona sin configuración extra (`SameSite=Lax`).
5. Compila el panel con `VITE_PANEL_API_URL=https://api-panelpack.buildwiselabs.net` (ver el README del panel).

La **primera cuenta que se registra queda como super administradora**. Las demás quedan **pendientes** (no ven nada) hasta que el administrador les asigne un rol (ver Roles y cuentas pendientes). Regístrate tú primero.

## Enviar el historial desde Traccar

Con `INGEST_KEY` definida, cualquier proceso puede enviar posiciones:

```bash
curl -X POST "$API/api/panel/samples" -H "X-Ingest-Key: $INGEST_KEY" -H "Content-Type: application/json" \
  -d '{"samples":[{"deviceId":12,"fixTime":"2026-11-04T15:00:00Z","latitude":23.0,"longitude":-105.9,"speed":3,"fuel":200,"ignition":true}]}'
```

O deja corriendo `npm run sync:traccar`, que copia `/api/positions` de Traccar cada minuto
(variables `TRACCAR_URL`, `TRACCAR_EMAIL`, `TRACCAR_PASSWORD`, `PANEL_API_URL`, `INGEST_KEY`).

## Rutas (`/api/panel`)

| Método y ruta | Quién |
|---|---|
| `GET /health` | público |
| `POST /register`, `POST /login`, `DELETE /session`, `GET /session` | público / sesión |
| `PUT /users/:id` (perfil y contraseña) | el dueño o un administrador |

| `GET /users`, `PATCH /users/:id/role`, `GET /login-log`, `GET /oauth-accounts` | super administrador |
| `POST /password/reset`, `POST /password/confirm` | público |
| `GET /auth/providers`, `GET /auth/google`, `GET /auth/apple` (+ `/callback`) | público |
| `GET /users/:id/photo` | sesión |
| `PUT /users/:id/photo`, `DELETE /users/:id/photo` (JPG, PNG o WebP, máx. 400 KB) | el dueño o un administrador |
| `GET /devices`, `GET /fences`, `GET /roles` | sesión |
| `PUT /devices/:id` | super administrador |
| `PUT /fences/:id` | super administrador |
| `GET /invitations`, `POST /invitations`, `DELETE /invitations/:id` | administrador |
| `POST /samples` | clave de envío o sesión |
| `GET /route` | sesión |
| `GET /fuel-events` | super administrador o admin (solo lectura) |
| `GET /fuel-summary?from&to&deviceId=…` (resumen por tractor y día: consumo, cargas, descargas, velocidad y horas; máx. 31 días) | super administrador o admin (solo lectura) |

## Perfil y contraseña

`PUT /users/:id` acepta `name`, `email`, `phone`, `attributes` y, opcional, `password`. Quien cambia **su propia** contraseña debe enviar también `currentPassword`
(si no es correcta responde 403, con límite de 6 intentos cada 15 min). Un administrador puede restablecer la de otra persona sin la actual.
Todo se valida antes de guardar: si la contraseña falla, el nombre y el correo tampoco se cambian. Al cambiarla se cierran las demás sesiones de esa cuenta.
La respuesta (igual que `/session`) incluye `permissions` y `hasPassword`: las cuentas que entran solo con Google/Apple no tienen contraseña y no necesitan la actual.
La foto (`PUT /users/:id/photo`) acepta JPG, PNG o WebP de hasta 400 KB en data URL.

## Roles y cuentas pendientes

Roles (en `src/roles.mjs`; para agregar uno basta una línea ahí; sin nombres de personas): `super_admin`, `admin`, `jefe_taller`, `operador` y `pendiente` (cuenta recién registrada, sin permisos).
Al arrancar, una migración de una sola vez pasa `admin`→`super_admin`, `jefe_almacen`→`jefe_taller` y `supervisor`/`user`→`operador` (tabla `schema_migrations`).

| Rol | Pantalla | Puede |
|---|---|---|
| `super_admin` | **Todo**: panel completo `/`, bot `/bot/` y Accounts | Todo: cuentas, roles, invitaciones, bitácora y ajustes de tractores y lotes |
| `admin` | **Supervisión** (ERP): Resumen, Tractores, Costeo de diésel, Informes y Taller | **Solo lectura**: la API rechaza cualquier escritura (403 con `readOnly: true`) salvo cerrar su sesión y editar su propio perfil |
| `jefe_taller` | **Taller** (ERP): Tablero, Órdenes de trabajo, Almacén y Costos y KPIs | Capturar y editar en el Taller |
| `operador` | Solo el bot `/bot/` | Consultar, preguntar y agregar |
| `pendiente` | Nada | Solo ver su sesión y cerrarla, hasta que un super administrador le asigne rol |

Permisos que devuelve `/session` (`permissions`): `panel_completo`, `usuarios`, `supervision`, `ver_taller`, `editar_taller`, `combustible`, `bot`, `ajustes_tractores`, `ajustes_lotes`.
Los roles y sus permisos están en `panel-flota-api/src/roles.mjs`; en el código solo hay roles, nunca nombres de personas.

Flujo: la persona se registra y queda `pendiente` (la API responde 403 con `pending: true` en todo salvo su sesión); un super administrador le asigna rol con
`PATCH /users/:id/role`. Opcional: `POST /invitations` con `{ email, role }` da un `link` (7 días, un solo uso, solo para ese correo) para entrar ya con rol;
la persona se registra enviando `invite`, o con Google/Apple si su correo fue invitado.

## Acceso con Google y Apple

La API hace el flujo OAuth y crea la cuenta en MySQL (sin contraseña; solo entra por el proveedor). Solo acepta correos verificados.
Cada acceso queda en `oauth_accounts` con el id estable del proveedor (`provider_uid`): si la persona cambia su correo de Google, sigue entrando a la misma cuenta. Si ya había una cuenta del panel con ese correo, se liga a ella (su contraseña sigue sirviendo).
Cada proveedor se activa solo cuando sus variables están completas (ver `.env.example`):

- **Google:** crea un *ID de cliente OAuth* (aplicación web) en Google Cloud y agrega como URI de redireccionamiento
  `https://api-panelpack.buildwiselabs.net/api/panel/auth/google/callback`. Define `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET`.
- **Apple:** requiere cuenta Apple Developer. Crea un *Services ID* con *Sign in with Apple*, dominio `api-panelpack.buildwiselabs.net`
  y Return URL `https://api-panelpack.buildwiselabs.net/api/panel/auth/apple/callback`; crea una clave `.p8`.
  Define `APPLE_CLIENT_ID` (Services ID), `APPLE_TEAM_ID`, `APPLE_KEY_ID` y `APPLE_PRIVATE_KEY`.
- Define también `PUBLIC_API_URL` y `PANEL_URL`.

## Pendientes conocidos

- **Correo de recuperación:** aún no se envía; el token se escribe en la bitácora del servidor
  (`[recuperar] correo: token …`) para que un administrador lo entregue. Falta configurar SMTP.
- **Límite de intentos** de acceso en memoria: se reinicia al reiniciar la aplicación.
- Las consultas SQL se verifican con `npm run check:db` contra una base real; las pruebas automáticas
  usan una capa de datos en memoria.

## Apps instaladas (escritorio y Android)

Las apps del bot llaman a la API desde `app://local` (Electron) o `https://localhost` (Android). Agrega esos orígenes a `ALLOWED_ORIGINS` y define `COOKIE_SAMESITE=none` (cookie `SameSite=None; Secure`, solo HTTPS). Por defecto es `lax`.
