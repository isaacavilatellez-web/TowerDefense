import { GAME_CONFIG, getInfiniteDifficulty } from './config.js';

const UINT_MAX = 0xffffffff;

function safeNumber(value, fallback = 0) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function seedFor(phase, attempt) {
  let seed = (0x9e3779b9 ^ (phase * 2654435761) ^ (attempt * 1597334677)) >>> 0;
  if (!seed) seed = 0x6d2b79f5;
  return seed;
}

/** Director continuo del modo infinito. No conoce la economía permanente ni
 * crea oleadas: sólo decide eventos de presión usando un estado aleatorio
 * pequeño y serializable. */
export class InfiniteDirector {
  constructor(game) { this.game = game; }

  beginPhase(run, phase, seed = run.infinite?.rngState) {
    const difficulty = getInfiniteDifficulty(phase);
    const rngState = (Number(seed) >>> 0) || seedFor(phase, run.infinite?.attempt || 0);
    run.infinite = {
      ...(run.infinite || {}),
      activePhase: phase,
      difficulty,
      targetDamage: difficulty.targetDamage,
      damage: 0,
      eventTimer: 1.8,
      eventGap: difficulty.eventGap,
      activeThreat: 0,
      spawned: 0,
      hordeMessage: null,
      rngState,
      phaseStarted: true,
      phaseTransition: false,
    };
    run.baseHp = run.baseMaxHp;
    run.enemies = [];
    run.projectiles = [];
  }

  tick(seconds) {
    const run = this.game.run;
    if (!run?.infinite || run.ended || run.infinite.phaseTransition) return;
    const state = run.infinite;
    state.eventTimer -= seconds;
    if (state.eventTimer > 0) return;
    const difficulty = state.difficulty || getInfiniteDifficulty(state.activePhase);
    const active = run.enemies.filter((enemy) => enemy.alive).length;
    if (active >= difficulty.maxEnemies || state.activeThreat >= difficulty.maxThreat) {
      state.eventTimer = 0.35;
      return;
    }

    const event = this.pickEvent(state.activePhase, run);
    const room = Math.max(0, difficulty.maxEnemies - active);
    const allowed = event.kinds.slice(0, room);
    const cost = allowed.reduce((sum, kind) => sum + this.threatOf(kind), 0);
    if (!allowed.length || state.activeThreat + cost > difficulty.maxThreat) {
      state.eventTimer = 0.45;
      return;
    }

    for (const kind of allowed) {
      const pathCount = run.map.paths?.length || 1;
      const pathIndex = Math.floor(this.random(run) * pathCount);
      this.game.enemies.spawn(kind, { pathIndex, infinite: true });
      state.spawned += 1;
    }
    state.activeThreat += cost;
    state.eventTimer = event.gap + difficulty.eventGap * (0.88 + this.random(run) * 0.24);
    if (event.horde) {
      state.hordeMessage = performance.now() + 1100;
      this.game.feedback('¡HORDA!', 'boss');
    }
  }

  pickEvent(phase, run) {
    const roll = this.random(run);
    const p = Math.max(1, phase);
    if (p >= 8 && roll < Math.min(0.11, 0.035 + (p - 8) * 0.006)) {
      return { kinds: ['mini', 'normal', 'normal'], gap: 2.4 };
    }
    if (p >= 5 && roll < 0.17) {
      return { kinds: ['tank', 'normal'], gap: 2.1 };
    }
    if (p >= 3 && roll < 0.34) {
      const count = 2 + Math.floor(this.random(run) * Math.min(3, 2 + Math.floor(p / 8)));
      return { kinds: Array.from({ length: count }, () => 'runner'), gap: 1.35 };
    }
    if (roll < 0.58) {
      const count = 3 + Math.floor(this.random(run) * Math.min(4, 3 + Math.floor(p / 6)));
      return { kinds: Array.from({ length: count }, () => 'normal'), gap: 1.75, horde: true };
    }
    if (p >= 4 && roll < 0.77) {
      return { kinds: ['normal', 'runner', ...(p >= 7 ? ['normal'] : [])], gap: 1.8 };
    }
    return { kinds: ['normal'], gap: 1.25 };
  }

  threatOf(kind) {
    return { normal: 1, runner: 1.15, tank: 2.8, mini: 6 }[kind] || 1;
  }

  random(run) {
    let x = (Number(run.infinite.rngState) >>> 0) || 0x6d2b79f5;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    run.infinite.rngState = x >>> 0;
    return run.infinite.rngState / UINT_MAX;
  }

  createAttemptState(phase, attempt) {
    const difficulty = getInfiniteDifficulty(phase);
    return {
      activePhase: phase,
      difficulty,
      targetDamage: difficulty.targetDamage,
      damage: 0,
      eventTimer: 1.8,
      eventGap: difficulty.eventGap,
      activeThreat: 0,
      spawned: 0,
      hordeMessage: null,
      rngState: seedFor(phase, attempt),
      attempt,
      phaseStarted: true,
      phaseTransition: false,
    };
  }

  budgetFor(phase) {
    return getInfiniteDifficulty(phase).rebuildBudget;
  }

  firstReward(phase) {
    const rewards = GAME_CONFIG.infinite.rewards;
    return {
      scrap: Math.max(0, Math.round(rewards.firstPhaseScrapBase + (phase - 1) * rewards.firstPhaseScrapStep)),
      technology: phase % rewards.firstPhaseTechnologyEvery === 0 ? 1 : 0,
      crystals: 0,
    };
  }

  milestoneReward(phase) {
    return GAME_CONFIG.infinite.rewards.milestone[phase] || null;
  }

  finiteRunSnapshot(run) {
    if (!run?.infinite) return null;
    return {
      level: run.level,
      map: run.map,
      baseHp: safeNumber(run.baseHp, run.baseMaxHp),
      baseMaxHp: safeNumber(run.baseMaxHp, 100),
      coins: Math.max(0, safeNumber(run.coins)),
      clickerLevel: Math.max(1, Math.floor(safeNumber(run.clickerLevel, 1))),
      clicks: Math.max(0, Math.floor(safeNumber(run.clicks))),
      towers: run.towers || [],
      enemies: run.enemies || [],
      projectiles: run.projectiles || [],
      nextEnemyId: run.nextEnemyId || 1,
      kills: run.kills || 0,
      leaks: run.leaks || 0,
      selectedTowerId: run.selectedTowerId || null,
      upgradeOptions: run.upgradeOptions || [],
      pausedForUpgrade: Boolean(run.pausedForUpgrade),
      infinite: run.infinite,
      buffs: run.buffs || {},
    };
  }
}
