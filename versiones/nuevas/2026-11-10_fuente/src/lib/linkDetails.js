// Fichas internas de cada enlace (Enlaces → clic): resumen, características, configuración, instalación y fuentes.
// Así no hace falta salir a la página del fabricante o de la tienda para lo que se usa a diario.
//
// Origen de cada dato (`src` en las especificaciones):
//   proyecto   → decisión o dato de la carpeta docs/ del repositorio (propuesta técnica, J1939, networkGPS…).
//   fabricante → página u hoja de datos oficial, consultada el 12 nov 2026.
//   tienda     → anuncio del vendedor, consultado el 12 nov 2026.
//   confirmar  → dato de distribuidores o de resultados de búsqueda: úsalo como referencia y contrástalo con la hoja de datos.
// Lo que no se pudo verificar NO se inventa: queda en «avisos» o se omite.

export const SRC = {
  proyecto: ['Proyecto', 'info'],
  fabricante: ['Fabricante', 'ok'],
  tienda: ['Tienda', 'ok'],
  confirmar: ['Confirmar', 'warn'],
};

// Pestañas posibles de una ficha, en orden.
export const TABS = [['resumen', 'Resumen'], ['specs', 'Características'], ['config', 'Configuración'], ['install', 'Instalación'], ['fuentes', 'Fuentes']];

const DATE = '12 nov 2026';

const CONFIGURATOR_STEPS = [
  'Instala Teltonika Configurator (Windows) y los drivers USB desde la wiki de Teltonika.',
  'Con la SIM de datos puesta y las antenas conectadas, alimenta el equipo y conéctalo por micro-USB; el Configurator lo detecta solo.',
  'Guarda con «Save to device» y actualiza el firmware si hay versión nueva.',
  'En «Status» comprueba: GPS con satélites, señal celular y GPRS conectado.',
];

const SERVER_TABLE = {
  head: ['Dónde', 'Campo', 'Valor'],
  rows: [
    ['System → Data Protocol', 'Data protocol', 'Codec 8 Extended'],
    ['GPRS → Server settings', 'Domain', 'traccar.buildwiselabs.net (o la IP pública / dominio DDNS), sin «http://» y sin puerto'],
    ['GPRS → Server settings', 'Port', '5027'],
    ['GPRS → Server settings', 'Protocol', 'TCP'],
    ['GPRS → Cellular', 'APN', 'El del chip. Telcel: internet.itelcel.com · AT&T: att.mx · Movistar: internet.movistar.mx (confirmar con el proveedor)'],
    ['GPRS → Cellular', 'APN user / password', 'Normalmente vacíos'],
  ],
};

const WIRING_TABLE = {
  head: ['Cable', 'Desde', 'Hasta (rastreador)', 'Protección', 'Para qué sirve'],
  rows: [
    ['Alimentación', 'Borne + de la batería (directo, no por la llave)', 'VCC (+)', 'F1 · 1–2 A', 'Mantiene el equipo encendido 24 h para detectar robos con el tractor apagado.'],
    ['Tierra', 'Chasis, en un punto limpio sin pintura', 'GND (−)', '—', 'Referencia eléctrica. Una mala tierra da lecturas de voltaje falsas.'],
    ['Motor en marcha', 'Borne D+ del alternador (o interruptor de presión de aceite)', 'DIN1 (ignición)', 'F2 · 0.5–1 A', 'Solo da señal cuando el motor gira: no cuenta horas con la llave abierta y el motor apagado.'],
    ['Datos', 'Chip M2M dentro del equipo', 'Antena LTE interna', '—', 'Envía cada 60 s en movimiento y cada 30 min detenido; sin señal guarda en memoria y reenvía.'],
  ],
};

const INSTALL_NOTES = [
  'Ubicación: dentro de la cabina, bajo el tablero o detrás del asiento, con la etiqueta hacia el cielo y sin metal encima (las antenas son internas).',
  'Tractores de 24 V: el rastreador acepta 10–30 V, no necesita convertidor. Si se usa el voltaje como respaldo, el umbral sube a ~26.4 V.',
  'Los valores de fusibles, voltajes y asignación de pines son de referencia: confírmalos con el manual de instalación del modelo antes de cablear.',
];

