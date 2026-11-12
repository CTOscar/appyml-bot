import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

const NUDOS_A_KMH = 1.852;
const text = (obj) => ({ content: [{ type: 'text', text: JSON.stringify(obj) }] });
const fail = (msg) => ({ isError: true, content: [{ type: 'text', text: msg }] });
const like = (s) => `%${String(s).replace(/[\\%_]/g, '\\$&')}%`;

// Servidor MCP "Fleet-DB". Prototipo 1: SOLO LECTURA (ningún tool escribe).
// `pool` es un pool mysql2. En producción conviene que sea de un usuario MySQL con solo SELECT.
export function createFleetDbServer(pool) {
  const server = new McpServer({ name: 'fleet-db', version: '0.1.0' });

  server.registerTool(
    'leer_catalogo',
    {
      description:
        'Consulta el catálogo de flota. tipo: "equipos" (tractores), "implementos", "operadores" o "lotes". ' +
        '"buscar" filtra por texto (no. económico, marca, nombre...). Devuelve máximo 50 filas.',
      inputSchema: {
        tipo: z.enum(['equipos', 'implementos', 'operadores', 'lotes']),
        buscar: z.string().max(60).optional(),
      },
    },
    async ({ tipo, buscar }) => {
      const b = buscar ? like(buscar) : null;
      let sql;
      let params = [];
      if (tipo === 'equipos') {
        sql = `SELECT no_economico, marca, modelo, anio, sensor_diesel FROM equipos WHERE activo = 1
               ${b ? 'AND (no_economico LIKE ? OR marca LIKE ? OR modelo LIKE ?)' : ''} ORDER BY no_economico LIMIT 50`;
        if (b) params = [b, b, b];
      } else if (tipo === 'implementos') {
        sql = `SELECT no_economico, tipo, descripcion FROM implementos WHERE activo = 1
               ${b ? 'AND (no_economico LIKE ? OR tipo LIKE ? OR descripcion LIKE ?)' : ''} ORDER BY no_economico LIMIT 50`;
        if (b) params = [b, b, b];
      } else if (tipo === 'operadores') {
        sql = `SELECT nombre FROM operadores WHERE activo = 1 ${b ? 'AND nombre LIKE ?' : ''} ORDER BY nombre LIMIT 50`;
        if (b) params = [b];
      } else {
        sql = `SELECT r.nombre AS rancho, l.nombre AS lote, l.hectareas
               FROM lotes l JOIN ranchos r ON r.id = l.rancho_id WHERE l.activo = 1
               ${b ? 'AND (l.nombre LIKE ? OR r.nombre LIKE ?)' : ''} ORDER BY r.nombre, l.nombre LIMIT 50`;
        if (b) params = [b, b];
      }
      const [rows] = await pool.query(sql, params);
      return text({ tipo, total: rows.length, filas: rows });
    },
  );

  server.registerTool(
    'leer_telemetria_actual',
    {
      description:
        'Última posición y nivel de diésel de un tractor. "equipo" es el número económico (ej. "TR-12") o el id del dispositivo. ' +
        'El diésel viene en litros. Indica hace cuántos minutos se recibió el dato.',
      inputSchema: { equipo: z.string().min(1).max(40) },
    },
    async ({ equipo }) => {
      const esNum = /^\d+$/.test(equipo);
      const [eq] = await pool.query(
        `SELECT id, no_economico, device_id, sensor_diesel FROM equipos
         WHERE activo = 1 AND (no_economico = ? ${esNum ? 'OR device_id = ?' : ''}) LIMIT 1`,
        esNum ? [equipo, Number(equipo)] : [equipo],
      );
      if (!eq.length) return fail(`No encontré el equipo "${equipo}" en el catálogo.`);
      const e = eq[0];
      if (e.device_id == null) return fail(`El equipo ${e.no_economico} no tiene rastreador (device_id) asignado.`);
      const [rows] = await pool.query(
        `SELECT fix_time, lat, lon, speed_knots, fuel, ignition FROM position_samples
         WHERE device_id = ? ORDER BY fix_time DESC LIMIT 1`,
        [e.device_id],
      );
      if (!rows.length) return fail(`El equipo ${e.no_economico} aún no tiene posiciones registradas.`);
      const r = rows[0];
      const hace = Math.max(0, Math.round((Date.now() - new Date(r.fix_time).getTime()) / 60000));
      return text({
        equipo: e.no_economico,
        hace_minutos: hace,
        dato_viejo: hace > 30,
        lat: r.lat,
        lon: r.lon,
        velocidad_kmh: Math.round(Number(r.speed_knots) * NUDOS_A_KMH * 10) / 10,
        motor_encendido: !!r.ignition,
        diesel_litros: r.fuel == null ? null : Number(r.fuel),
        tiene_sensor_diesel: !!e.sensor_diesel,
      });
    },
  );

  // La identidad NO es un argumento del modelo: llega en _meta.userId, inyectada por el servicio.
  server.registerTool(
    'mi_asignacion',
    {
      description: 'La asignación de hoy de la persona que está hablando: tractor, implemento y lote. No necesita argumentos.',
      inputSchema: {},
    },
    async (_args, extra) => {
      const userId = Number(extra?._meta?.userId);
      if (!Number.isInteger(userId) || userId <= 0) return fail('No se pudo identificar a la persona.');
      const [ops] = await pool.query('SELECT id, nombre FROM operadores WHERE user_id = ? AND activo = 1 LIMIT 1', [userId]);
      if (!ops.length) return fail('Tu cuenta aún no está ligada a un operador en el catálogo. Avisa al jefe de maquinaria.');
      const [rows] = await pool.query(
        `SELECT a.fecha, a.estado, e.no_economico AS tractor, i.no_economico AS implemento,
                l.nombre AS lote, r.nombre AS rancho
         FROM asignaciones a
         JOIN equipos e ON e.id = a.equipo_id
         LEFT JOIN implementos i ON i.id = a.implemento_id
         LEFT JOIN lotes l ON l.id = a.lote_id
         LEFT JOIN ranchos r ON r.id = l.rancho_id
         WHERE a.operador_id = ? AND a.fecha = CURDATE() AND a.estado IN ('programada','en_curso')
         ORDER BY a.id LIMIT 5`,
        [ops[0].id],
      );
      return text({ operador: ops[0].nombre, asignaciones_hoy: rows });
    },
  );

  return server;
}
