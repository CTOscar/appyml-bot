-- Esquema del servicio de agentes (MySQL 8). Se aplica solo al arrancar (src/schema.mjs lo lee).
-- Convive con las tablas de panel-flota-api: users, device_settings, fence_settings, position_samples.

-- 01 Catálogo de flota ---------------------------------------------------
CREATE TABLE IF NOT EXISTS ranchos (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(120) NOT NULL,
  activo TINYINT(1) NOT NULL DEFAULT 1,
  UNIQUE KEY uq_rancho_nombre (nombre)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS lotes (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  rancho_id INT UNSIGNED NOT NULL,
  nombre VARCHAR(120) NOT NULL,
  hectareas DECIMAL(10,2) NULL,
  fence_id INT UNSIGNED NULL COMMENT 'geocerca en fence_settings / Traccar',
  activo TINYINT(1) NOT NULL DEFAULT 1,
  UNIQUE KEY uq_lote (rancho_id, nombre),
  CONSTRAINT fk_lote_rancho FOREIGN KEY (rancho_id) REFERENCES ranchos(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS equipos (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  no_economico VARCHAR(40) NOT NULL,
  device_id INT UNSIGNED NULL COMMENT 'id del dispositivo en Traccar / device_settings',
  tipo ENUM('tractor') NOT NULL DEFAULT 'tractor',
  marca VARCHAR(60) NOT NULL DEFAULT '',
  modelo VARCHAR(60) NOT NULL DEFAULT '',
  anio SMALLINT UNSIGNED NULL,
  imei VARCHAR(20) NULL,
  sensor_diesel TINYINT(1) NOT NULL DEFAULT 0,
  activo TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_equipo_no (no_economico),
  UNIQUE KEY uq_equipo_device (device_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS implementos (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  no_economico VARCHAR(40) NOT NULL,
  tipo VARCHAR(60) NOT NULL DEFAULT '',
  descripcion VARCHAR(190) NOT NULL DEFAULT '',
  activo TINYINT(1) NOT NULL DEFAULT 1,
  UNIQUE KEY uq_impl_no (no_economico)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS operadores (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NULL COMMENT 'cuenta del panel (users.id), si tiene',
  nombre VARCHAR(120) NOT NULL,
  telefono VARCHAR(40) NOT NULL DEFAULT '',
  activo TINYINT(1) NOT NULL DEFAULT 1,
  UNIQUE KEY uq_operador_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS plan_mantenimiento (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  equipo_id INT UNSIGNED NOT NULL,
  descripcion VARCHAR(190) NOT NULL,
  cada_horas INT UNSIGNED NOT NULL,
  activo TINYINT(1) NOT NULL DEFAULT 1,
  KEY ix_plan_equipo (equipo_id),
  CONSTRAINT fk_plan_equipo FOREIGN KEY (equipo_id) REFERENCES equipos(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 02 Operación en campo (solo la asignación; checklists y fallas llegan en el Paso 4) ----
CREATE TABLE IF NOT EXISTS asignaciones (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  fecha DATE NOT NULL,
  equipo_id INT UNSIGNED NOT NULL,
  implemento_id INT UNSIGNED NULL,
  operador_id INT UNSIGNED NOT NULL,
  lote_id INT UNSIGNED NULL,
  estado ENUM('programada','en_curso','cerrada','cancelada') NOT NULL DEFAULT 'programada',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY ix_asig_operador (operador_id, fecha),
  KEY ix_asig_equipo (equipo_id, fecha),
  CONSTRAINT fk_asig_equipo FOREIGN KEY (equipo_id) REFERENCES equipos(id),
  CONSTRAINT fk_asig_impl FOREIGN KEY (implemento_id) REFERENCES implementos(id),
  CONSTRAINT fk_asig_operador FOREIGN KEY (operador_id) REFERENCES operadores(id),
  CONSTRAINT fk_asig_lote FOREIGN KEY (lote_id) REFERENCES lotes(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Agentes ----------------------------------------------------------------
-- La API del panel solo conoce admin/user. El rol de agente vive aquí, sin tocar panel-flota-api.
CREATE TABLE IF NOT EXISTS agent_roles (
  user_id INT UNSIGNED PRIMARY KEY,
  agent_role ENUM('operador','jefe_campo','jefe_taller','almacenista','director') NOT NULL,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Telemetría del sistema (Fase 2 del prototipo): tokens y latencia por agente.
CREATE TABLE IF NOT EXISTS agent_usage_log (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  user_id INT UNSIGNED NULL,
  agent VARCHAR(30) NOT NULL,
  model VARCHAR(60) NOT NULL,
  input_tokens INT UNSIGNED NOT NULL DEFAULT 0,
  output_tokens INT UNSIGNED NOT NULL DEFAULT 0,
  cache_read_tokens INT UNSIGNED NOT NULL DEFAULT 0,
  cache_write_tokens INT UNSIGNED NOT NULL DEFAULT 0,
  tool_calls SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  iterations SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  stop_reason VARCHAR(30) NULL,
  latency_ms INT UNSIGNED NOT NULL DEFAULT 0,
  ok TINYINT(1) NOT NULL DEFAULT 1,
  KEY ix_usage_time (created_at),
  KEY ix_usage_agent (agent, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
