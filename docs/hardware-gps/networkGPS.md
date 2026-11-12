# networkGPS: conectar los FMC650 con Traccar local

Guía para que los rastreadores Teltonika FMC650 lleguen a un Traccar que corre en una PC local.
Ver también `MIGRACION-MOCK-A-GPS.md` y `fmc650-tractor-traccar-configurations-CGNAT.md`.

## 1. Valores en Teltonika Configurator

| Pestaña | Campo | Valor |
|---|---|---|
| System → Data Protocol | Data protocol | **Codec 8 Extended** |
| GPRS → Server settings | Domain | `traccar.buildwiselabs.net` (o la IP pública / dominio DDNS). Sin `http://` y sin puerto |
| GPRS → Server settings | Port | **5027** |
| GPRS → Server settings | Protocol | **TCP** |
| GPRS → Cellular | APN | El del chip. Telcel: `internet.itelcel.com`. AT&T: `att.mx`. Confirmar con el proveedor |
| GPRS → Cellular | APN user / password | Normalmente vacíos |

En Traccar, registrar cada dispositivo con su **IMEI** como identificador. Si no, descarta los datos.

## 2. Camino de los datos

```
FMC650 → red celular → internet → IP pública → router (port forwarding 5027) → PC con Traccar
```

El GPS manda TCP crudo, no HTTP. Cloudflare Tunnel no sirve para el puerto 5027.

## 3. Revisar si hay IP pública (CGNAT)

1. Ver la IP WAN en la administración del router.
2. Compararla con la que muestra https://ifconfig.me.
3. **Coinciden:** hay IP pública, seguir al punto 4.
4. **No coinciden**, o la WAN empieza con `100.64`–`100.127`, `10.x` o `192.168.x`: hay CGNAT.
   El port forwarding no funcionará. Opciones:
   - Pedir al ISP una IP pública.
   - VPS pequeño con túnel frp (ver `fmc650-tractor-traccar-configurations-CGNAT.md`).

## 4. Abrir el puerto 5027 hacia la PC

1. Dejar la PC con IP fija local (por ejemplo `192.168.1.50`) o reservarla por DHCP en el router.
2. En el router, port forwarding: externo `5027` → IP de la PC, interno `5027`, TCP (y UDP opcional).
3. Firewall de la PC:
   - Linux: `sudo ufw allow 5027/tcp`
   - Windows: regla de entrada para el puerto 5027.
4. Probar desde fuera (datos del celular, sin WiFi) en https://canyouseeme.org, puerto 5027, con Traccar encendido.

## 5. Entrar al router (si la página no abre)

1. Averiguar el gateway real:
   ```bash
   ip route | grep default
   ```
   La IP después de `via` es la del router (`192.168.1.1`, `192.168.0.1`, `10.0.0.1`, etc.).
2. Abrir `http://IP-GATEWAY` con `http://`, no `https://`.
3. Si no abre:
   - `ping IP-GATEWAY`. Si no responde, desactivar VPN o revisar que se esté en la red del router.
   - Quitar proxies del navegador y del sistema.
   - Probar otro navegador, ventana privada o `curl -I http://IP-GATEWAY`.
   - Probar `http://IP-GATEWAY:8080`.
   - Routers de proveedor (Telmex/Infinitum, Izzi, Totalplay): la administración puede estar limitada o solo en la app. Las credenciales vienen en la etiqueta del equipo.
   - Si hay dos routers en cadena, abrir el puerto en ambos.
4. Si no se puede entrar al router, pedir al ISP que abra el 5027 hacia la PC, o usar el VPS con frp.

## 6. DNS en Hostinger para `traccar.buildwiselabs.net`

Solo se crea un registro DNS. No se crea desde "Subdominios" del hosting compartido, porque eso lo ligaría a una carpeta web.

hPanel → Dominios → `buildwiselabs.net` → Registros DNS.

| IP pública | Registro |
|---|---|
| Fija | Tipo **A**, nombre `traccar`, apunta a la IP pública, TTL 300–3600 |
| Dinámica (lo normal) | Crear un dominio DDNS (DuckDNS, No-IP) y un registro **CNAME** `traccar` → `tunombre.duckdns.org` |

Comprobar: `nslookup traccar.buildwiselabs.net` debe devolver la IP. Mientras propaga el DNS, se puede poner la IP directa en el Configurator.

## 7. Verificación

- En Traccar, revisar `logs/tracker-server.log`: debe aparecer la conexión del IMEI.
- El dispositivo debe pasar a "en línea" en la interfaz de Traccar (puerto 8082).

## 8. Bitácora de la configuración (estado actual)

Fecha de inicio: 2026-11-11.

