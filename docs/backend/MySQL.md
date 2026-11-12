# Conectar la API del panel a MySQL

La API (`panel-flota-api/`) guarda en MySQL lo propio del panel: cuentas, sesiones, ajustes de tractores y lotes, historial de combustible y velocidad. Traccar sigue siendo la fuente de posiciones en vivo.

Hay dos modos de correr la API:

| Modo | Comando | Datos |
|---|---|---|
| **Memoria** (sin MySQL) | `npm run dev:memory` | Se borran al reiniciar. Sirve para probar pantallas |
| **MySQL** | `npm start` (o `npm run dev`) | Se conservan. Es el modo de producción |

Las tablas se crean solas al arrancar: `users`, `sessions`, `password_resets`, `login_log`, `device_settings`, `fence_settings`, `oauth_accounts`, `user_photos` y `position_samples`. No hay que importar ningún `.sql`.

---

## Lo que ya trae el repo (`panel-flota-agents/`)

La carpeta `panel-flota-agents/` (servicio de agentes, puerto 3100) **comparte la misma base MySQL** que la API y ya incluye casi todo:

| Archivo | Para qué sirve |
|---|---|
| `panel-flota-agents/scripts/setup-mysql-local.sh` | Prepara MySQL **local en Linux/WSL**: crea la base `panel_flota`, el usuario `panel_api` (permisos completos, para la API) y `agents_ro` (solo `SELECT`, para el MCP de agentes). Genera contraseñas al azar y las escribe en `panel-flota-api/.env` y `panel-flota-agents/.env`. Se puede repetir: no borra datos |
| `panel-flota-agents/sql/001_agentes.sql` | Tablas de los agentes: `ranchos`, `lotes`, `equipos`, `implementos`, `operadores`, `plan_mantenimiento`, `asignaciones`, `agent_roles`, `agent_usage_log` |
| `panel-flota-agents/scripts/check-db.mjs` | `npm run check:db` en `panel-flota-agents/`: conecta, crea las tablas y cuenta filas |
| `panel-flota-agents/scripts/sync-equipos-traccar.mjs` | `npm run sync:equipos` / `sync:equipos:traccar`: crea en `equipos` un registro por tractor |

Con esto, el orden recomendado es:

```bash
bash panel-flota-agents/scripts/setup-mysql-local.sh      # una vez (pide sudo para entrar a MySQL)
cd panel-flota-api && npm run check:db        # la API: tablas del panel
cd ../panel-flota-agents && npm run check:db              # agentes: tablas de panel-flota-agents/sql
cd ../panel-flota-api && npm start            # API en modo MySQL
```

> El script usa `sudo`, `sed` y `openssl`: corre en Linux o WSL. En Windows sin WSL **no funciona tal cual**; instala MySQL (Opción A, paso 1) y ejecuta a mano el SQL del paso 2 (puedes usar los mismos nombres: base `panel_flota`, usuario `panel_api`, y `agents_ro` con `GRANT SELECT`). Los valores `DB_*` que ya estén en el `.env` valen mientras coincidan con lo que crees.
>
> Si tu `.env` ya tiene `DB_USER=panel_api` y `DB_NAME=panel_flota` pero `check:db` dice `ECONNREFUSED`, MySQL no está corriendo en **esta** máquina (el script lo habrá preparado en otra).

---

## Levantar MySQL (instalar y encender el servicio)

Elige tu sistema. Después de encenderlo, comprueba que escucha en el puerto 3306 y sigue con «Crear la base y un usuario».

### Linux (Ubuntu / Debian)

```bash
sudo apt update && sudo apt install -y mysql-server
sudo systemctl enable --now mysql      # enciende ahora y en cada arranque
sudo systemctl status mysql            # debe decir "active (running)"
```

Otros comandos: `sudo systemctl stop mysql`, `sudo systemctl restart mysql`.

