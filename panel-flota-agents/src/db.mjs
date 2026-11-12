import mysql from 'mysql2/promise';

export function createPool(db, { user, password } = {}) {
  if (!db.name || !(user ?? db.user)) {
    throw new Error('Faltan DB_NAME y DB_USER (ver .env.example).');
  }
  return mysql.createPool({
    host: db.host,
    port: db.port,
    user: user ?? db.user,
    password: password ?? db.password,
    database: db.name,
    waitForConnections: true,
    connectionLimit: 5,
    charset: 'utf8mb4',
    dateStrings: false,
    timezone: 'Z',
  });
}
