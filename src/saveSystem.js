const KEY = 'dead-sector-defense-save-v1';
const MAX_LEVEL = 30;

const DEFAULT_SAVE = {
  currentLevel: 1,
  mapLevel: 1,
  completedLevels: [],
  stars: {},
  supplies: 0,
  // Alias de lectura/escritura para no invalidar partidas antiguas que aún
  // guardaban este recurso como "scrap".
  scrap: 0,
  technology: 0,
  crystals: 0,
  gears: { common: 0, rare: 0, epic: 0, legendary: 0 },
  towerLevels: { gunner: 1, cannon: 1, flame: 1, mortar: 1, tesla: 1, sniper: 1 },
  firstVictoryLevels: [],
  selectedCommander: 'engineer',
  unlockedTowers: ['gunner', 'cannon', 'flame', 'sniper', 'tesla', 'mortar'],
  infinite: {
    currentPhase: 1,
    record: 0,
    seed: 2654435769,
    completedPhases: [],
    rewardsClaimed: [],
    activeRun: null,
  },
  settings: { sound: true, haptics: true, developer: false },
};

function freshSave() {
  return typeof structuredClone === 'function'
    ? structuredClone(DEFAULT_SAVE)
    : JSON.parse(JSON.stringify(DEFAULT_SAVE));
}

function normalizeSave(value) {
  const data = value && typeof value === 'object' ? value : {};
  const supplies = Number.isFinite(Number(data.supplies)) ? Number(data.supplies) : Number(data.scrap);
  const rawGears = data.gears && typeof data.gears === 'object' ? data.gears : {};
  const gears = Object.fromEntries(Object.keys(DEFAULT_SAVE.gears).map((rarity) => [
    rarity,
    Number.isFinite(Number(rawGears[rarity])) ? Math.max(0, Math.floor(Number(rawGears[rarity]))) : 0,
  ]));
  const towerLevels = Object.fromEntries(Object.entries(DEFAULT_SAVE.towerLevels).map(([type, defaultLevel]) => [
    type,
    Number.isFinite(Number(data.towerLevels?.[type]))
      ? Math.min(10, Math.max(1, Math.floor(Number(data.towerLevels[type]))))
      : defaultLevel,
  ]));
  return {
    ...freshSave(),
    ...data,
    currentLevel: Number.isFinite(Number(data.currentLevel))
      ? Math.min(MAX_LEVEL, Math.max(1, Math.floor(Number(data.currentLevel))))
      : 1,
    mapLevel: Number.isFinite(Number(data.mapLevel))
      ? Math.min(MAX_LEVEL, Math.max(1, Math.floor(Number(data.mapLevel))))
      : Math.min(MAX_LEVEL, Math.max(1, Math.floor(Number(data.currentLevel) || 1))),
    completedLevels: Array.isArray(data.completedLevels) ? [...new Set(data.completedLevels.map(Number).filter((item) => Number.isFinite(item) && item >= 1).map(Math.floor))] : [],
    firstVictoryLevels: Array.isArray(data.firstVictoryLevels)
      ? [...new Set(data.firstVictoryLevels.map(Number).filter((item) => Number.isFinite(item) && item >= 1).map(Math.floor))]
      : Array.isArray(data.completedLevels) ? [...new Set(data.completedLevels.map(Number).filter((item) => Number.isFinite(item) && item >= 1).map(Math.floor))] : [],
    stars: data.stars && typeof data.stars === 'object' ? data.stars : {},
    supplies: Number.isFinite(supplies) ? Math.max(0, Math.floor(supplies)) : 0,
    scrap: Number.isFinite(supplies) ? Math.max(0, Math.floor(supplies)) : 0,
    crystals: Number.isFinite(data.crystals) ? Math.max(0, Math.floor(data.crystals)) : 0,
    gears,
    towerLevels,
    unlockedTowers: Array.isArray(data.unlockedTowers)
      ? [...new Set([...data.unlockedTowers, ...DEFAULT_SAVE.unlockedTowers])]
      : [...DEFAULT_SAVE.unlockedTowers],
    infinite: normalizeInfinite(data.infinite),
    settings: { ...DEFAULT_SAVE.settings, ...(data.settings && typeof data.settings === 'object' ? data.settings : {}) },
  };
}

function normalizeInfinite(value) {
  const source = value && typeof value === 'object' ? value : {};
  const phase = Number.isFinite(Number(source.currentPhase)) ? Math.max(1, Math.floor(Number(source.currentPhase))) : 1;
  return {
    ...freshSave().infinite,
    ...source,
    currentPhase: phase,
    record: Number.isFinite(Number(source.record)) ? Math.max(0, Math.floor(Number(source.record))) : 0,
    seed: Number.isFinite(Number(source.seed)) ? Number(source.seed) >>> 0 : freshSave().infinite.seed,
    completedPhases: Array.isArray(source.completedPhases) ? [...new Set(source.completedPhases.map(Number).filter((item) => Number.isFinite(item) && item >= 1).map(Math.floor))] : [],
    rewardsClaimed: Array.isArray(source.rewardsClaimed) ? [...new Set(source.rewardsClaimed.map(Number).filter((item) => Number.isFinite(item) && item >= 1).map(Math.floor))] : [],
    activeRun: source.activeRun && typeof source.activeRun === 'object' ? source.activeRun : null,
  };
}

export class SaveSystem {
  static load() {
    try {
      const storage = typeof localStorage !== 'undefined' ? localStorage : null;
      const raw = storage?.getItem(KEY);
      return normalizeSave(raw ? JSON.parse(raw) : null);
    } catch (error) {
      console.warn('No se pudo leer la partida guardada; se usará una nueva.', error);
      return freshSave();
    }
  }

  static save(data) {
    try {
      const storage = typeof localStorage !== 'undefined' ? localStorage : null;
      if (!storage?.setItem) return;
      storage.setItem(KEY, JSON.stringify(data));
    } catch (error) {
      console.warn('No se pudo guardar la partida; la sesión seguirá siendo jugable.', error);
    }
  }
}