- **Fedora / RHEL / Rocky:** `sudo dnf install -y mysql-server` y el servicio se llama `mysqld` (`sudo systemctl enable --now mysqld`).
- **WSL sin systemd:** `sudo service mysql start` (y `sudo service mysql status`). Si `localhost:3306` no responde desde Windows, reinicia WSL con `wsl --shutdown`.
- **Verificar el puerto:** `ss -ltnp | grep 3306`
- **Entrar a la consola:** `sudo mysql` (usa el socket de `root`, sin contraseña).
- Para dejar todo listo de una vez (base, usuarios y `.env`): `bash panel-flota-agents/scripts/setup-mysql-local.sh`.

### Windows

**Con MySQL Installer (recomendado)**

1. Descarga **MySQL Installer** desde mysql.com/downloads/installer, o instala con winget:
   ```powershell
   winget install Oracle.MySQL
   ```
2. En el instalador elige «Server only», deja el puerto `3306` y define la contraseña de `root` (anótala).
3. Marca «Start the MySQL Server at System Startup» para que arranque con Windows.
4. Administra el servicio desde **PowerShell como administrador** (el nombre suele ser `MySQL80`, o `MySQL84` si instalaste la 8.4; confírmalo con `Get-Service MySQL*`):
   ```powershell
   Get-Service MySQL*              # estado
   Start-Service MySQL80           # encender
   Stop-Service MySQL80            # apagar
   Restart-Service MySQL80         # reiniciar
   ```
5. Verifica el puerto: `Get-NetTCPConnection -LocalPort 3306 -State Listen`
6. Entra a la consola. Si PowerShell dice que `mysql` no se reconoce, el instalador no lo agregó al `PATH`: usa la ruta completa
   (`& "C:\Program Files\MySQL\MySQL Server 8.4\bin\mysql.exe" -u root -p`; cambia `8.4` por tu versión) o agrega esa carpeta `bin` al `PATH`:
   ```powershell
   mysql -u root -p
   ```

**Con XAMPP:** abre el *XAMPP Control Panel* y pulsa **Start** en «MySQL» (usa MariaDB, compatible). El usuario `root` viene sin contraseña: créale una o crea tu propio usuario antes de usarlo.

**Con WSL:** instala una distribución (`wsl --install -d Ubuntu`), entra a ella y sigue la sección de Linux. El script `setup-mysql-local.sh` corre ahí.

### Linux o Windows con Docker (igual en ambos)

Con Docker no instalas nada en el sistema y los datos quedan en un volumen. Guarda esto como `docker-compose.yml` (fuera de git) o usa el `docker run` de abajo:

```yaml
services:
  mysql:
    image: mysql:8
    restart: unless-stopped
    ports: ["3306:3306"]
    environment:
      MYSQL_ROOT_PASSWORD: cambia_esto
      MYSQL_DATABASE: panel_flota
      MYSQL_USER: panel_api
      MYSQL_PASSWORD: una_contraseña_larga
    volumes: ["panel_mysql:/var/lib/mysql"]
volumes:
  panel_mysql:
```

```bash
docker compose up -d            # levantar
docker compose logs -f mysql    # ver el arranque (espera "ready for connections")
docker compose stop             # apagar (los datos se conservan)
docker compose down             # quitar el contenedor (el volumen sigue)
```

Con esa configuración la base `panel_flota` y el usuario `panel_api` ya existen; solo falta darle `SELECT` al usuario de agentes si lo vas a usar:

```bash
docker compose exec mysql mysql -uroot -p -e "CREATE USER 'agents_ro'@'%' IDENTIFIED BY 'otra_contraseña'; GRANT SELECT ON panel_flota.* TO 'agents_ro'@'%';"
```

### Comprobar que todo responde

```bash
mysql -u panel_api -p panel_flota -e "SELECT 1"     # entra con el usuario de la API
cd panel-flota-api && npm run check:db              # la API puede conectarse y crear tablas
```

---

## Requisitos

- Node.js 18 o superior (en desarrollo se usa Node 24).
- **MySQL 8** (o MariaDB compatible).
- Una base de datos vacía, un usuario y su contraseña.

---

## Opción A: MySQL en tu computadora (desarrollo)

### 1. Instalar MySQL

