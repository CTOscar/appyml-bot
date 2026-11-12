# Apps instalables del bot («Agente agrícola · Las Cabras»)

El bot (`/bot/`) se empaqueta como app de escritorio (Electron) y de Android (Capacitor). Las dos cargan **el mismo build** (`apps/web`, solo el bot) y hablan con las APIs fijadas en `apps/config.json`
(`api-panelpack.buildwiselabs.net` para cuentas; `api-agentes.buildwiselabs.net` para el chat con IA, **supuesto**: cámbialo si publicas el servicio en otra dirección).

| Carpeta | Qué es |
|---|---|
| `config.json` | Nombre, appId, versión y servidores (se «hornean» al compilar) |
| `build-web.mjs` | `npm run apps:web` → compila solo el bot a `apps/web/` |
| `desktop/` | Electron 45 + electron-builder. Protocolo propio `app://local/`, sandbox y CSP |
| `android/` | Capacitor 6 (JDK 17, compileSdk 34). Cookies/HTTP nativos para la API entre sitios |
| `make-manifest.mjs` | `npm run apps:manifest` → copia `apps/release/**` a `public/descargas/` y escribe `manifest.json` (tamaño y SHA-256) |
| `release/` | Salida de los instaladores (no se sube a git) |

La página **Aplicaciones** del panel (`#/apps`) lee `public/descargas/manifest.json` y recomienda el archivo según el equipo.

## Compilar en esta máquina (Windows)

```bash
npm run apps:web
cd apps/desktop && npm install
npm run dist:win:local      # portable x64 + instalador arm64 (el NSIS x64 falla local, ver Limitaciones)
npm run dist:linux:local    # .tar.gz x64 y arm64
cd ../android && npm install && npx cap sync android
cd android && gradlew.bat assembleRelease   # requiere JAVA_HOME=JDK 17, ANDROID_HOME y apps/android/keystore.properties
cd ../../.. && npm run apps:manifest
```

Entorno usado: JDK 17 en `E:\dev\jdk17`, Android SDK en `E:\dev\android-sdk`, Gradle en `E:\dev\gradle`. La llave de firma del APK vive **fuera del repo** (`E:\dev\keys\`; respáldala: sin ella no se pueden publicar actualizaciones sobre la misma instalación).

## Compilar todo en la nube

`.github/workflows/apps.yml` (Actions → Instaladores): NSIS x64/arm64, AppImage/deb/rpm x64/arm64 y APK. Secretos opcionales: `WIN_CSC_LINK`, `WIN_CSC_KEY_PASSWORD`, `ANDROID_KEYSTORE_B64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`.

## API: apps instaladas

Las apps llaman a la API desde otro sitio (`app://local` en escritorio, `https://localhost` en Android). En `panel-flota-api` define:

- `ALLOWED_ORIGINS=https://panelpack.buildwiselabs.net,app://local,https://localhost`
- `COOKIE_SAMESITE=none` (cookie `SameSite=None; Secure`; exige HTTPS). Con el valor por defecto (`lax`) el panel web sigue igual, pero las apps no conservarán la sesión.

## Limitaciones (dilas antes de publicar)

- **Windows sin firma digital:** el .exe sale sin firmar. SmartScreen avisa y «Smart App Control» (Windows 11) lo **bloquea**. Para distribuir hace falta un certificado de firma de código (`WIN_CSC_*`).
- El NSIS x64 no se pudo generar en esta máquina (Smart App Control bloquea el proceso del empaquetador): se entrega portable x64 localmente y el NSIS x64 sale del workflow.
- AppImage/deb/rpm solo se compilan en Linux (CI). Localmente hay `.tar.gz`.
- No hay build de Electron para Windows de 32 bits (ia32).
- El APK no viene de Play Store: Android pedirá permitir instalar de origen desconocido.
- Ninguno se ha probado en equipos reales (solo arranque de Electron en esta máquina y verificación de firma del APK con `apksigner`).
- Correo de mantenimiento de los paquetes Linux: `contacto@buildwiselabs.net` (provisional).
