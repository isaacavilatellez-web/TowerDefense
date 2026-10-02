const clone = (value) => (typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value)));

// El campo de batalla ocupa únicamente el rectángulo entre el HUD y el panel inferior.
// Los mapas se describen en 0..1 y se convierten aquí para que la ruta visual y la real
// compartan coordenadas aunque cambie el tamaño del viewport.
export const MAP_SPACE = { width: 540, height: 640 };
const point = ([x, y]) => ({ x: Math.round(x * MAP_SPACE.width), y: Math.round(y * MAP_SPACE.height) });
const obstacle = ([x, y, size, kind, rotation = 0]) => ({ x: x * MAP_SPACE.width, y: y * MAP_SPACE.height, size, kind, rotation });

const meadow = [
  [.08, .14, 15, 'tree', -.2], [.9, .24, 12, 'rock', .3], [.12, .52, 13, 'shrub'],
  [.86, .7, 15, 'tree', .2], [.12, .86, 10, 'stump'], [.87, .84, 10, 'grass'],
];
const forest = [
  [.1, .12, 15, 'tree', -.4], [.88, .28, 16, 'tree', .3], [.1, .52, 14, 'shrub'],
  [.88, .7, 12, 'rock', -.2], [.12, .84, 14, 'tree', .4],
];
const ruins = [
  [.1, .16, 15, 'rock'], [.88, .28, 14, 'stump', .1], [.11, .5, 17, 'rock', .4],
  [.88, .68, 15, 'shrub'], [.1, .84, 12, 'grass'],
];

const layout = (paths, buildSpots, obstacles, background = 'meadow') => ({
  paths: paths.map((path) => path.map(point)),
  points: paths[0].map(point),
  buildSpots: buildSpots.map(([x, y, zone = 'grass']) => ({ x: x * MAP_SPACE.width, y: y * MAP_SPACE.height, zone, occupied: false })),
  obstacles: obstacles.map(obstacle),
  background,
});

// Trazados manuales con margen seguro del 8..92%. Cada nivel conserva una estrategia distinta.
export const LEVEL_MAPS = {
  1: layout([[[.08, .08], [.16, .08], [.5, .25], [.27, .39], [.27, .58], [.7, .72], [.7, .83], [.5, .9]]], [[.14, .2], [.86, .2], [.12, .46], [.5, .46], [.88, .6], [.5, .78], [.16, .84], [.84, .86]], meadow),
  2: layout([[[.08, .08], [.1, .08], [.84, .08], [.84, .25], [.18, .38], [.18, .55], [.84, .69], [.84, .82], [.5, .9]]], [[.12, .2], [.5, .2], [.88, .3], [.1, .46], [.5, .45], [.9, .58], [.5, .75], [.12, .8]], forest),
  3: layout([[[.08, .09], [.1, .09], [.88, .09], [.88, .29], [.2, .29], [.2, .5], [.74, .5], [.74, .7], [.5, .9]]], [[.5, .18], [.12, .2], [.88, .4], [.5, .4], [.12, .62], [.5, .62], [.88, .8], [.2, .82]], ruins),
  4: layout([[[.08, .12], [.3, .12], [.5, .3], [.5, .9]], [[.92, .12], [.7, .12], [.5, .3], [.5, .9]]], [[.13, .22], [.87, .22], [.18, .42], [.82, .42], [.32, .56], [.68, .56], [.14, .76], [.86, .76]], forest),
  5: layout([[[.08, .13], [.3, .13], [.42, .3], [.42, .53], [.5, .7], [.5, .9]], [[.92, .13], [.7, .13], [.58, .3], [.58, .53], [.5, .7], [.5, .9]]], [[.12, .24], [.88, .24], [.22, .42], [.78, .42], [.15, .62], [.85, .62], [.3, .78], [.7, .78]], ruins),
  6: layout([[[.08, .08], [.12, .08], [.5, .08], [.18, .19], [.18, .35], [.82, .46], [.82, .63], [.28, .76], [.28, .84], [.5, .9]]], [[.5, .14], [.08, .27], [.5, .3], [.9, .39], [.5, .58], [.1, .68], [.55, .8], [.86, .84]], meadow),
  7: layout([[[.08, .08], [.1, .08], [.86, .19], [.12, .34], [.86, .5], [.12, .65], [.5, .9]]], [[.25, .13], [.1, .22], [.87, .28], [.25, .43], [.1, .55], [.87, .61], [.5, .78]], forest),
  8: layout([[[.08, .08], [.12, .08], [.86, .08], [.86, .29], [.12, .29], [.12, .55], [.86, .55], [.86, .75], [.5, .9]]], [[.5, .18], [.25, .4], [.9, .4], [.5, .46], [.1, .68], [.75, .68], [.5, .82]], ruins),
  9: layout([[[.08, .08], [.12, .08], [.5, .08], [.8, .2], [.8, .37], [.2, .48], [.2, .66], [.8, .76], [.8, .84], [.5, .9]]], [[.18, .16], [.5, .23], [.68, .3], [.65, .43], [.82, .54], [.15, .82], [.5, .8]], meadow),
  10: layout([[[.08, .12], [.35, .12], [.5, .27], [.65, .12], [.92, .12], [.5, .47], [.5, .68], [.5, .9]]], [[.17, .22], [.83, .22], [.18, .39], [.82, .39], [.25, .58], [.75, .58], [.2, .78], [.8, .78]], ruins),
};

