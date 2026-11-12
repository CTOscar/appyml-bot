// Preload (con contextIsolation y sandbox): solo le dice al bot que corre dentro de la app de escritorio.
// No expone Node ni nada del sistema: únicamente la plataforma y la arquitectura.
const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('PF_NATIVO', Object.freeze({
  tipo: 'escritorio',
  plataforma: process.platform, // 'win32' | 'linux' | 'darwin'
  arquitectura: process.arch, // 'x64' | 'arm64' | 'ia32'
}));