- Windows: **MySQL Installer** (mysql.com/downloads/installer) → «Server only» o «Developer Default». Anota la contraseña de `root`.
- Alternativa más simple: **XAMPP** (MariaDB) o **Docker**:
  ```bash
  docker run -d --name panel-mysql -p 3306:3306 -e MYSQL_ROOT_PASSWORD=cambia_esto -e MYSQL_DATABASE=panel_flota mysql:8
  ```

Comprueba que el servicio está encendido y escucha en el puerto 3306:

```powershell
Get-NetTCPConnection -LocalPort 3306 -State Listen
```

### 2. Crear la base y un usuario

Desde MySQL Workbench, `mysql -u root -p` o phpMyAdmin:

```sql
CREATE DATABASE panel_flota CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'panel'@'localhost' IDENTIFIED BY 'una_contraseña_larga';
GRANT ALL PRIVILEGES ON panel_flota.* TO 'panel'@'localhost';
FLUSH PRIVILEGES;
```

No uses `root` en la API: crea un usuario con permisos solo sobre esa base.

### 3. Llenar el `.env`

```bash
cd panel-flota-api
cp .env.example .env        # en PowerShell: Copy-Item .env.example .env
```

Variables de base de datos:

```
DB_HOST=localhost
DB_PORT=3306
DB_USER=panel
DB_PASSWORD=una_contraseña_larga
DB_NAME=panel_flota
```

También se aceptan estos nombres equivalentes (sin importar mayúsculas): `host_database`, `port_database`, `user_database`, `password_database`, `name_database`. Si defines las dos formas, gana `DB_*`.

> El `.env` **nunca** se sube a git ni se comparte.

### 4. Probar la conexión

```bash
npm install
npm run check:db
```

`check:db` se conecta, prueba cada consulta y **no deja datos**. Si falla, revisa la sección «Problemas comunes».

### 5. Arrancar en modo MySQL

Si tenías corriendo el modo memoria, deténlo primero (comparte el puerto 3000):

```powershell
Get-NetTCPConnection -LocalPort 3000 -State Listen | Select-Object OwningProcess
Stop-Process -Id <ese_número>
```

Luego:

```bash
npm start                    # http://localhost:3000/api/panel/health
```

En la primera ejecución verás que crea las tablas. Verifica:

```bash
curl http://localhost:3000/api/panel/health
```

### 6. Crear la cuenta administradora

Abre el panel (`http://localhost:5174/`) y **regístrate tú primero**: la primera cuenta que se registra en la API queda como **super administradora**. Las demás cuentas quedan **pendientes** y no ven nada hasta que tú les asignes un rol (ver «Roles y cuentas pendientes»). También sirve entrar con Google (ver más abajo).

> Las cuentas creadas en modo memoria no pasan a MySQL. Hay que registrarse de nuevo.

---

## Opción B: Hostinger (producción)

1. **Base de datos:** hPanel → Bases de datos → Administración de MySQL. Crea base, usuario y contraseña. Anota los tres y el host (normalmente `localhost`).
2. **Aplicación Node.js:** hPanel → Sitios web → (tu dominio) → Node.js → crea la aplicación.
   - Versión de Node: 18 o superior.
   - Archivo de entrada: `server.js` (no lo cambies).
   - Sube el contenido de `panel-flota-api/` **sin** `node_modules` ni `.env` y pulsa «Ejecutar NPM Install».
3. **Variables de entorno** (en la misma pantalla o en un `.env` que no se comparta):

   | Variable | Valor |
   |---|---|
   | `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | los de tu base |
   | `NODE_ENV` | `production` |
   | `ALLOWED_ORIGINS` | `https://panelpack.buildwiselabs.net` |
   | `PUBLIC_API_URL` | `https://api-panelpack.buildwiselabs.net` |
   | `PANEL_URL` | `https://panelpack.buildwiselabs.net` |
   | `INGEST_KEY` | una clave larga y secreta (para enviar historial desde Traccar) |
   | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | ver «Acceso con Google» |

