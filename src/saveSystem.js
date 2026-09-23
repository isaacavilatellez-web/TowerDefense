const KEY = 'dead-sector-defense-save-v1';

const DEFAULT_SAVE = {
  currentLevel: 1,
  completedLevels: [],
  stars: {},
  scrap: 0,
  technology: 0,
  crystals: 0,
  selectedCommander: 'engineer',
  unlockedTowers: ['gunner', 'cannon', 'flame'],
  settings: { sound: true, haptics: true },
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
    completedLevels: Array.isArray(data.completedLevels) ? data.completedLevels : [],
    stars: data.stars && typeof data.stars === 'object' ? data.stars : {},
    unlockedTowers: Array.isArray(data.unlockedTowers) ? data.unlockedTowers : [...DEFAULT_SAVE.unlockedTowers],
    settings: { ...DEFAULT_SAVE.settings, ...(data.settings && typeof data.settings === 'object' ? data.settings : {}) },
  };
}

export class SaveSystem {
  static load() {
    try {
      const raw = localStorage.getItem(KEY);
      return normalizeSave(raw ? JSON.parse(raw) : null);
    } catch (error) {
      console.warn('No se pudo leer la partida guardada; se usará una nueva.', error);
      return freshSave();
    }
  }

  static save(data) {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch (error) {
      console.warn('No se pudo guardar la partida; la sesión seguirá siendo jugable.', error);
    }
  }
}
