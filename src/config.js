export const GAME_CONFIG = {
  map: { width: 960, height: 620, baseRadius: 30 },
  economy: {
    startingCoins: 120,
    clickBase: 1,
    clickGrowth: 1.8,
    autoCoinBase: 0,
    killReward: 5,
    bossReward: 75,
  },
  levels: {
    startingBaseHp: 100,
    // Curva suave y editable: los primeros tres niveles son de aprendizaje.
    difficulty: {
      enemyCountBase: 18,
      enemyCountPerLevel: 3.8,
      enemyHpScale: 1.055,
      enemySpeedScale: 1.012,
      spawnIntervalStart: 2.35,
      spawnIntervalMin: 0.48,
      spawnIntervalStep: 0.105,
      initialDelay: 3.2,
      runnerStartLevel: 4,
      runnerChanceStart: 0.04,
      runnerChanceStep: 0.018,
      tankStartLevel: 5,
      tankChanceStart: 0.025,
      tankChanceStep: 0.012,
      miniBossThresholdsEarly: [65],
      miniBossThresholdsMid: [45, 80],
      miniBossThresholdsLate: [30, 58, 82],
      bossHpBase: 900,
      bossHpPerLevel: 280,
      bossUnlockDelay: 2.8,
    },
  },
  waves: {
    miniBossPercentages: [65],
  },
  towers: {
    gunner: { id: 'gunner', name: 'Ametralladora', shortName: 'AMT', icon: '▦', color: '#9a7048', cost: 55, damage: 15, cooldown: 0.42, range: 130, type: 'Bala', splash: 0, description: 'Cadencia rápida y fiable.' },
    cannon: { id: 'cannon', name: 'Cañón', shortName: 'CAÑ', icon: '◉', color: '#b9753d', cost: 90, damage: 62, cooldown: 1.35, range: 175, type: 'Explosivo', splash: 56, description: 'Golpea grupos con explosiones.' },
    flame: { id: 'flame', name: 'Lanzallamas', shortName: 'FLM', icon: '✦', color: '#d65e32', cost: 75, damage: 9, cooldown: 0.18, range: 92, type: 'Fuego', splash: 38, description: 'Daño continuo en corto alcance.' },
  },
  enemies: {
    normal: { name: 'Caminante', hp: 95, speed: 0.038, reward: 5, color: '#9bb5a4', radius: 10 },
    runner: { name: 'Runner', hp: 58, speed: 0.075, reward: 7, color: '#f2d27d', radius: 8 },
    tank: { name: 'Tank', hp: 360, speed: 0.019, reward: 15, color: '#b97985', radius: 15 },
    mini: { name: 'Mini jefe', hp: 700, speed: 0.024, reward: 30, color: '#c493ff', radius: 22 },
    boss: { name: 'THE TITAN', hp: 1200, speed: 0.014, reward: 75, color: '#ff655c', radius: 32 },
  },
  roguelike: [
    { id: 'gunner_damage', rarity: 'Común', title: 'Munición trazadora', text: '+22% daño de ametralladoras', color: '#35d6be' },
    { id: 'attack_speed', rarity: 'Rara', title: 'Ritmo frenético', text: '+15% velocidad de ataque', color: '#75a9ff' },
    { id: 'coins', rarity: 'Común', title: 'Ruta de suministros', text: '+30% monedas obtenidas', color: '#ffcf66' },
    { id: 'range', rarity: 'Rara', title: 'Ópticas calibradas', text: '+10% alcance de torres', color: '#c493ff' },
    { id: 'flame_damage', rarity: 'Épica', title: 'Combustible volátil', text: '+35% daño de fuego', color: '#ff756a' },
    { id: 'cannon_splash', rarity: 'Rara', title: 'Carga fragmentaria', text: '+25% radio de explosión', color: '#ffad5a' },
  ],
};

export function getLevelDifficulty(level) {
  const tuning = GAME_CONFIG.levels.difficulty;
  const step = Math.max(0, level - 1);
  const thresholds = level <= 3 ? tuning.miniBossThresholdsEarly : level <= 7 ? tuning.miniBossThresholdsMid : tuning.miniBossThresholdsLate;
  return {
    totalEnemies: Math.round(tuning.enemyCountBase + step * tuning.enemyCountPerLevel),
    enemyHpMultiplier: Math.pow(tuning.enemyHpScale, step),
    enemySpeedMultiplier: Math.pow(tuning.enemySpeedScale, step),
    spawnInterval: Math.max(tuning.spawnIntervalMin, tuning.spawnIntervalStart - step * tuning.spawnIntervalStep),
    initialDelay: tuning.initialDelay,
    runnerChance: level < tuning.runnerStartLevel ? 0 : Math.min(0.2, tuning.runnerChanceStart + (level - tuning.runnerStartLevel) * tuning.runnerChanceStep),
    tankChance: level < tuning.tankStartLevel ? 0 : Math.min(0.16, tuning.tankChanceStart + (level - tuning.tankStartLevel) * tuning.tankChanceStep),
    miniBossThresholds: [...thresholds],
    bossHp: tuning.bossHpBase + level * tuning.bossHpPerLevel,
    bossUnlockDelay: tuning.bossUnlockDelay + Math.min(1.5, step * 0.08),
  };
}

export const WORLDS = [
  { id: 1, name: 'Ciudad destruida', subtitle: 'Distrito cero', color: '#ff8f6b', levels: 10 },
  { id: 2, name: 'Bosque infectado', subtitle: 'Raíces negras', color: '#72d29b', levels: 10 },
  { id: 3, name: 'Zona industrial', subtitle: 'Hierro y humo', color: '#ffbf66', levels: 10 },
];
