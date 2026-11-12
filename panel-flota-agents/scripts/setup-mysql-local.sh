#!/usr/bin/env bash
# Prepara MySQL LOCAL para desarrollo: base `panel_flota`, un usuario con permisos completos para la API (`panel_api`) y uno de SOLO LECTURA
# para el servidor MCP de agentes (`agents_ro`). Genera las contraseñas al azar y las escribe en panel-flota-api/.env y agents/.env
# (ambos ignorados por git). No imprime ninguna contraseña. Se puede repetir: no borra datos.
#
# Uso:   bash agents/scripts/setup-mysql-local.sh        (pide tu contraseña de sudo para entrar a MySQL como administrador)
set -euo pipefail
cd "$(dirname "$0")/../.."
DB=panel_flota
API_USER=panel_api
RO_USER=agents_ro
rand() { openssl rand -base64 24 | tr -d '/+=\n' | cut -c1-24; }

# Si ya hay contraseñas en los .env, se reutilizan (para no romper lo que ya funciona)
getv() { grep -E "^$2=" "$1" 2>/dev/null | head -1 | cut -d= -f2- || true; }
API_PW=$(getv panel-flota-api/.env DB_PASSWORD); API_PW=${API_PW:-$(rand)}
RO_PW=$(getv agents/.env MCP_DB_PASSWORD); RO_PW=${RO_PW:-$(rand)}

SQL=$(cat <<SQL_END
CREATE DATABASE IF NOT EXISTS \`$DB\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '$API_USER'@'localhost' IDENTIFIED BY '$API_PW';
ALTER USER '$API_USER'@'localhost' IDENTIFIED BY '$API_PW';
GRANT ALL PRIVILEGES ON \`$DB\`.* TO '$API_USER'@'localhost';
CREATE USER IF NOT EXISTS '$RO_USER'@'localhost' IDENTIFIED BY '$RO_PW';
ALTER USER '$RO_USER'@'localhost' IDENTIFIED BY '$RO_PW';
GRANT SELECT ON \`$DB\`.* TO '$RO_USER'@'localhost';
FLUSH PRIVILEGES;
SQL_END
)

# Entrada a MySQL como administrador: 1) sudo mysql (socket de root); 2) si MySQL lo niega, usuario y contraseña de administrador (se piden aquí).
echo "Creando base y usuarios en MySQL local…"
if ! { echo "Probando con sudo mysql (pide tu contraseña de sudo)…"; sudo mysql -e "SELECT 1" >/dev/null 2>&1; }; then
  ADMIN=${MYSQL_ADMIN_USER:-root}
  echo "sudo mysql no entró. Se usará el usuario de administrador de MySQL '$ADMIN' (cámbialo con MYSQL_ADMIN_USER=otro). Escribe su contraseña:"
  mysql -u "$ADMIN" -p -e "$SQL"
else
  sudo mysql -e "$SQL"
fi

# Escribe o actualiza una variable KEY=valor dentro de un archivo .env (crea el archivo si no existe)
setv() { local f=$1 k=$2 v=$3; touch "$f"; if grep -qE "^$k=" "$f"; then sed -i "s|^$k=.*|$k=$v|" "$f"; else printf '%s=%s\n' "$k" "$v" >> "$f"; fi; }

[ -f agents/.env ] || cp agents/.env.example agents/.env
for f in panel-flota-api/.env agents/.env; do
  setv "$f" DB_HOST localhost; setv "$f" DB_PORT 3306; setv "$f" DB_NAME "$DB"; setv "$f" DB_USER "$API_USER"; setv "$f" DB_PASSWORD "$API_PW"
done
setv agents/.env MCP_DB_USER "$RO_USER"; setv agents/.env MCP_DB_PASSWORD "$RO_PW"
setv agents/.env PANEL_API_URL "http://localhost:3000/api/panel"
chmod 600 panel-flota-api/.env agents/.env

echo "Listo. Base '$DB'; usuarios '$API_USER' (completo) y '$RO_USER' (solo lectura). Contraseñas guardadas en panel-flota-api/.env y agents/.env."
echo "Siguiente: cd panel-flota-api && npm run check:db   y luego   cd ../agents && npm run check:db"