4. **Dirección de la API:** usa un subdominio del mismo dominio que el panel (por ejemplo `api-panelpack.buildwiselabs.net` junto a `panelpack.buildwiselabs.net`). Así la cookie de sesión funciona sin configuración extra (`SameSite=Lax`).
5. **Compilar el panel** apuntando a esa API: `VITE_PANEL_API_URL=https://api-panelpack.buildwiselabs.net` (ver el README del panel).
6. Reinicia la aplicación, abre el panel y **registra primero tu cuenta** (queda como super administradora). Las demás personas se registran, quedan pendientes y tú les asignas rol (ver «Roles y cuentas pendientes»).

---

## Roles y cuentas pendientes

Los roles viven en `users.role` (`VARCHAR(30)`) y sus permisos en `panel-flota-api/src/roles.mjs`. Para agregar un rol basta una línea ahí; no hay que tocar MySQL.

| Rol | Pantalla | Puede |
|---|---|---|
| `super_admin` | **Todo**: panel completo `/`, bot `/bot/` y Accounts | Todo: cuentas, roles, invitaciones, bitácora y ajustes de tractores y lotes |
| `admin` | **Supervisión** (ERP): Resumen, Tractores, Costeo de diésel, Informes y Taller | **Solo lectura**: la API rechaza cualquier escritura (403 con `readOnly: true`) salvo cerrar su sesión y editar su propio perfil |
| `jefe_taller` | **Taller** (ERP): Tablero, Órdenes de trabajo, Almacén y Costos y KPIs | Capturar y editar en el Taller |
| `operador` | Solo el bot `/bot/` | Consultar, preguntar y agregar |
| `pendiente` | Nada | Solo ver su sesión y cerrarla, hasta que un super administrador le asigne rol |

Permisos que devuelve `/session` (`permissions`): `panel_completo`, `usuarios`, `supervision`, `ver_taller`, `editar_taller`, `combustible`, `bot`, `ajustes_tractores`, `ajustes_lotes`.
Los roles y sus permisos están en `panel-flota-api/src/roles.mjs`; en el código solo hay roles, nunca nombres de personas.

### Migración de una base que ya tenía cuentas

Al arrancar, la API aplica sola:

```sql
ALTER TABLE users MODIFY role VARCHAR(30) NOT NULL DEFAULT 'pendiente';   -- antes ENUM('admin','user'); repetible
CREATE TABLE IF NOT EXISTS invitations (...);                             -- repetible; ver schema.sql
-- Una sola vez (se anota en schema_migrations, '2026-11-12-roles-super-admin'):
UPDATE users SET role = 'super_admin' WHERE role = 'admin';
UPDATE users SET role = 'jefe_taller' WHERE role = 'jefe_almacen';
UPDATE users SET role = 'operador'    WHERE role IN ('supervisor', 'user');
```

**Ojo:** el `admin` de siempre pasa a `super_admin`, y a partir de ahí `admin` significa «solo lectura». Por eso esa parte corre **una sola vez**: reiniciar la API después no vuelve a ascender a nadie. Si importas `schema.sql` a mano en phpMyAdmin, el `UPDATE` de roles no va ahí; lo aplica la API la primera vez que arranca. **Antes de producción** prueba la migración con una copia de la base y corre `npm run check:db`.

### Flujo normal: registro abierto y el super administrador asigna el rol

1. La persona se registra en el panel (correo o Google). Su cuenta queda con rol `pendiente`: entra, pero la API le responde 403 con `pending: true` en todo lo demás, y `/session` trae `pending: true` y `permissions: []`. El panel y el bot le muestran «Tu cuenta está pendiente de aprobación».
2. El super administrador ve la cuenta en Accounts (o `GET /api/panel/users`) y le asigna el rol: `PATCH /api/panel/users/:id/role` con `{ "role": "jefe_taller" }`. La **primera** cuenta que se registra en una base vacía queda como `super_admin`.
3. En su siguiente petición ya tiene los permisos de ese rol, y «Revisar de nuevo» en la pantalla de pendiente la deja entrar. Para quitarle el acceso, vuelve a ponerle `pendiente`.

### Invitaciones (opcional)

