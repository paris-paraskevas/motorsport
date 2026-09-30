// Map Backgrounds (P2.12; APEX: Shared Components › Map Backgrounds): the named basemaps a Map region draws its tiles from.
// Declared in code and importing nothing at runtime, so the catalogue travels with every route's chunk through the document
// parser as the sources do. A keyed provider names its environment variable here alone: the renderer fills the value into the
// URL on the server, and no row and no designer screen ever carries it (rule 10). Each background is a light tile set and, where
// the provider has one, a dark set for the theme's dark family; the frame swaps them as the root's class changes.

export type MapFamily = 'light' | 'dark';

export interface TileSet {
  /** Leaflet's template: {z}, {x}, {y}; `{key}` where a keyed provider takes its key. */
  url: string;
  /** The words Leaflet's attribution control shows: the provider's terms. */
  attribution: string;
  /** The deepest zoom the provider draws detail at; the map stops there. */
  maxZoom: number;
}

export interface MapBackground {
  key: string;
  name: string;
  /** One line for the catalogue's table. */
  holds: string;
  light: TileSet;
  /** The dark family's set; null draws the light set for both. */
  dark: TileSet | null;
  /** The environment variable a keyed provider reads; null for a key-less one. */
  keyVar: string | null;
}

const ESRI_ATTRIBUTION = 'Tiles © Esri · Esri, HERE, Garmin, © OpenStreetMap contributors';
const esriCanvas = (layer: string) => `https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/${layer}/MapServer/tile/{z}/{y}/{x}`;

/** The one background the slot named: Esri's grey canvas pair, key-less, the vendor of the Circuit Map's satellite layer.
 *  Its detail ends at zoom 16 (deeper requests answer the same tiles enlarged). */
export const MAP_BACKGROUNDS: readonly MapBackground[] = [
  {
    key: 'canvas',
    name: 'Canvas',
    holds: 'Esri’s grey canvas, a light and a dark set; key-less; detail to zoom 16',
    light: { url: esriCanvas('World_Light_Gray_Base'), attribution: ESRI_ATTRIBUTION, maxZoom: 16 },
    dark: { url: esriCanvas('World_Dark_Gray_Base'), attribution: ESRI_ATTRIBUTION, maxZoom: 16 },
    keyVar: null,
  },
];

export const DEFAULT_MAP_BACKGROUND = 'canvas';

export function findMapBackground(key: string): MapBackground | null {
  return MAP_BACKGROUNDS.find(b => b.key === key) ?? null;
}

/** The set a family draws: the dark one for the dark family where the background has it, else the light. */
export function tilesFor(background: Pick<MapBackground, 'light' | 'dark'>, family: MapFamily): TileSet {
  return family === 'dark' && background.dark ? background.dark : background.light;
}

/** A keyed provider's URL with the variable's value where `{key}` stands (empty when the variable is unset); a key-less URL as given. */
export function fillKey(url: string, env: Readonly<Record<string, string | undefined>>, keyVar: string | null): string {
  if (keyVar === null) return url;
  return url.split('{key}').join(env[keyVar] ?? '');
}
