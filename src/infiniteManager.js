import { getInfinitePhaseConfig } from './config.js';

const EVENT_TABLE = [
  { id: 'normal', weight: 42, threat: 1, dangerous: false, group: ['normal'] },
  { id: 'horde', weight: 20, threat: 4, dangerous: false, group: ['normal', 'normal', 'normal', 'normal'] },
  { id: 'runners', weight: 13, threat: 3, dangerous: false, group: ['runner', 'runner', 'runner'] },
  { id: 'mixed', weight: 13, threat: 5, dangerous: true, group: ['normal', 'runner', 'normal', 'tank'] },
  { id: 'escort', weight: 9, threat: 6, dangerous: true, group: ['tank', 'normal', 'normal'] },
  { id: 'mini', weight: 3, threat: 8, dangerous: true, minimumPhase: 3, group: ['mini', 'normal', 'runner'] },
];

const threatFor = (kind) => ({ normal: 1, runner: 1.2, tank: 3.8, mini: 8, boss: 12 }[kind] || 1);
const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

export class InfiniteManager {
  constructor(game) { this.game = game; }

  createState(phase, seed = this.seedFor(phase)) {
    const config = getInfinitePhaseConfig(phase);
    return {
      phase: config.phase,
      config,
      elapsed: 0,
      spawnTimer: 1.5,
      eventCooldown: 0,
      seed: seed >>> 0,
      randomState: seed >>> 0,
      eventNumber: 0,
      dangerousEvents: 0,
      activeThreat: 0,
    };
  }

  seedFor(phase) {
    const stored = this.game.save.infinite?.seed;
    if (Number.isFinite(stored)) return (stored + Math.max(0, phase - 1) * 2654435761) >>> 0;
    return (0x9e3779b9 ^ (phase * 1103515245)) >>> 0;
  }

  random(state) {
    state.randomState = (Math.imul(state.randomState || 1, 1664525) + 1013904223) >>> 0;
    return state.randomState / 4294967296;
  }

  pickEvent(state) {
    const phase = state.phase;
    const available = EVENT_TABLE.filter((event) => !event.minimumPhase || phase >= event.minimumPhase);
    const totalWeight = available.reduce((sum, event) => sum + event.weight, 0);
    let cursor = this.random(state) * totalWeight;
    for (const event of available) {
      cursor -= event.weight;
      if (cursor <= 0) return event;
    }
    return available[0];
  }

  activeEnemies(run) {
    return run.enemies.filter((enemy) => enemy.alive);
  }

  tick(seconds) {
    const run = this.game.run;
    const state = run?.infiniteDirector;
    if (!run || run.ended || run.mode !== 'infinite' || !state || run.damageDone >= run.damageTarget) return;
    state.elapsed += seconds;
    state.spawnTimer -= seconds;
    state.eventCooldown = Math.max(0, state.eventCooldown - seconds);
    const active = this.activeEnemies(run);
    state.activeThreat = active.reduce((sum, enemy) => sum + threatFor(enemy.kind), 0);
    if (state.spawnTimer > 0 || active.length >= state.config.maxActive || state.activeThreat >= state.config.maxThreat) return;

    const event = this.pickEvent(state);
    const eventThreat = event.group.reduce((sum, kind) => sum + threatFor(kind), 0);
    const dangerousAllowed = !event.dangerous || state.eventCooldown <= 0;
    if (!dangerousAllowed || active.length + event.group.length > state.config.maxActive || state.activeThreat + eventThreat > state.config.maxThreat) {
      state.spawnTimer = Math.min(1.2, state.spawnTimer + .35);
      return;
    }
    const pathCount = run.map.paths?.length || 1;
    event.group.forEach((kind, index) => this.game.enemies.spawn(kind, { pathIndex: (state.eventNumber + index) % pathCount, infinite: true }));
    run.spawned += event.group.length;
    state.eventNumber += 1;
    if (event.dangerous) {
      state.dangerousEvents += 1;
      state.eventCooldown = state.config.dangerousEventCooldown;
    }
    const variance = .85 + this.random(state) * .3;
    state.spawnTimer = state.config.spawnInterval * variance;
  }

  serialize(state) {
    if (!state) return null;
    return {
      ...state,
      config: { ...getInfinitePhaseConfig(state.phase) },
      elapsed: finite(state.elapsed),
      spawnTimer: finite(state.spawnTimer),
      eventCooldown: finite(state.eventCooldown),
      seed: finite(state.seed) >>> 0,
      randomState: finite(state.randomState, 1) >>> 0,
      eventNumber: Math.max(0, Math.floor(finite(state.eventNumber))),
      dangerousEvents: Math.max(0, Math.floor(finite(state.dangerousEvents))),
      activeThreat: finite(state.activeThreat),
    };
  }

  restore(state, phase) {
    const fresh = this.createState(phase, finite(state?.seed, this.seedFor(phase)) >>> 0);
    return { ...fresh, ...state, phase: fresh.phase, config: fresh.config, randomState: finite(state?.randomState, fresh.randomState) >>> 0 };
  }
}