Para que alguien entre ya con su rol, sin esperar: `POST /api/panel/invitations` con `{ "email": "...", "role": "operador" }` (no acepta `pendiente`). La respuesta trae `link` y `token` (vale 7 días, un solo uso, solo para ese correo; en MySQL queda solo el hash). La persona se registra enviando también `invite`, o entra con Google si su correo fue invitado. Se consultan con `GET /invitations` y se cancelan con `DELETE /invitations/:id`.

### Qué pantalla ve cada rol (reconstrucción `2026-11-10_fuente`)

`vistaDe()` (`src/lib/roles.js`) decide por permisos: `panel` (super_admin), `erp` (admin y jefe_taller, `src/erp/`), `bot` (operador, se le manda a `/bot/`) o `pendiente`. La pantalla ERP tiene barra lateral de módulos, ruta de navegación y, para `admin`, la etiqueta «Solo lectura»; reutiliza las páginas Tractores, Costeo de diésel, Informes y Taller. En solo lectura el taller ignora cualquier captura (`mutate` en `taller/useTaller.js`) y la API bloquea las escrituras. Solo la reconstrucción; el bundle oficial `2026-11-07_recuperado` no se tocó.

> **Límite conocido:** los datos del Taller (órdenes, almacén, costos) viven en el `localStorage` de cada navegador (`pf-taller-v1`), no en MySQL. Por eso lo que capture el jefe de taller **no lo ve el admin desde otro equipo**. Para que la supervisión sea real hay que llevar el Taller a tablas de la API (ordenes, almacén, costos) con las mismas reglas de rol.

---

## Conectar el panel (frontend) a la API

En `versiones/nuevas/2026-11-10_fuente/.env`:

```
VITE_PANEL_API_URL=same-origin
```

- **`same-origin`** (desarrollo): el panel llama a `/api/panel` en su misma dirección y Vite lo reenvía a `http://localhost:3000` (variable `PANEL_PROXY` si la API está en otro lado).
- **Vacío**: el panel usa datos simulados y **no** conoce cuentas, Google ni foto de perfil.
- Una URL completa (`https://api-...`): para producción.

Después de cambiar un `.env` de Vite hay que **reiniciar** `npm run dev`.

Valores de la API para desarrollo (`panel-flota-api/.env`):

```
PUBLIC_API_URL=http://localhost:3000
PANEL_URL=http://localhost:5174
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:5174
```

`PANEL_URL` es a donde regresa Google después de entrar: debe ser el puerto donde abres el panel. Reinicia la API al cambiarlo (lee el `.env` solo al arrancar).

---

## Acceso con Google

La API hace el flujo OAuth y crea la cuenta en MySQL (sin contraseña; solo entra por Google). Solo acepta correos verificados. Cada acceso queda en `oauth_accounts` con el id estable del proveedor, así que si cambias de correo en Google sigues entrando a la misma cuenta.

1. En Google Cloud → APIs y servicios → Credenciales: crea un **ID de cliente OAuth** (aplicación web).
2. Agrega como **URI de redireccionamiento autorizada**, exactamente:
   - Desarrollo: `http://localhost:3000/api/panel/auth/google/callback`
   - Producción: `https://api-panelpack.buildwiselabs.net/api/panel/auth/google/callback`
3. Pon `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` en el `.env` de la API y reinicia.
4. Si la app está en modo «Prueba», agrega tu correo en «Usuarios de prueba» de la pantalla de consentimiento.
5. Comprueba que está activo:
   ```bash
   curl http://localhost:3000/api/panel/auth/providers      # {"google":true,"apple":false}
   ```

El panel y el bot (`/bot/`) muestran el botón activo solo si ese endpoint dice `true`. Desde el bot se entra con `?volver=bot` y la API te regresa a `/bot/` (no al panel).

### Apple (próximamente)

Requiere cuenta Apple Developer y **HTTPS** (Apple no acepta `http://localhost`). Variables: `APPLE_CLIENT_ID` (Services ID), `APPLE_TEAM_ID`, `APPLE_KEY_ID` y `APPLE_PRIVATE_KEY` (el `.p8` en una línea con `\n`). Return URL: `https://TU-DOMINIO-API/api/panel/auth/apple/callback`. Mientras falten, el panel y el bot muestran «Próximamente».

