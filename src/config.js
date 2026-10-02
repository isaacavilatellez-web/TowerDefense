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
    // Economía permanente. Los PV sólo existen para convertir cofres y
    // costes de nivel en engranajes; nunca se presentan en la interfaz.
    permanent: {
      gearValues: { common: 1, rare: 5, epic: 20, legendary: 100 },
      gearLabels: { common: 'Gris', rare: 'Azul', epic: 'Morado', legendary: 'Dorado' },
      gearColors: { common: '#aeb7b4', rare: '#66b8e8', epic: '#b879e3', legendary: '#f5cc58' },
      levelCostsPv: [50, 150, 400, 1000, 2500, 6000, 15000, 30000, 60000],
      totalLevelCostsPv: 115100,
      maxTowerLevel: 10,
      chests: [
        { id: 'wood', name: 'Cofre de madera', price: 500, valueRange: [50, 100], color: '#b98a54', weights: { common: 65, rare: 28, epic: 6, legendary: 1 } },
        { id: 'reinforced', name: 'Cofre reforzado', price: 1500, valueRange: [150, 300], color: '#9ea9ad', weights: { common: 40, rare: 40, epic: 17, legendary: 3 } },
        { id: 'military', name: 'Cofre militar', price: 4000, valueRange: [400, 800], color: '#6b9c75', weights: { common: 15, rare: 40, epic: 35, legendary: 10 } },
        { id: 'armored', name: 'Cofre blindado', price: 10000, valueRange: [800, 1500], color: '#7c91a8', weights: { common: 5, rare: 25, epic: 50, legendary: 20 } },
        { id: 'commander', name: 'Cofre comandante', price: 25000, valueRange: [1500, 3000], color: '#d0a94e', weights: { common: 2, rare: 13, epic: 50, legendary: 35 } },
      ],
      directGearCrystalPrices: { common: 5, rare: 20, epic: 75, legendary: 300 },
      levelRewards: [
        { first: 150, repeat: 50 }, { first: 180, repeat: 60 }, { first: 210, repeat: 70 },
        { first: 240, repeat: 80 }, { first: 300, repeat: 100 }, { first: 340, repeat: 110 },
        { first: 380, repeat: 120 }, { first: 420, repeat: 130 }, { first: 460, repeat: 140 },
        { first: 600, repeat: 180 },
      ],
      infiniteRewards: {
        base: { start: 20, step: 5 },
        milestones: { 5: 100, 10: 200, 20: 400 },
      },
    },
    // Compatibilidad de partidas antiguas: los nombres nuevos son los únicos
    // usados por la interfaz y la lógica nueva.
    bossReward: 0,
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
      runnerStartLevel: 2,
      runnerChanceStart: 0.12,
      runnerChanceStep: 0.02,
      tankStartLevel: 3,
      tankChanceStart: 0.08,
      tankChanceStep: 0.014,
      armoredStartLevel: 5,
      armoredChanceStart: 0.06,
      armoredChanceStep: 0.012,
      regeneratorStartLevel: 6,
      regeneratorChanceStart: 0.05,
      regeneratorChanceStep: 0.01,
      miniBossThresholdsEarly: [10, 20, 30, 40, 50, 60, 70, 80, 90],
      miniBossThresholdsMid: [10, 20, 30, 40, 50, 60, 70, 80, 90],
      miniBossThresholdsLate: [10, 20, 30, 40, 50, 60, 70, 80, 90],
      bossHpBase: 3000,
      bossHpPerLevel: 0,
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
  infinite: {
    startingPhase: 1,
    startingCoins: 120,
    reconstructionCoinsPerPhase: 8,
    reconstructionCoinsCap: 160,
    baseHp: 100,
    targetDamageBase: 2400,
    targetDamageGrowth: 1.15,
    targetDamageRounding: 10,
    hpGrowth: 1.075,
    speedGrowth: 1.012,
    spawnIntervalStart: 2.9,
    spawnIntervalMin: 0.62,
    spawnIntervalStep: 0.045,
    maxActiveBase: 8,
    maxActivePerPhase: 0.55,
    maxActiveCap: 24,
    maxThreatBase: 10,
    maxThreatPerPhase: 1.15,
    maxThreatCap: 42,
    dangerousEventCooldown: 4.5,
  },
  towers: {
    gunner: { id: 'gunner', name: 'Ametralladora', shortName: 'AMT', icon: '▦', rarity: 'Común', rarityId: 'common', rarityColor: '#aeb7b4', color: '#aeb7b4', cost: 100, damage: 5, cooldown: .2, rangeRelative: 1, type: 'Bala', description: 'Fuego individual rápido.' },
    cannon: { id: 'cannon', name: 'Cañón', shortName: 'CAÑ', icon: '◉', rarity: 'Común', rarityId: 'common', rarityColor: '#aeb7b4', color: '#aeb7b4', cost: 150, damage: 30, cooldown: 1.2, rangeRelative: 1.1, type: 'Explosivo', description: 'Impactos explosivos.' },
    flame: { id: 'flame', name: 'Lanzallamas', shortName: 'FLM', icon: '✦', rarity: 'Rara', rarityId: 'rare', rarityColor: '#66b8e8', color: '#66b8e8', cost: 210, damage: 4, cooldown: .2, rangeRelative: .7, type: 'Fuego', description: 'Cono corto y quemaduras.' },
    mortar: { id: 'mortar', name: 'Misiles', shortName: 'MIS', icon: '▲', rarity: 'Rara', rarityId: 'rare', rarityColor: '#66b8e8', color: '#66b8e8', cost: 240, damage: 45, cooldown: 2, rangeRelative: 1.4, type: 'Misil', description: 'Misiles guiados con explosión pequeña.' },
    tesla: { id: 'tesla', name: 'Tesla', shortName: 'TES', icon: 'ϟ', rarity: 'Épica', rarityId: 'epic', rarityColor: '#b879e3', color: '#b879e3', cost: 200, damage: 20, cooldown: 1, rangeRelative: 1, type: 'Cadena', chainRange: 90, description: 'Cadena eléctrica sin repetir objetivo.' },
    sniper: { id: 'sniper', name: 'Congeladora', shortName: 'HIE', icon: '❄', rarity: 'Legendaria', rarityId: 'legendary', rarityColor: '#f5cc58', color: '#f5cc58', cost: 280, damage: 5, cooldown: 1.5, rangeRelative: 1.8, type: 'Hielo', description: 'Control de movimiento y congelación.' },
  },
  enemies: {
    normal: { id: 'normal', name: 'Básico', hp: 100, speed: .026, speedRelative: 1, shelterDamage: 5, reward: 10, color: '#899c8a', radius: 10, indicator: '●' },
    runner: { id: 'runner', name: 'Corredor', hp: 60, speed: .0416, speedRelative: 1.6, shelterDamage: 5, reward: 14, color: '#d4b768', radius: 8, indicator: '»' },
    tank: { id: 'tank', name: 'Tanque', hp: 350, speed: .0169, speedRelative: .65, shelterDamage: 15, reward: 30, color: '#a76f70', radius: 15, indicator: '▣' },
    armored: { id: 'armored', name: 'Blindado', hp: 180, speed: .0221, speedRelative: .85, shelterDamage: 10, reward: 24, color: '#778999', radius: 12, armorReduction: .25, indicator: '◆' },
    regenerator: { id: 'regenerator', name: 'Regenerador', hp: 150, speed: .026, speedRelative: 1, shelterDamage: 10, reward: 26, color: '#67b47b', radius: 11, regen: .0333, indicator: '+' },
    mini: { id: 'mini', name: 'Minijefe', hp: 1000, speed: .0195, speedRelative: .75, shelterDamage: 25, reward: 100, color: '#c493ff', radius: 22, controlResistance: .5, indicator: '✦' },
    boss: { id: 'boss', name: 'Jefe final', hp: 3000, speed: .0156, speedRelative: .6, shelterDamage: Infinity, reward: 75, color: '#ff655c', radius: 32, controlResistance: .5, indicator: '☠' },
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

Object.defineProperties(GAME_CONFIG.enemies, {
  basic: { value: GAME_CONFIG.enemies.normal, enumerable: false },
  miniBoss: { value: GAME_CONFIG.enemies.mini, enumerable: false },
  finalBoss: { value: GAME_CONFIG.enemies.boss, enumerable: false },
});

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
    tankChance: level < tuning.tankStartLevel ? 0 : Math.min(0.22, tuning.tankChanceStart + (level - tuning.tankStartLevel) * tuning.tankChanceStep),
    armoredChance: level < tuning.armoredStartLevel ? 0 : Math.min(0.18, tuning.armoredChanceStart + (level - tuning.armoredStartLevel) * tuning.armoredChanceStep),
    regeneratorChance: level < tuning.regeneratorStartLevel ? 0 : Math.min(0.14, tuning.regeneratorChanceStart + (level - tuning.regeneratorStartLevel) * tuning.regeneratorChanceStep),
    miniBossThresholds: [...thresholds],
    bossHp: (tuning.bossHpBase + level * tuning.bossHpPerLevel) * Math.pow(tuning.enemyHpScale, step),
    bossUnlockDelay: tuning.bossUnlockDelay + Math.min(1.5, step * 0.08),
  };
}

