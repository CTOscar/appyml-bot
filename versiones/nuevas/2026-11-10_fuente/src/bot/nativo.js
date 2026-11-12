// ¿Corre dentro de una app instalada (Electron en escritorio o Capacitor en Android) y no en un navegador?
// Electron lo marca en su preload (window.PF_NATIVO); Capacitor expone window.Capacitor.
export const esNativo = () => typeof window !== 'undefined' && !!(window.PF_NATIVO || window.Capacitor?.isNativePlatform?.());