| Dato | Valor | Nota |
|---|---|---|
| Equipo GPS | Teltonika FMC650 | Configurator pide Domain y Port en GPRS |
| Servidor Traccar | PC local | No hay VPS |
| Dominio previsto | `traccar.buildwiselabs.net` | Aún sin crear el registro DNS en Hostinger |
| IP pública observada | `189.204.180.242` | Rango público, fuera de CGNAT. Falta confirmar que sea la IP WAN del router y no solo la de salida |
| Interfaz de red de la PC | `enp2s0` (cable) | |
| IP de la PC (DHCP) | `192.168.34.161` | Falta fijarla o reservarla |
| Gateway / router | `192.168.34.1` | Comando: `ip route \| grep default` |

### Pasos hechos
1. Se definieron los valores del Configurator: Codec 8 Extended, puerto 5027, TCP.
2. Se explicó que el subdominio en Hostinger es solo un registro DNS (A o CNAME) y que el hosting compartido no sirve para Traccar.
3. Se identificó que, con Traccar local, el GPS debe llegar por internet a la PC. Eso requiere IP pública (sin CGNAT) y port forwarding.
4. La página del router no abría. Se obtuvo el gateway real: `192.168.34.1`.
5. La IP `189.204.180.242` es pública y no está en rangos de CGNAT.

### Diagnóstico desde la PC (2026-11-11)

| Prueba | Resultado |
|---|---|
| `ping 192.168.34.1` | Responde, 0.7 ms, sin pérdida |
| Web del router (80, 443, 8080, 8443, 8000, 8888) | **Ninguno abierto**: el router no ofrece administración web |
| Traccar local (`ss -ltn`) | Escuchando en **5027** (GPS) y **8082** (web) |
| IP pública vista desde internet (`ifconfig.me`) | `189.204.180.240` (antes se anotó `...242`: la IP cambia, probable pool compartido) |
| Ruta a internet (`tracepath 8.8.8.8`) | `192.168.34.1` → **`10.90.0.1`** → **`10.254.0.1`** → `189.202.238.153` → `189.204.204.161` |

Conclusión: entre el router y la salida a internet hay **dos saltos con IP privada (10.x)**.
Con el MTU de 1492 (PPPoE) y la IP pública que cambia, lo más probable es que haya **CGNAT** o red de proveedor que no permite
abrir puertos desde afuera. El port forwarding en el router no serviría. Falta confirmarlo con canyouseeme.org (puerto 5027).
Camino recomendado: pedir al ISP una IP pública, o usar un VPS pequeño con frp.

### Pendiente
- [ ] Abrir `http://192.168.34.1` (con `http://`) y revisar `ping -c 3 192.168.34.1` y `curl -I http://192.168.34.1`.
- [ ] Comparar la IP WAN del router con `189.204.180.242`.
- [ ] La red `192.168.34.x` no es la de fábrica de routers comunes: revisar si es red administrada por terceros o si hay dos routers en cadena (abrir el 5027 en ambos).
- [ ] Reservar `192.168.34.161` para la PC (o fijarla).
- [ ] Port forwarding 5027 TCP → `192.168.34.161:5027` y firewall (`sudo ufw allow 5027/tcp`).
- [ ] Prueba externa en canyouseeme.org, puerto 5027.
- [ ] Registro A o CNAME (DDNS) en Hostinger para `traccar.buildwiselabs.net`.
- [ ] Dar de alta cada FMC650 en Traccar con su IMEI.
- [ ] Si no se puede abrir el puerto: VPS pequeño con frp.

### Opciones para resolver el CGNAT (a decidir)

| Opción | Cómo | Pros | Contras |
|---|---|---|---|
| A. IP pública del ISP | Llamar al proveedor: pedir IP pública y que abra el 5027 TCP hacia la PC (`192.168.34.161`) | Sin cambios de arquitectura | Puede costar; la IP puede seguir cambiando (usar DDNS); el router no tiene panel web accesible |
| B. VPS + frp | GPS → `traccar.buildwiselabs.net` (IP del VPS, puerto 5027) → túnel frp → PC local (`127.0.0.1:5027`). Detalle en `fmc650-tractor-traccar-configurations-CGNAT.md` | Funciona con CGNAT e IP cambiante; dominio fijo | Costo mensual del VPS; un componente más |

Con la opción B, el registro A de `traccar.buildwiselabs.net` en Hostinger apunta a la IP del VPS.
Traccar sigue corriendo en la PC local con `5027` y `8082` ya activos.

Primera prueba que falta para confirmar el CGNAT: canyouseeme.org, puerto 5027, con Traccar encendido
(no se hizo desde la PC para no enviar la IP a un servicio externo).

## Lista rápida

- [ ] Codec 8 Extended, servidor, puerto 5027, TCP
- [ ] APN correcto del chip
- [ ] Dispositivo creado en Traccar con el IMEI
- [ ] IP pública real (sin CGNAT) o VPS con frp
- [ ] IP fija local + port forwarding 5027 + firewall
- [ ] Registro A o CNAME en Hostinger (o IP directa para probar)
- [ ] Prueba externa en canyouseeme.org con datos celulares