const finitePositive = (value, fallback) => Number.isFinite(value) && value > 0 ? value : fallback;
const clampFinite = (value, min, max) => Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));

export function calcularObjetivoDanio(fase) {
  const safePhase = Math.max(1, Math.floor(Number(fase) || 1));
  const infinite = GAME_CONFIG.infinite;
  const base = finitePositive(infinite.targetDamageBase, 2400);
  const growth = finitePositive(infinite.targetDamageGrowth, 1.15);
  const rounding = finitePositive(infinite.targetDamageRounding, 10);
  return Math.round((base * Math.pow(growth, safePhase - 1)) / rounding) * rounding;
}

export function getInfinitePhaseConfig(phase) {
  const safePhase = Math.max(1, Math.floor(Number(phase) || 1));
  const step = safePhase - 1;
  const infinite = GAME_CONFIG.infinite;
  const target = Math.max(1, Math.min(Number.MAX_SAFE_INTEGER / 4, calcularObjetivoDanio(safePhase)));
  const hpMultiplier = Math.min(1e6, Math.pow(finitePositive(infinite.hpGrowth, 1.075), Math.min(step, 180)));
  const speedMultiplier = Math.min(3.5, Math.pow(finitePositive(infinite.speedGrowth, 1.012), Math.min(step, 180)));
  const spawnInterval = clampFinite(finitePositive(infinite.spawnIntervalStart, 2.9) - step * finitePositive(infinite.spawnIntervalStep, .045), finitePositive(infinite.spawnIntervalMin, .62), 20);
  return {
    phase: safePhase,
    targetDamage: target,
    enemyHpMultiplier: hpMultiplier,
    enemySpeedMultiplier: speedMultiplier,
    spawnInterval,
    maxActive: Math.round(clampFinite(finitePositive(infinite.maxActiveBase, 8) + step * finitePositive(infinite.maxActivePerPhase, .55), 4, finitePositive(infinite.maxActiveCap, 24))),
    maxThreat: clampFinite(finitePositive(infinite.maxThreatBase, 10) + step * finitePositive(infinite.maxThreatPerPhase, 1.15), 6, finitePositive(infinite.maxThreatCap, 42)),
    reconstructionCoins: Math.round(finitePositive(infinite.startingCoins, 120) + Math.min(finitePositive(infinite.reconstructionCoinsCap, 160), step * finitePositive(infinite.reconstructionCoinsPerPhase, 8))),
    dangerousEventCooldown: Math.max(2.2, finitePositive(infinite.dangerousEventCooldown, 4.5) - Math.min(1.4, step * .025)),
  };
}

export const WORLDS = [
  { id: 1, name: 'Ciudad destruida', subtitle: 'Distrito cero', color: '#ff8f6b', levels: 10 },
  { id: 2, name: 'Bosque infectado', subtitle: 'Raíces negras', color: '#72d29b', levels: 10 },
  { id: 3, name: 'Zona industrial', subtitle: 'Hierro y humo', color: '#ffbf66', levels: 10 },
];
