const KEY = 'dead-sector-defense-save-v1';
const MAX_LEVEL = 30;

const DEFAULT_SAVE = {
  currentLevel: 1,
  mapLevel: 1,
  completedLevels: [],
  stars: {},
  scrap: 0,
  technology: 0,
  crystals: 0,
  towerLevels: {},
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
  return {
    ...freshSave(),
    ...data,
    currentLevel: Number.isFinite(Number(data.currentLevel))
      ? Math.min(MAX_LEVEL, Math.max(1, Math.floor(Number(data.currentLevel))))
      : 1,
    mapLevel: Number.isFinite(Number(data.mapLevel))
      ? Math.min(MAX_LEVEL, Math.max(1, Math.floor(Number(data.mapLevel))))
      : Math.min(MAX_LEVEL, Math.max(1, Math.floor(Number(data.currentLevel) || 1))),
    completedLevels: Array.isArray(data.completedLevels) ? data.completedLevels : [],
    stars: data.stars && typeof data.stars === 'object' ? data.stars : {},
    crystals: Number.isFinite(data.crystals) ? Math.max(0, Math.floor(data.crystals)) : 0,
    towerLevels: data.towerLevels && typeof data.towerLevels === 'object' ? data.towerLevels : {},
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
