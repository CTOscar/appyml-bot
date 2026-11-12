import { describe, expect, it } from 'vitest';
import { agrupar, detectarPlataforma, elegir, tamano } from './descargas.js';

const F = [
  { os: 'windows', arch: 'x64', kind: 'portable', file: 'a' },
  { os: 'windows', arch: 'arm64', kind: 'instalador', file: 'b' },
  { os: 'linux', arch: 'x64', kind: 'tar.gz', file: 'c' },
  { os: 'android', arch: null, kind: 'apk', file: 'd' },
];
describe('detectar el equipo', () => {
  it('Android, Windows y Linux', () => {
    expect(detectarPlataforma({ userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8)', platform: 'Linux armv8l' }, null).os).toBe('android');
    expect(detectarPlataforma({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', platform: 'Win32' }, null)).toEqual({ os: 'windows', arch: 'x64' });
    expect(detectarPlataforma({ userAgent: 'X11; Linux x86_64', platform: 'Linux x86_64' }, null)).toEqual({ os: 'linux', arch: 'x64' });
  });
  it('userAgentData manda la arquitectura', () => {
    expect(detectarPlataforma({ userAgent: 'Windows NT 10.0' }, { platform: 'Windows', architecture: 'arm' })).toEqual({ os: 'windows', arch: 'arm64' });
  });
});
describe('elegir archivo', () => {
  it('misma arquitectura primero, aunque sea portátil', () => {
    expect(elegir(F, { os: 'windows', arch: 'x64' }).file).toBe('a');
    expect(elegir(F, { os: 'windows', arch: 'arm64' }).file).toBe('b');
  });
  it('sin arquitectura conocida prefiere el instalador; sin archivos para el sistema devuelve null', () => {
    expect(elegir(F, { os: 'windows', arch: null }).file).toBe('b');
    expect(elegir(F, { os: 'mac', arch: null })).toBeNull();
  });
});
describe('formato y grupos', () => {
  it('tamano', () => { expect(tamano(1536)).toBe('1.5 KB'); expect(tamano(0)).toBe('—'); expect(tamano(80 * 1024 * 1024)).toBe('80.0 MB'); });
  it('agrupar en orden', () => { expect(agrupar(F).map((g) => g.os)).toEqual(['windows', 'linux', 'android']); });
});
