// Icono del clima en SVG (Lucide) en lugar del emoji de `wmo()`: se ve igual en todos los sistemas, toma el color del tema
// y no se lee en voz alta (la condición siempre va escrita al lado).
import clsx from 'clsx';
import { Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudRain, CloudSun, Minus, Moon, Snowflake, Sun } from 'lucide-react';

const MAP = {
  '☀️': [Sun, 'text-warn'], '🌤️': [CloudSun, 'text-warn'], '⛅': [CloudSun, 'text-warn'], '☁️': [Cloud, 'text-soft'], '🌫️': [CloudFog, 'text-muted'],
  '🌦️': [CloudDrizzle, 'text-info'], '🌧️': [CloudRain, 'text-info'], '❄️': [Snowflake, 'text-info'], '⛈️': [CloudLightning, 'text-warn'], '🌙': [Moon, 'text-accent'],
};
export function WeatherIcon({ glyph, className = 'size-5' }) {
  const [Icon, tone] = MAP[glyph] || [Minus, 'text-muted'];
  return <Icon aria-hidden strokeWidth={1.6} className={clsx('shrink-0', tone, className)} />;
}