---

## Enviar historial de Traccar (opcional)

Con `INGEST_KEY` definida, cualquier proceso puede enviar posiciones:

```bash
curl -X POST "$API/api/panel/samples" -H "X-Ingest-Key: $INGEST_KEY" -H "Content-Type: application/json" \
  -d '{"samples":[{"deviceId":12,"fixTime":"2026-11-04T15:00:00Z","latitude":23.0,"longitude":-105.9,"speed":3,"fuel":200,"ignition":true}]}'
```

O deja corriendo `npm run sync:traccar`, que copia `/api/positions` de Traccar cada minuto (variables `TRACCAR_URL`, `TRACCAR_EMAIL`, `TRACCAR_PASSWORD`, `PANEL_API_URL`, `INGEST_KEY`).

---

## Lista de verificación

- [ ] El servicio MySQL está encendido (puerto 3306).
- [ ] Existen la base y el usuario con permisos sobre esa base.
- [ ] `DB_*` del `.env` coinciden.
- [ ] `npm run check:db` termina sin errores.
- [ ] La API corre con `npm start` (no `dev:memory`) y `/api/panel/health` responde.
- [ ] `VITE_PANEL_API_URL=same-origin` y Vite reiniciado.
- [ ] Te registraste primero (cuenta administradora).
- [ ] Si la base ya tenía cuentas: la migración de roles se probó en una copia (`user` → `operador`).
- [ ] Cada cuenta nueva se revisó y se le asignó rol (`PATCH /users/:id/role`); las que siguen en `pendiente` no ven nada.
- [ ] `/api/panel/auth/providers` dice `"google":true` si usas Google.

---

## Problemas comunes

| Síntoma | Causa y solución |
|---|---|
| `ECONNREFUSED` en `check:db` | MySQL apagado o puerto/host incorrectos. Enciende el servicio y revisa `DB_HOST` y `DB_PORT` |
| `Access denied for user` | Usuario o contraseña mal, o el usuario no tiene permisos sobre esa base (repite el `GRANT`) |
| `Unknown database` | No creaste la base, o `DB_NAME` está mal escrito |
| `EADDRINUSE` puerto 3000 | Ya hay otra API corriendo (por ejemplo `dev:memory`). Detén ese proceso |
| Las cuentas desaparecen al reiniciar | Estás en `dev:memory`. Usa `npm start` |
| Google sale «no disponible» | Faltan `GOOGLE_*`, la API no responde, o `VITE_PANEL_API_URL` está vacío. Revisa `/auth/providers` |
| `redirect_uri_mismatch` de Google | La URI registrada no coincide exacta con `PUBLIC_API_URL` + `/api/panel/auth/google/callback` |
| Google regresa al panel y no al bot | `PANEL_URL` apunta a otro puerto, o la API no se reinició |
| Tras entrar con Google no queda sesión | Revisa `ALLOWED_ORIGINS`/`PANEL_URL` y que API y panel compartan dominio (en local, ambos `localhost`) |
| «Tu cuenta está pendiente de aprobación» (403, `pending: true`) | La cuenta aún no tiene rol. El administrador la asigna con `PATCH /users/:id/role` |
| «La invitación no es válida para este correo» al registrarse | El `invite` enviado venció (7 días), ya se usó o es de otro correo. Sin `invite` el registro funciona y queda pendiente |
| «Tu rol no tiene permiso para esto» (403) | El rol de la cuenta no incluye esa acción. Cambia el rol con `PATCH /users/:id/role` |
| El correo de recuperar contraseña no llega | Aún no se envía: el token se escribe en la bitácora del servidor (`[recuperar] correo: token …`). Falta configurar SMTP |

## Pendientes conocidos

- **Correo de recuperación:** falta configurar SMTP.
- **Límite de intentos** de acceso: vive en memoria y se reinicia con la aplicación.
- Las consultas SQL se verifican con `npm run check:db` contra una base real; las pruebas automáticas (`npm test`) usan una capa de datos en memoria y no necesitan MySQL.

Más detalle de rutas y despliegue: `panel-flota-api/README.md`.
