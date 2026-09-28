export const GAME_CONFIG = {
  map: { width: 540, height: 640, baseRadius: 30 },
  placement: {
    pathClearance: 49,
    towerSeparation: 48,
    edgeMargin: 28,
  },
  economy: {
    startingCoins: 120,
    clickValues: [1, 2, 3, 4, 5, 6, 7],
    clickerUpgradeCosts: [110, 275, 500, 800, 1150, 1550],
    rewardLevelStep: 0.015,
    rewardLevelBonusCap: 0.35,
    bossReward: 75,
    bossCurrency: { mini: 1, boss: 8 },
  },
  levels: {
    startingBaseHp: 100,
    // Curva suave y editable: los primeros tres niveles son de aprendizaje.
    difficulty: {
      enemyCountBase: 12,
      enemyCountPerLevel: 2.6,
      enemyHpScale: 1.052,
      enemySpeedScale: 1.018,
      spawnIntervalStart: 3.25,
      spawnIntervalMin: 0.72,
      spawnIntervalStep: 0.09,
      initialDelay: 5.5,
      runnerStartLevel: 4,
      runnerChanceStart: 0.04,
      runnerChanceStep: 0.018,
      tankStartLevel: 5,
      tankChanceStart: 0.025,
      tankChanceStep: 0.012,
      miniBossThresholdsEarly: [10, 20, 30, 40, 50, 60, 70, 80, 90],
      miniBossThresholdsMid: [10, 20, 30, 40, 50, 60, 70, 80, 90],
      miniBossThresholdsLate: [10, 20, 30, 40, 50, 60, 70, 80, 90],
      bossHpBase: 900,
      bossHpPerLevel: 280,
      bossUnlockDelay: 2.8,
    },
  },
  waves: {
    miniBossPercentages: [10, 20, 30, 40, 50, 60, 70, 80, 90],
    ambientSpawn: {
      intervalStart: 7.2,
      intervalMin: 3.8,
      intervalStep: 0.12,
      bossMultiplier: 1.45,
      maxPerPhaseStart: 2,
      maxPerPhaseStep: 1,
    },
  },
  towers: {
    gunner: { id: 'gunner', name: 'Ametralladora', shortName: 'AMT', icon: '▦', rarity: 'Común', rarityColor: '#aeb7b4', color: '#aeb7b4', cost: 100, damage: 15, cooldown: 0.46, range: 130, type: 'Bala', splash: 0, description: 'Cadencia rápida y fiable.' },
    cannon: { id: 'cannon', name: 'Cañón', shortName: 'CAÑ', icon: '◉', rarity: 'Rara', rarityColor: '#66b8e8', color: '#66b8e8', cost: 150, damage: 62, cooldown: 1.35, range: 175, type: 'Explosivo', splash: 56, description: 'Golpea grupos con explosiones.' },
    flame: { id: 'flame', name: 'Lanzallamas', shortName: 'FLM', icon: '✦', rarity: 'Épica', rarityColor: '#c36be2', color: '#c36be2', cost: 210, damage: 14, cooldown: 0.22, range: 96, type: 'Fuego', splash: 38, description: 'Daño continuo en corto alcance.' },
    sniper: { id: 'sniper', name: 'Congeladora', shortName: 'HIE', icon: '❄', rarity: 'Legendaria', rarityColor: '#f5cc58', color: '#f5cc58', cost: 280, damage: 150, cooldown: 2.05, range: 270, type: 'Hielo', splash: 0, slowFactor: 0.48, slowDuration: 1.6, description: 'Daño alto y ralentización visible.' },
    mortar: { id: 'mortar', name: 'Misil', shortName: 'MIS', icon: '▲', rarity: 'Mítica', rarityColor: '#e86e63', color: '#e86e63', cost: 240, damage: 78, cooldown: 1.65, range: 205, type: 'Misil', splash: 72, description: 'Impactos de área con gran alcance.' },
    tesla: { id: 'tesla', name: 'Torre Tesla', shortName: 'TES', icon: 'ϟ', rarity: 'Rara', rarityColor: '#66b8e8', color: '#66b8e8', cost: 200, damage: 30, cooldown: 0.7, range: 158, type: 'Cadena', splash: 0, chain: 2, chainRange: 105, chainDamage: 0.65, description: 'Descargas que saltan a 2 enemigos cercanos.' },
  },
  enemies: {
    normal: { name: 'Caminante', hp: 95, speed: 0.026, reward: 10, color: '#899c8a', radius: 10 },
    runner: { name: 'Runner', hp: 58, speed: 0.052, reward: 14, color: '#d4b768', radius: 8 },
    tank: { name: 'Tank', hp: 360, speed: 0.015, reward: 30, color: '#a76f70', radius: 15 },
    mini: { name: 'Mini jefe', hp: 700, speed: 0.024, reward: 100, color: '#c493ff', radius: 22, regen: 0 },
    boss: { name: 'THE TITAN', hp: 1200, speed: 0.014, reward: 75, color: '#ff655c', radius: 32, regen: 0 },
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
