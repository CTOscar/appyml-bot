import { describe, expect, it } from 'vitest';
import { parseGeoJSON, parseKML, parseLotes, toGPX, toGeoJSON, toKML, toWkt } from './geoFormats.js';
import { parseWkt } from '../fleet/ops.js';

const CUADRO = [[22.70, -105.90], [22.70, -105.89], [22.71, -105.89], [22.71, -105.90]];
const geojson = (geometry, props = { name: 'Lote Norte' }) => JSON.stringify({ type: 'FeatureCollection', features: [{ type: 'Feature', properties: props, geometry }] });
const poly = (pts) => ({ type: 'Polygon', coordinates: [[...pts.map((p) => [p[1], p[0]]), [pts[0][1], pts[0][0]]]] });

describe('importar GeoJSON', () => {
  it('lee un polígono, voltea lon/lat a lat/lon y quita el punto de cierre', () => {
    const r = parseGeoJSON(geojson(poly(CUADRO)));
    expect(r.lotes).toHaveLength(1);
    expect(r.lotes[0].name).toBe('Lote Norte');
    expect(r.lotes[0].points).toEqual(CUADRO);
    expect(r.lotes[0].ha).toBeGreaterThan(50); // ~1.1 km × 1 km
  });
  it('MultiPolygon da un lote por polígono; puntos y líneas se saltan', () => {
    const multi = { type: 'MultiPolygon', coordinates: [poly(CUADRO).coordinates, poly(CUADRO).coordinates] };
    const r = parseGeoJSON(JSON.stringify({ type: 'FeatureCollection', features: [
      { type: 'Feature', properties: { name: 'Doble' }, geometry: multi },
      { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [-105.9, 22.7] } },
    ] }));
    expect(r.lotes.map((l) => l.name)).toEqual(['Doble', 'Doble (2)']);
    expect(r.saltados).toBe(1);
  });
  it('rechaza coordenadas fuera de rango y JSON roto', () => {
    expect(parseGeoJSON(geojson(poly([[200, 0], [200, 1], [201, 1]]))).lotes).toHaveLength(0);
    expect(parseGeoJSON('{no es json').error).toMatch(/GeoJSON/);
  });
  it('sin nombre usa «Lote importado N»', () => {
    expect(parseGeoJSON(geojson(poly(CUADRO), {})).lotes[0].name).toBe('Lote importado 1');
  });
});

describe('importar KML', () => {
  const kml = `<?xml version="1.0"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document>
    <Placemark><name>Pozo 3 · Lote 1</name><Polygon><outerBoundaryIs><LinearRing><coordinates>
      -105.90,22.70,0 -105.89,22.70,0 -105.89,22.71,0 -105.90,22.71,0 -105.90,22.70,0
    </coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark>
    <Placemark><name>Un punto</name><Point><coordinates>-105.9,22.7,0</coordinates></Point></Placemark>
  </Document></kml>`;
  it('lee los Placemark con Polygon y salta lo demás', () => {
    const r = parseKML(kml);
    expect(r.lotes).toHaveLength(1);
    expect(r.lotes[0].name).toBe('Pozo 3 · Lote 1');
    expect(r.lotes[0].points[0]).toEqual([22.70, -105.90]);
    expect(r.saltados).toBe(1);
  });
  it('KML roto da error', () => {
    expect(parseKML('<kml><Document>').error).toMatch(/KML/);
  });
  it('parseLotes elige el lector por extensión o contenido', () => {
    expect(parseLotes('a.kml', kml).lotes).toHaveLength(1);
    expect(parseLotes('sin-extension', kml).lotes).toHaveLength(1);
    expect(parseLotes('a.geojson', geojson(poly(CUADRO))).lotes).toHaveLength(1);
    expect(parseLotes('a.geojson', geojson({ type: 'Point', coordinates: [0, 0] })).error).toMatch(/polígonos/);
    expect(parseLotes('a.kml', '  ').error).toMatch(/vacío/);
  });
});

describe('WKT de Traccar', () => {
  it('cierra el anillo y usa el orden «lat lon»', () => {
    const w = toWkt(CUADRO);
    expect(w.startsWith('POLYGON((22.700000 -105.900000,')).toBe(true);
    const back = parseWkt(w);
    expect(back.type).toBe('polygon');
    expect(back.points[0]).toEqual(back.points[back.points.length - 1]);
    expect(back.points).toHaveLength(5);
  });
  it('no duplica un anillo que ya viene cerrado', () => {
    expect(parseWkt(toWkt([...CUADRO, CUADRO[0]])).points).toHaveLength(5);
  });
});

describe('exportar', () => {
  const tracks = [{ name: 'TRC-0001 & <prueba>', pts: [[22.7, -105.9, Date.UTC(2026, 10, 12, 15, 0, 0), 7.2], [22.701, -105.901, Date.UTC(2026, 10, 12, 15, 0, 10), 0]] }];
  it('GPX con hora, velocidad en m/s y nombres escapados', () => {
    const g = toGPX(tracks, { ahora: new Date('2026-11-12T16:00:00Z') });
    expect(g).toContain('<gpx version="1.1"');
    expect(g).toContain('<name>TRC-0001 &amp; &lt;prueba&gt;</name>');
    expect(g).toContain('<trkpt lat="22.700000" lon="-105.900000"><time>2026-11-12T15:00:00.000Z</time><extensions><speed>2.00</speed>');
    expect(g.match(/<trkpt /g)).toHaveLength(2);
    expect(new DOMParser().parseFromString(g, 'application/xml').getElementsByTagName('parsererror')).toHaveLength(0);
  });
  it('KML con lotes y recorridos, y se puede volver a leer', () => {
    const k = toKML({ tracks, lotes: [{ name: 'Lote A', points: CUADRO }] });
    expect(k).toContain('<LineString>');
    expect(parseKML(k).lotes).toEqual([expect.objectContaining({ name: 'Lote A', points: CUADRO })]);
  });
  it('GeoJSON: lotes y recorridos con lon,lat y round-trip de los lotes', () => {
    const j = JSON.parse(toGeoJSON({ tracks, lotes: [{ name: 'Lote A', points: CUADRO }] }));
    expect(j.features.map((f) => f.geometry.type)).toEqual(['Polygon', 'LineString']);
    expect(j.features[1].geometry.coordinates[0]).toEqual([-105.9, 22.7]);
    expect(parseGeoJSON(toGeoJSON({ lotes: [{ name: 'Lote A', points: CUADRO }] })).lotes[0].points).toEqual(CUADRO);
  });
  it('recorridos de un solo punto no se exportan como línea', () => {
    expect(JSON.parse(toGeoJSON({ tracks: [{ name: 'x', pts: [[1, 1, 0, 0]] }] })).features).toHaveLength(0);
  });
});