export function getLevelMap(level) {
  const key = ((Math.max(1, level) - 1) % 10) + 1;
  const source = LEVEL_MAPS[key] || LEVEL_MAPS[1];
  const map = clone(source);
  map.points = map.paths[0];
  map.seed = key;
  return map;
}

export function getWavePlan(level) {
  const pressure = Math.max(0, level - 1);
  const counts = [3, 4, 5].map((count, index) => count + Math.floor(pressure * (.7 + index * .25)));
  const later = [3, 4, 5].map((count, index) => count + Math.floor(pressure * (.8 + index * .3)));
  const plan = [
    { type: 'wave', number: 1, enemies: counts[0], kind: 'normal', interval: Math.max(2.3, 3.5 - pressure * .05) },
    { type: 'wave', number: 2, enemies: counts[1], kind: pressure >= 1 ? 'runner' : 'normal', interval: Math.max(2.1, 3.15 - pressure * .05) },
    { type: 'wave', number: 3, enemies: counts[2], kind: pressure >= 2 ? 'tank' : 'normal', interval: Math.max(1.9, 2.9 - pressure * .06) },
    { type: 'miniboss', label: 'MINIBOSS', enemy: 'mini', rest: 4 },
    { type: 'wave', number: 4, enemies: later[0], kind: pressure >= 4 ? 'armored' : 'runner', interval: Math.max(1.8, 2.75 - pressure * .06) },
    { type: 'wave', number: 5, enemies: later[1], kind: pressure >= 5 ? 'regenerator' : 'tank', interval: Math.max(1.65, 2.55 - pressure * .06) },
    { type: 'wave', number: 6, enemies: later[2], kind: pressure >= 6 ? 'runner' : 'normal', interval: Math.max(1.5, 2.35 - pressure * .06) },
    { type: 'miniboss', label: 'MINIBOSS', enemy: 'mini', rest: 4 },
    { type: 'wave', number: 7, enemies: later[0] + 1, kind: pressure >= 7 ? 'armored' : 'tank', interval: Math.max(1.35, 2.1 - pressure * .06) },
    { type: 'wave', number: 8, enemies: later[1] + 1, kind: pressure >= 8 ? 'regenerator' : 'runner', interval: Math.max(1.2, 1.95 - pressure * .06) },
    { type: 'boss', label: 'BOSS FINAL', enemy: 'boss' },
  ];
  plan.ambientSpawn = {
    enabled: true,
    intervalStart: Math.max(5.2, 7.2 - pressure * .12),
    intervalMin: Math.max(3.6, 3.8 - pressure * .04),
    intervalStep: .12,
    bossMultiplier: 1.45,
    maxPerPhaseStart: 2,
    maxPerPhaseStep: 1,
  };
  return plan;
}
