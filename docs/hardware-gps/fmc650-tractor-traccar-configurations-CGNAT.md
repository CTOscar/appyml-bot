# Teltonika FMC650 en tractor John Deere + Traccar

Guía completa: configuración por USB, instalación en el tractor, lectura CAN y conexión a un servidor Traccar propio.

---

## 1. Preparar el equipo

- Inserta la **SIM con datos activos**.
- Conecta las dos antenas **antes de alimentar** el equipo:
  - **GNSS**: recibe la señal de satélites (ubicación). Va mirando al cielo, sin metal encima.
  - **GSM**: envía los datos por la red celular. Lejos de metal grueso.
  - Ambas usan conector **SMA**. Revisa que cada una quede en su puerto marcado.
- Alimentación del FMC650: **10 a 30 V** (sirve para tractores de 12 V o 24 V).

---

## 2. Configurar por USB (en el escritorio, antes de instalar)

1. Instala **Teltonika Configurator** (Windows) y los drivers USB desde la wiki de Teltonika.
2. Conecta el equipo por micro-USB con alimentación. El Configurator lo detecta solo.
3. Configura:

### GPRS (System > GPRS)
- **APN** de tu operador. Ejemplos en México (confirma con tu operador):
  - Telcel: `internet.itelcel.com`
  - AT&T: `att.mx`
  - Movistar: `internet.movistar.mx`
- Usuario y contraseña del APN: vacíos, salvo que el operador los pida.
- Modo de red: automático (2G/3G/4G).
- Roaming: solo si lo necesitas.

### Servidor (Server Settings / Data Acquisition)
- **Dominio o IP** de tu servidor Traccar.
- **Puerto: 5027** (puerto por defecto del protocolo Teltonika en Traccar).
- **Protocolo: TCP**.
- **Codec 8 Extended**.

### Ignición e intervalos
- En *I/O*, activa **Ignition** con DIN1 (o por voltaje).
- Intervalos de envío sugeridos:
  - Motor encendido: ~30 s.
  - Motor apagado: 5 a 10 min.

### CAN (opcional)
- Modo **J1939/FMS** en el puerto CAN.
- Marca los parámetros: RPM, temperatura, combustible, horas de motor, velocidad.

4. Pulsa **Save to device**.
5. Actualiza el **firmware** si hay una versión nueva.
6. En **Status** verifica: GPS fijo (satélites), señal GSM y GPRS conectado.

---

## 3. Instalación en el tractor

### Alimentación
- **Positivo (VCC):** batería o línea con fusible (1 a 3 A).
- **Negativo (GND):** chasis o punto de tierra firme, limpio y sin pintura.

### Ignición
- Cable que reciba voltaje **solo con la llave en ON**, conectado a **DIN1**.

### Montaje
- Lugar seco, lejos del calor del motor.
- Antena GNSS mirando al cielo, sin metal encima.
- Cables bien asegurados contra la vibración.

---

## 4. Lectura CAN en John Deere

- Los John Deere modernos usan **CAN bus**: J1939 (motor y transmisión) e ISOBUS / ISO 11783 (implementos).
- **Conector de diagnóstico de 9 pines** (Deutsch, cerca del asiento o la consola). Estándar J1939:
  - A = tierra
  - B = alimentación
  - C = **CAN High**
  - D = **CAN Low**
  - Verifica el pinout de tu modelo antes de conectar.
- Conecta CAN High y CAN Low a las entradas CAN del FMC650 con un conector tipo "Y" o pinchando solo lo necesario. No cortes cables al azar.
- Si el tractor está en garantía, usa el conector de diagnóstico para no modificar el cableado original.
- También se puede usar un adaptador CAN (LV-CAN200 o ALL-CAN300) según el modelo.

### Ojo
- Los modelos viejos (mecánicos, sin ECU) **no tienen CAN**: solo tendrás GPS, ignición y voltaje.
- Algunos datos propietarios de John Deere no salen por J1939 estándar. Confirma con Teltonika qué parámetros soporta tu modelo.
- Pendiente: definir serie y año del tractor (por ejemplo 5075E, 6120M) para saber si trae CAN.

---

## 5. Traccar

1. En la interfaz web de Traccar, pulsa **+** para agregar un dispositivo.
2. **Identificador:** el **IMEI** del FMC650 (15 dígitos, en la etiqueta y en el Configurator). Debe ser exacto.
3. Ponle nombre (por ejemplo, "John Deere") y guarda.
4. Verifica que el servicio esté activo: `systemctl status traccar`.
5. Si algo falla, revisa `logs/tracker-server.log`. Un IMEI como "unknown device" significa que falta registrarlo o está mal escrito.

---

## 6. Servidor propio detrás del router

El GPS está en la calle con datos celulares, así que debe poder llegar a tu servidor desde internet.

1. **IP fija local** para el servidor: reserva DHCP por MAC en el router (panel normalmente en `192.168.1.1` o `192.168.0.1`).
2. **Redirección de puertos** (*Port Forwarding / Virtual Server / NAT*):
   - Protocolo: **TCP**
   - Puerto externo: **5027**
   - Puerto interno: **5027**
   - IP destino: la IP fija del servidor
3. **Firewall del servidor:** `ufw allow 5027/tcp` (o Windows Firewall).
4. **Dominio dinámico** (DuckDNS o No-IP) si tu IP pública cambia, y úsalo en el Configurator en vez de la IP.
5. **Prueba desde fuera** con datos celulares (sin WiFi), por ejemplo en *canyouseeme.org*, puerto 5027.

### Verificar CGNAT
Compara la **IP WAN** del router con la que muestra *cualesmiip.com*.
- Si son distintas, o la WAN empieza con `100.64.` a `100.127.`, `10.` o `192.168.`, tu proveedor usa **CGNAT** y la redirección de puertos **no funcionará**.
- Soluciones:
  - Pedir IP pública al proveedor.
  - Usar un **VPS barato** con Traccar (desde unos 4 a 6 USD al mes).
  - Usar un túnel tipo **frp** con un VPS pequeño. Cloudflare Tunnel gratis no sirve para el 5027 porque el GPS manda TCP crudo, no HTTP.
- Si el router es del proveedor de internet, a veces la redirección viene bloqueada y hay que pedirla al soporte.

### Nota de confiabilidad
Si el servidor se apaga o se cae el internet, el FMC650 guarda los datos en su memoria interna y los envía al reconectar. Aun así, un VPS es más confiable para un tractor en el campo.

---

## 7. Prueba final

1. Guarda la configuración en el GPS.
2. Déjalo con cielo abierto y datos celulares.
3. En un par de minutos debe aparecer **en línea** en Traccar con su posición.
4. Ya instalado: enciende el tractor y confirma posición, ignición, voltaje y datos CAN.

---

## Checklist rápido

- [ ] SIM con datos activos
- [ ] Antenas GNSS y GSM conectadas antes de alimentar
- [ ] APN configurado
- [ ] Servidor, puerto 5027, TCP, Codec 8 Extended
- [ ] Ignición (DIN1) y intervalos
- [ ] CAN J1939/FMS (si el tractor tiene CAN)
- [ ] Firmware actualizado
- [ ] IMEI registrado en Traccar
- [ ] IP fija local + port forwarding 5027 + firewall
- [ ] Descartado CGNAT (o VPS como alternativa)
- [ ] Prueba desde fuera de la red
- [ ] Instalación en el tractor y verificación final