const DELIVERY_CHECK = [
  'Foto del horómetro del tractor.',
  'Foto de la instalación terminada.',
  'Prueba de arranque: el equipo aparece en línea en Traccar.',
  'Si lleva sonda: validar el nivel con una carga real de pipa.',
];

export const LINK_DETAILS = {
  fmc130: {
    badge: 'Nivel A',
    resumen: 'Rastreador LTE Cat 1 de Teltonika para los tractores sin electrónica. Entrega posición, ignición (horas de motor por la señal D+) y, con sonda BLE, el nivel de diésel.',
    rol: 'Es el equipo de «nivel A»: unos 55 tractores más 2 de repuesto (57 en total), instalado en caja IP67 dentro de la cabina. Las horas se calculan con la señal del borne D+ (o la presión de aceite) en la entrada DIN1; el voltaje queda solo como respaldo.',
    specs: [
      ['Nombre oficial', 'FMC130 – Advanced 4G LTE Cat 1 tracker for fleet management', 'fabricante'],
      ['Conectividad', 'LTE Cat 1; según distribuidores, con respaldo 3G/2G', 'confirmar'],
      ['Alimentación', '10–30 V CC (sirve para tractores de 12 V y 24 V)', 'proyecto'],
      ['Batería interna', 'Li-ion 3.7 V · 170 mAh', 'confirmar'],
      ['Dimensiones y peso', '65 × 56.6 × 20.6 mm · 55 g', 'confirmar'],
      ['Entradas y salidas', '1 entrada negativa, 2 de impulsos, 2 analógicas, 3 salidas digitales, 1 entrada para adaptador CAN y 1 interfaz 1-Wire', 'confirmar'],
      ['Antenas', 'GNSS y celular internas', 'confirmar'],
      ['CAN', 'No trae CAN integrado: solo con un adaptador CAN de Teltonika (p. ej. LV-CAN200 o ALL-CAN300), y depende de la lista de vehículos soportados', 'proyecto'],
      ['Bluetooth', 'Lee sondas de combustible BLE de forma nativa', 'proyecto'],
      ['Puerto en Traccar', '5027 (TCP, protocolo Teltonika, Codec 8 Extended)', 'proyecto'],
    ],
    avisos: [
      { tone: 'warn', text: 'Alimentación, batería, dimensiones y E/S salen de resúmenes de distribuidores y de una copia de la hoja de datos; las páginas oficiales no mostraron la tabla. Confirma con la hoja de datos DS-FMC130 antes de comprar o cablear.' },
      { tone: 'info', text: 'Un tractor que no esté en la lista de vehículos soportados del adaptador CAN no entrega datos por él. En ese caso el FMC130 se queda con ignición por D+ y horas por ignición.' },
    ],
    config: [
      { title: 'Preparar el equipo', steps: ['Inserta la SIM con datos activos.', 'Conecta las antenas antes de alimentar (si el modelo no las trae internas).', ...CONFIGURATOR_STEPS.slice(0, 2)] },
      { title: 'Servidor y operador', intro: 'Valores del proyecto (los mismos del FMC650 de pruebas; confirma el nombre de las pestañas en tu versión del Configurator).', table: SERVER_TABLE },
      { title: 'Ignición e intervalos', steps: ['En I/O activa Ignition con DIN1 (el voltaje queda como respaldo).', 'Intervalos de envío del proyecto: cada 60 s en movimiento y cada 30 min detenido.'] },
      { title: 'Guardar y comprobar', steps: CONFIGURATOR_STEPS.slice(2) },
      { title: 'Alta en Traccar', steps: ['Registra el dispositivo con su IMEI como identificador; si no, Traccar descarta los datos.', 'Revisa logs/tracker-server.log: debe aparecer la conexión del IMEI, y el equipo debe pasar a «en línea».'] },
    ],
    install: [
      { title: 'Cableado de referencia (nivel A)', table: WIRING_TABLE },
      { title: 'Notas de instalación', steps: INSTALL_NOTES },
      { title: 'Antes de entregar cada tractor', steps: DELIVERY_CHECK },
    ],
    fuentes: [
      { label: 'Ficha oficial de Teltonika', url: 'https://www.teltonika-gps.com/products/trackers/advanced/fmc130' },
      { label: 'Wiki de Teltonika · FMC130', url: 'https://wiki.teltonika-gps.com/view/FMC130' },
      { label: 'Wiki · Data Sending Parameters ID (FMC130)', url: 'https://wiki.teltonika-gps.com/view/FMC130_Teltonika_Data_Sending_Parameters_ID' },
    ],
    docs: ['docs/hardware-gps/Revision_sensores_y_costos.md (secciones 3–5)', 'docs/hardware-gps/networkGPS.md', 'docs/hardware-gps/J1939.md (sección 4)'],
  },

  fmc150: {
    badge: 'Nivel B',
    resumen: 'Rastreador LTE Cat 1 de Teltonika con procesador CAN integrado: lee horas, RPM, consumo y a veces nivel de tanque directo de la computadora del motor, sin sonda.',
    rol: 'Es el equipo de «nivel B» para los tractores modernos con J1939: unos 30 más 2 de repuesto (32 en total). El rastreador solo escucha el bus, no le pregunta nada al motor. Para tractores en garantía se prefiere un lector CAN sin contacto, que evita cortar el cableado de fábrica.',
    specs: [
      ['Nombre oficial', 'FMC150 – Advanced 4G LTE Cat 1 tracker con procesador CAN integrado', 'fabricante'],
      ['Descripción de la wiki', 'Rastreador GNSS/GSM/Bluetooth con chip CAN integrado, antenas GNSS/GSM internas y batería interna', 'fabricante'],
      ['Estado de producción', 'End of life (fin de vida) en la página oficial; las fechas de fin de pedido, producción y soporte aparecen en blanco', 'fabricante'],
      ['Alimentación', '10–30 V CC (el proyecto asume el mismo rango que el FMC130; confirmar en la hoja de datos)', 'confirmar'],
      ['Dimensiones y peso', '65 × 56.6 × 20.6 mm · 55 g', 'confirmar'],
      ['Entradas y salidas', '2 interfaces CAN y 1 interfaz 1-Wire; el resto depende de la variante (p. ej. FMC150-QJIB0: 1 entrada negativa, 2 analógicas, 2 salidas digitales)', 'confirmar'],
      ['Memoria y temperatura', '128 MB · −40 a +85 °C', 'confirmar'],
      ['CAN', 'Chip integrado: CAN H y CAN L directo al conector de diagnóstico del tractor o a un lector CAN sin contacto. La ficha del proyecto lista J1939 entre los protocolos', 'proyecto'],
      ['Puerto en Traccar', '5027 (TCP, protocolo Teltonika, Codec 8 Extended)', 'proyecto'],
    ],
    avisos: [
      { tone: 'warn', text: 'La página oficial de Teltonika marca el FMC150 como «End of life». La propuesta compra 32 unidades: antes de pedir, confirma con el distribuidor disponibilidad, soporte y reemplazo. Las páginas de los modelos hermanos (FMM150, FMB150) apuntan a la serie FMx250 para vehículos pesados, pero eso no es un sucesor declarado del FMC150.' },
      { tone: 'warn', text: 'Las especificaciones eléctricas y de E/S salen de distribuidores y de una copia de la hoja de datos; contrástalas con DS-FMC150.' },
      { tone: 'info', text: 'Los códigos de falla (SPN + FMI) no llegan con la configuración estándar: lo normal es recibir solo que hay fallas y cuántas. Ver «Configuración» para los caminos posibles.' },
    ],
    config: [
      { title: 'Lo básico', intro: 'Servidor, operador e ignición se configuran igual que en el FMC130.', table: SERVER_TABLE },
      { title: 'Lectura CAN (J1939)', steps: [
        'Antes de instalar, captura el bus del tractor 5 minutos con el motor encendido (laptop + lector CAN): confirma la velocidad (250 o 500 kbps) y qué PGN transmite.',
        'En la configuración de CAN deja el promedio (averaging) en 1 para no perder datos digitales.',
        'Si el vehículo soporta J1939 y J1708 al mismo tiempo, desactiva J1708: si no, no llegan los datos de combustible.',
        'Configura el equipo en modo de escucha: no debe mandar tramas al bus.',
      ] },
      { title: 'Qué llega a Traccar (AVL ID)', intro: 'El rastreador no manda PGN ni SPN: los traduce a elementos de E/S con valor ya convertido. Traccar los recibe como atributos io<ID>.', table: {
        head: ['Dato', 'AVL ID', 'Unidad'],
        rows: [
          ['Velocidad del motor', '85', 'rpm'],
          ['Posición del acelerador', '82', '%'],
          ['Temperatura del refrigerante', '115', '0.1 °C (confirmar con el tractor)'],
          ['Presión del aceite', '1158', 'kPa (confirmar)'],
          ['Horas de motor totales', '102', 'minutos, no horas'],
          ['Horas de motor desde la instalación', '103', 'minutos'],
          ['Combustible total usado', '83', '0.1 L'],
          ['Combustible usado desde la activación', '107', '0.1 L'],
          ['Nivel de combustible', '84 (litros) y 89 (%)', '0.1 L / %'],
        ],
      } },
      { title: 'Llevarlos al panel', steps: [
        'El panel lee rpm, fuel, ignition, hours y power. En Traccar crea atributos calculados: rpm = io85, coolantTemp = io115 / 10, oilPressure = io1158.',
        'El ID 102 viene en minutos y el panel espera hours en milisegundos: convierte (minutos × 60 000).',
      ] },
      { title: 'Códigos de falla', intro: 'Tres caminos, de más a menos práctico (ninguno está verificado todavía):', steps: [
        'A. CAN manual: configurar el rastreador para leer el PGN 65226 (DM1) y decodificar los bytes en el backend. Falta confirmar en el Configurator si el firmware actual lo permite.',
        'B. En los Deere con JDLink, las alertas de diagnóstico ya llegan a Operations Center y se consultan por API sin tocar el bus.',
        'C. Un lector J1939 aparte con salida de DTC (gateway CAN con envío por MQTT): más hardware y más costo.',
      ] },
    ],
    install: [
      { title: 'Cableado de referencia (nivel B)', table: { head: WIRING_TABLE.head, rows: [...WIRING_TABLE.rows.slice(0, 3), ['CAN H / CAN L', 'Conector de diagnóstico J1939 o lector CAN sin contacto', 'CAN H / CAN L', '—', 'Lee horas, RPM, consumo y nivel de tanque desde la computadora del motor.'], WIRING_TABLE.rows[3]] } },
      { title: 'Antes de conectar a un tractor', steps: [
        'Confirma que tiene J1939: los de inyección mecánica (sin ECU) no tienen bus de motor. Algunos de gama baja (series 5E de John Deere, algunos TT de New Holland) pueden ser mecánicos.',
        'No confundas J1939 con ISOBUS (ISO 11783): el del motor es J1939; ISOBUS es el de implementos y terminal.',
        'Ubica el conector de diagnóstico (Deutsch de 9 pines), cerca del asiento o en la consola; el manual del operador lo indica.',
        'En garantía: usa un lector CAN sin contacto para no cortar ni empalmar el cableado de fábrica.',
        'Algunos fabricantes restringen datos avanzados; lo estándar (RPM, temperatura, presión, horas) casi siempre está abierto.',
      ] },
      { title: 'Notas de instalación', steps: INSTALL_NOTES },
      { title: 'Validación en el piloto', table: {
        head: ['Prueba', 'Aceptación'],
        rows: [
          ['Captura del bus', 'Velocidad identificada y PGN 61444, 65262 y 65263 presentes'],
          ['RPM', 'Coincide con el tacómetro, ±50 rpm'],
          ['Temperatura del refrigerante', 'Coincide con el indicador, ±3 °C'],
          ['Presión de aceite', 'Coincide con el indicador o con un manómetro de prueba'],
          ['Acelerador', '0 % en reposo y sube proporcional al pisar el pedal'],
          ['Horas de motor por CAN', 'Menos de 3 % de diferencia contra el horómetro'],
          ['Sin escritura', 'El tractor no registra errores de comunicación al conectar el rastreador'],
        ],
      } },
      { title: 'Antes de entregar cada tractor', steps: DELIVERY_CHECK },
    ],
    fuentes: [
      { label: 'Ficha oficial de Teltonika', url: 'https://www.teltonika-gps.com/products/trackers/can-data/fmc150' },
      { label: 'Wiki de Teltonika · FMC150', url: 'https://wiki.teltonika-gps.com/view/FMC150' },
      { label: 'Wiki · Data Sending Parameters ID (FMC150)', url: 'https://wiki.teltonika-gps.com/view/FMC150_Teltonika_Data_Sending_Parameters_ID' },
    ],
    docs: ['docs/hardware-gps/J1939.md', 'docs/hardware-gps/Revision_sensores_y_costos.md', 'docs/hardware-gps/networkGPS.md'],
  },

  'escort-tdble1000': {
    badge: 'Sonda BLE',
    resumen: 'Sonda de nivel de combustible con Bluetooth 4.0: no lleva cables al tanque. El rastreador Teltonika la lee de forma nativa y manda el nivel a Traccar.',
    rol: 'Es la sonda de los tractores de nivel A con más consumo o con sospecha de robo: unas 15 más 1 de repuesto (16). Sirve para detectar cargas, descargas y extracciones de diésel; el panel las muestra en Costeo y en Alertas.',
    specs: [
      ['Longitud de la sonda', '1000 mm; se puede recortar a la profundidad del tanque, pero no alargar', 'tienda'],
      ['Precisión', '±1 %', 'tienda'],
      ['Conectividad', 'Bluetooth BLE 4.0, sin cables en el vehículo', 'tienda'],
      ['Autonomía', 'Hasta 7 años de funcionamiento continuo (batería propia)', 'tienda'],
      ['Protección', 'IP69K (resiste golpes, agua y lavado a presión)', 'tienda'],
      ['Contenido', 'Solo la sonda y su documentación de instalación', 'tienda'],
      ['Precio en la tienda', '$3,914.74 (la página no indica la moneda; es una tienda mexicana). La propuesta estimaba $4,000–6,000 por sonda', 'tienda'],
    ],
    avisos: [
      { tone: 'warn', text: 'El receptor (rastreador o sistema de telemática) debe poder recibir BLE; la tienda no da lista de compatibilidad. Confirma con Teltonika/el distribuidor que el FMC130 lee este modelo antes de comprar las 16.' },
      { tone: 'info', text: 'La tienda no indica material ni rango de temperatura. Pídelos si el tanque va a la intemperie.' },
    ],
    config: [
      { title: 'Calibración (1 a 2 horas por tractor)', intro: 'La calibración convierte la lectura de la sonda en litros reales; cada tanque necesita su propia tabla porque su forma es irregular.', steps: [
        'Corta la sonda a la profundidad del tanque y móntala vertical, lo más cerca posible del centro.',
        'Con la app o el configurador del fabricante registra la lectura con el tanque vacío y con el tanque lleno.',
        'Con el tractor en piso nivelado y el motor apagado, carga por tramos fijos (p. ej. 20 L) con un recipiente aforado o un medidor de flujo confiable; tras cada tramo espera 1–2 minutos y anota la lectura.',
        'Carga la tabla al sistema (atributo calculado de Traccar o sistema de maquinaria): los litros se calculan por interpolación entre los dos puntos más cercanos.',
        'Valida con una carga real de pipa: la diferencia debe quedar abajo de 3 %.',
      ] },
      { title: 'Lógica en el sistema', steps: [
        'Filtrado: promedio móvil de varios minutos, o tomar como válidas solo las lecturas con el tractor detenido.',
        'Extracción: alerta cuando el nivel baja más de un umbral (10–15 L) con el motor apagado. En el panel se ajusta en Ajustes de operación.',
        'Carga: una subida repentina se registra como carga y se concilia con el vale de la pipa.',
      ] },
    ],
    install: [
      { title: 'Montaje', steps: [
        'No hay cable al tanque (el punto más castigado del tractor): la sonda manda el nivel por Bluetooth al rastreador dentro de la cabina.',
        'Instalación rápida, de minutos según la tienda; la calibración es lo que lleva tiempo.',
      ] },
      { title: 'Antes de entregar cada tractor', steps: DELIVERY_CHECK },
    ],
    fuentes: [
      { label: 'Anuncio en CJP México', url: 'https://tienda.cjp.mx/compra/escort-tdble1000-sensor-de-combustible-conectividad-ble-4-0-sin-cables-176985' },
    ],
    docs: ['docs/hardware-gps/Revision_sensores_y_costos.md (secciones 2, 4 y 6)'],
  },

  'caja-ip67': {
    badge: 'IP67',
    resumen: 'Caja de conexiones impermeable con prensaestopas para proteger el rastreador y sus empalmes dentro de la cabina.',
    rol: 'Va una por rastreador: 89 piezas (57 + 32). Costo estimado en la propuesta: $10,680–22,250 para las 89. Los cables entran por los prensaestopas para que no entren agua ni polvo.',
    specs: [
      ['Producto', 'Zulkit · caja de conexiones impermeable con prensaestopas (el título del anuncio la describe como transparente)', 'tienda'],
      ['Cantidad del proyecto', '89 (una por rastreador)', 'proyecto'],
      ['Medidas, material y número de prensaestopas', 'Ver el anuncio: no pude consultarlos', 'confirmar'],
    ],
    avisos: [
      { tone: 'warn', text: 'Antes de comprar 89, verifica que el FMC130/FMC150 (65 × 56.6 × 20.6 mm) quepa con holgura para los cables y para la etiqueta visible. Esta ficha no trae las medidas internas de la caja.' },
    ],
    install: [
      { title: 'Uso', steps: [
        'Instálala dentro de la cabina, bajo el tablero o detrás del asiento, con la etiqueta del rastreador hacia el cielo.',
        'Sin metal encima: las antenas del rastreador son internas.',
        'Pasa alimentación, tierra y señal D+ (y CAN H/L en nivel B) por los prensaestopas y ajústalos.',
        'Cierra con un sello de acero con folio para detectar manipulación (ver la ficha del sello).',
      ] },
    ],
    fuentes: [{ label: 'Anuncio en Amazon México', url: 'https://www.amazon.com.mx/Zulkit-conexiones-impermeable-transparente-prensaestopas/dp/B09FL2VKJY' }],
    docs: ['docs/hardware-gps/Revision_sensores_y_costos.md (secciones 3–5)'],
  },

  'sello-acero': {
    badge: 'Antimanipulación',
    resumen: 'Sello de cable de acero con folio numerado: si alguien abre la caja del rastreador, el sello se rompe o falta.',
    rol: 'Se compran 100 piezas (2 paquetes de 50 a $584 cada uno, $1,168 en total) para sellar las cajas de los rastreadores.',
    specs: [
      ['Presentación', 'Paquete de 50 piezas, $584', 'proyecto'],
      ['Cantidad del proyecto', '100 piezas (2 paquetes)', 'proyecto'],
      ['Tipo', 'Sello de cable de acero con folio, autobloqueante y para uso antimanipulación (según el título del anuncio)', 'tienda'],
    ],
    install: [
      { title: 'Uso recomendado', steps: [
        'Pasa el cable por el cierre de la caja IP67 y por un punto fijo, y cierra el sello.',
        'Anota el folio del sello junto al tractor en el registro de instalación (junto a las fotos del horómetro y de la instalación).',
        'En cada revisión, compara el folio con el registro: si no coincide o el sello está roto, hubo manipulación.',
      ] },
    ],
    avisos: [{ tone: 'info', text: 'El procedimiento de arriba es una recomendación del panel, no una especificación del fabricante.' }],
    fuentes: [{ label: 'Anuncio en Amazon México', url: 'https://www.amazon.com.mx/contenedores-antimanipulaci%C3%B3n-seguridad-autobloqueantes-certificadas/dp/B0CHYK7ZP7' }],
    docs: ['docs/hardware-gps/Revision_sensores_y_costos.md (lista de compras)'],
  },

  traccar: {
    badge: 'Plataforma',
    resumen: 'Servidor de rastreo de código abierto. Recibe los datos de los rastreadores Teltonika y es la fuente de las posiciones en vivo del panel.',
    rol: 'Traccar guarda las posiciones y eventos en vivo; la API del panel (panel-flota-api) guarda el historial y todo lo propio del panel. Hoy corre en una PC local; el dominio previsto para los rastreadores es traccar.buildwiselabs.net.',
    specs: [
      ['Puerto de los rastreadores Teltonika', '5027 (TCP, Codec 8 Extended)', 'proyecto'],
      ['Interfaz web', '8082', 'proyecto'],
      ['Identificador de cada equipo', 'El IMEI del rastreador; sin alta por IMEI, Traccar descarta los datos', 'proyecto'],
      ['Dominio previsto', 'traccar.buildwiselabs.net (el registro DNS en Hostinger aún no se crea)', 'proyecto'],
    ],
    avisos: [
      { tone: 'warn', text: 'Conexión desde internet pendiente: las pruebas de red apuntan a CGNAT (dos saltos con IP privada tras el router), así que el port forwarding probablemente no funcione. Opciones: pedir al proveedor una IP pública, o un VPS pequeño con túnel frp. Falta confirmarlo con canyouseeme.org (puerto 5027).' },
    ],
    config: [
      { title: 'Dar de alta un rastreador', steps: ['En Traccar crea el dispositivo con su IMEI.', 'En el Configurator del rastreador pon el dominio, puerto 5027, TCP y Codec 8 Extended (ver la ficha del FMC130).'] },
      { title: 'Atributos calculados', steps: ['Crea uno por dato desde la interfaz, sin tocar código: rpm = io85, coolantTemp = io115 / 10, oilPressure = io1158.', 'Convierte las horas: el ID 102 viene en minutos y el panel espera milisegundos.'] },
      { title: 'Historial', steps: ['Con INGEST_KEY definida, la API recibe posiciones por POST /api/panel/samples.', 'O deja corriendo npm run sync:traccar en panel-flota-api: copia /api/positions de Traccar cada minuto (variables TRACCAR_URL, TRACCAR_EMAIL, TRACCAR_PASSWORD, PANEL_API_URL, INGEST_KEY).'] },
      { title: 'Verificar', steps: ['Revisa logs/tracker-server.log: debe aparecer la conexión del IMEI.', 'El equipo debe pasar a «en línea» en la interfaz (puerto 8082).'] },
    ],
    fuentes: [{ label: 'Sitio y documentación de Traccar', url: 'https://www.traccar.org/' }],
    docs: ['docs/hardware-gps/networkGPS.md', 'docs/planes/MIGRACION-MOCK-A-GPS.md', 'panel-flota-api/README.md'],
  },

  buildwise: {
    badge: 'Plataforma',
    resumen: 'BuildWise Labs: laboratorio mexicano de desarrollo de software y automatización con IA que hace este panel.',
    rol: 'Dueño del proyecto y de los dominios donde se publica el panel.',
    specs: [
      ['Panel (producción)', 'panelpack.buildwiselabs.net · Hostinger', 'proyecto'],
      ['API del panel', 'api-panelpack.buildwiselabs.net', 'proyecto'],
      ['Traccar (previsto)', 'traccar.buildwiselabs.net', 'proyecto'],
      ['Sitio', 'buildwiselabs.net', 'proyecto'],
    ],
    avisos: [{ tone: 'info', text: 'El panel de la reconstrucción en código fuente todavía no se ha desplegado en producción.' }],
    fuentes: [{ label: 'Sitio de BuildWise Labs', url: 'https://buildwiselabs.net' }],
    docs: ['CLAUDE.md', 'panel-flota-api/README.md'],
  },

  'aliexpress-pendiente': {
    badge: 'Por identificar',
    resumen: 'Producto guardado de AliExpress que aún no se ha identificado.',
    rol: 'Sin definir: el proyecto lo tiene marcado como «pendiente de definir».',
    specs: [['Estado', 'Sin nombre, uso ni cantidad', 'proyecto']],
    avisos: [{ tone: 'warn', text: 'Falta que alguien diga qué producto es y para qué se usa. Cuando se sepa, actualiza el nombre y la nota en src/lib/links.js y completa esta ficha en src/lib/linkDetails.js.' }],
    fuentes: [{ label: 'Anuncio en AliExpress', url: 'https://es.aliexpress.com/item/1005010414603740.html' }],
    docs: ['docs/referencias/Enlaces_utiles.md'],
  },
};

export const detailOf = (id) => LINK_DETAILS[id] || null;
export const FETCHED = DATE;
