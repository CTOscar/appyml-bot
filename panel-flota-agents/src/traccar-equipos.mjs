// Convierte los dispositivos de Traccar (/api/devices) en filas de `equipos`. Función pura, con prueba.
// Traccar es la fuente del nombre, el IMEI (uniqueId) y el id; marca, modelo y sonda salen de los atributos del dispositivo si existen.
export function equipoDeDispositivo(d) {
  const a = d.attributes || {};
  const marca = String(a.marca ?? '').trim().slice(0, 60);
  const modelo = String(a.modelo ?? '').trim().slice(0, 60);
  return {
    no_economico: String(d.name ?? `Dispositivo ${d.id}`).trim().slice(0, 40),
    device_id: Number(d.id),
    imei: d.uniqueId ? String(d.uniqueId).slice(0, 20) : null,
    marca,
    modelo,
    sensor_diesel: a.sonda === true || a.sonda === 'true' || a.sensor_diesel === true ? 1 : 0,
  };
}

// Inserta los equipos nuevos y actualiza nombre e IMEI de los que ya existen por device_id.
// Lo que alguien capturó a mano (marca, modelo, sensor) no se pisa: solo se llena si estaba vacío.
export async function guardarEquipos(pool, lista) {
  let nuevos = 0, actualizados = 0;
  for (const e of lista) {
    const [r] = await pool.query(
      `INSERT INTO equipos (no_economico, device_id, imei, marca, modelo, sensor_diesel)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         imei = COALESCE(VALUES(imei), imei),
         marca = IF(marca = '', VALUES(marca), marca),
         modelo = IF(modelo = '', VALUES(modelo), modelo),
         sensor_diesel = GREATEST(sensor_diesel, VALUES(sensor_diesel))`,
      [e.no_economico, e.device_id, e.imei, e.marca, e.modelo, e.sensor_diesel],
    );
    if (r.affectedRows === 1) nuevos++; else if (r.affectedRows === 2) actualizados++;
  }
  return { nuevos, actualizados };
}
