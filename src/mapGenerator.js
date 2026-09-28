import { getLevelMap } from './levelData.js';

export class MapGenerator {
  static generate(level, seed = level * 9127) {
    const map = getLevelMap(level);
    const paths = map.paths || [map.points];
    // La colocación ya no depende de casillas predefinidas. Conservamos los
    // mapas manuales y sus decoraciones, pero el terreno se valida en tiempo
    // real contra el camino y las defensas existentes.
    return { ...map, buildSpots: [], seed: level, sourceSeed: seed, paths };
  }
}
