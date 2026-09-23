import { GAME_CONFIG, WORLDS } from './config.js';
import { getTowerStats, towerCost } from './towerData.js';
import { enemyPosition } from './enemyData.js';

export class UIManager {
  constructor() {
    this.app = document.querySelector('#app');
    this.game = null;
    this.selectedLevel = 1;
    this.screen = 'map';
    this.canvas = null;
    this.ctx = null;
    this.resizeHandler = null;
    this.renderFrameLogged = false;
  }

  mount(game) { this.game = game; this.showMap(); }

  showMap() {
    this.removeBattleResizeHandler();
    this.screen = 'map';
    this.app.innerHTML = `
      <main class="app-shell map-screen">
        <header class="topbar map-topbar">
          <div><span class="eyebrow">SECTOR 07 · SURVIVOR NETWORK</span><h1>Dead Sector <em>Defense</em></h1></div>
          <div class="resource-stack"><div class="resource"><span class="resource-icon scrap-icon">◆</span><strong>${this.game.save.scrap}</strong><small>CHAPA</small></div><div class="resource"><span class="resource-icon tech-icon">✦</span><strong>${this.game.save.technology}</strong><small>TECH</small></div></div>
        </header>
        <section class="map-heading"><div><span class="eyebrow">RUTA DE SUPERVIVENCIA</span><h2>Elige tu próximo frente</h2></div><div class="map-stat"><span class="pulse-dot"></span><span>SEÑAL ACTIVA</span></div></section>
        <section class="world-track" id="world-track"></section>
        ${this.bottomNav('map')}
      </main>`;
    this.renderMapNodes();
    this.bindNav();
  }

  renderMapNodes() {
    const track = this.app.querySelector('#world-track');
    let html = '';
    for (const world of WORLDS) {
      html += `<section class="world-card" style="--world-color:${world.color}"><div class="world-label"><span class="world-number">0${world.id}</span><div><span class="eyebrow">MUNDO ${world.id}</span><h3>${world.name}</h3><p>${world.subtitle}</p></div><span class="world-progress">${this.worldProgress(world)}%</span></div><div class="level-path">`;
      for (let i = 1; i <= world.levels; i += 1) {
        const level = (world.id - 1) * 10 + i;
        const unlocked = this.game.levels.isUnlocked(level);
        const completed = this.game.save.completedLevels.includes(level);
        const stars = this.game.save.stars[level] || 0;
        const current = unlocked && !completed && level === this.game.save.currentLevel;
        html += `<button class="level-node ${unlocked ? 'unlocked' : 'locked'} ${completed ? 'completed' : ''} ${current ? 'current' : ''} ${level % 5 === 0 ? 'boss-node' : ''}" data-level="${level}" ${unlocked ? '' : 'disabled'}><span class="node-orbit"></span><span class="node-number">${level}</span><span class="node-name">${level % 5 === 0 ? 'BOSS' : current ? 'JUGAR' : completed ? 'OK' : 'LOCK'}</span><span class="stars">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</span></button>`;
      }
      html += '</div></section>';
    }
    track.innerHTML = html;
    track.querySelectorAll('.level-node.unlocked').forEach((button) => button.addEventListener('click', () => this.openLevelDetails(Number(button.dataset.level))));
  }

  worldProgress(world) {
    const done = Array.from({ length: world.levels }, (_, index) => (world.id - 1) * 10 + index + 1).filter((level) => this.game.save.completedLevels.includes(level)).length;
    return Math.round(done / world.levels * 100);
  }

  openLevelDetails(level) {
    this.selectedLevel = level;
    const meta = this.game.levels.getLevel(level);
    const overlay = document.createElement('div');
    overlay.className = 'modal-backdrop';
    overlay.innerHTML = `<div class="level-modal"><button class="modal-close">×</button><span class="eyebrow">MUNDO ${meta.world.id} · ${meta.world.name.toUpperCase()}</span><h2>NIVEL ${String(level).padStart(2, '0')}</h2><p class="modal-title">${meta.name}</p><div class="mission-grid"><div><span>BIOMA</span><strong>${meta.world.subtitle}</strong></div><div><span>HORDA</span><strong>~${meta.zombies} zombis</strong></div><div><span>DIFICULTAD</span><strong>${'◆'.repeat(meta.difficulty)}${'◇'.repeat(5 - meta.difficulty)}</strong></div><div><span>JEFE</span><strong>${meta.boss}</strong></div></div><div class="reward-row"><span>RECOMPENSA DESECHOS</span><strong>+${meta.reward} ◆</strong></div><button class="primary-button play-level">JUGAR NIVEL <span>→</span></button></div>`;
    document.body.append(overlay);
    overlay.querySelector('.modal-close').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (event) => { if (event.target === overlay) overlay.remove(); });
    overlay.querySelector('.play-level').addEventListener('click', () => { overlay.remove(); this.game.startLevel(level); });
  }

  showBattle() {
    this.screen = 'battle';
    this.renderFrameLogged = false;
    const run = this.game.run;
    console.log('showBattle', { level: run?.level, mapReady: Boolean(run?.map) });
    this.app.innerHTML = `<main class="app-shell battle-screen"><header class="battle-header"><button class="icon-button back-map">‹</button><div class="battle-title"><span class="eyebrow">MUNDO ${run.meta.world.id} · ${run.meta.world.name}</span><h1>SECTOR ${String(run.level).padStart(2, '0')} <span class="live-badge"><i></i>EN VIVO</span></h1></div><div class="battle-resources"><span>◆ <b class="coins-value">${run.coins}</b></span><span class="base-chip">▣ <b class="base-value">${run.baseHp}%</b></span></div></header><section class="battle-layout"><div class="game-field"><canvas id="battle-canvas" width="960" height="620"></canvas><div class="field-hint" id="field-hint">Mantén y arrastra hasta una zona verde</div><div class="boss-warning" id="boss-warning"><span>JEFE ENTRANTE</span><strong>THE TITAN</strong></div></div><aside class="battle-side"><div class="wave-card"><div class="wave-top"><span>PROGRESO DE HORDA</span><strong><b class="kills-value">0</b> / <span class="total-value">${run.totalEnemies}</span></strong></div><div class="progress-track"><i class="wave-progress"></i></div><div class="wave-meta"><span><i class="pulse-dot"></i> PRÓXIMO MINI JEFE</span><strong class="next-boss">${run.difficulty.miniBossThresholds[0]}%</strong></div></div><div class="clicker-card"><div><span class="eyebrow">GENERADOR MANUAL</span><h3>Reactor de monedas</h3><p><span class="auto-value">+0</span> / s · combo <span class="combo-value">x0</span></p></div><button class="clicker-button" id="clicker-button"><span>◆</span><strong>+<b class="click-value">1</b></strong><small>CLICK</small></button></div><button class="upgrade-clicker" id="upgrade-clicker"><span>MEJORAR REACTOR · NIVEL <b class="clicker-level">1</b></span><strong>◆ <b class="clicker-cost">65</b></strong></button><div class="tower-shop"><div class="section-label"><span>DEFENSAS</span><small>ARRASTRA AL MAPA</small></div><div class="tower-cards">${Object.values(GAME_CONFIG.towers).map((tower) => `<button class="tower-card" data-tower="${tower.id}" title="Arrastra para colocar"><span class="tower-icon" style="--tower-color:${tower.color}">${tower.icon}</span><span><strong>${tower.shortName}</strong><small>${tower.name}</small></span><em>◆ ${tower.cost}</em></button>`).join('')}</div></div><div class="tower-panel" id="tower-panel"></div></aside></section><div class="feedback" id="feedback"></div><div class="upgrade-overlay" id="upgrade-overlay"></div><div class="result-overlay" id="result-overlay"></div></main>`;
    this.canvas = this.app.querySelector('#battle-canvas');
    this.ctx = this.canvas?.getContext('2d') || null;
    if (!this.canvas || !this.ctx) {
      console.error('canvas creation failed', { canvas: Boolean(this.canvas), context: Boolean(this.ctx) });
      this.showBattleError('No se pudo cargar el campo', 'Tu navegador no ha podido inicializar el Canvas.');
      return false;
    }
    console.log('canvas created', { width: this.canvas.width, height: this.canvas.height });
    this.configureCanvas();
    this.bindBattle();
    if (!this.verifyBattleMount()) {
      this.showBattleError('El campo tiene un tamaño inválido', 'El canvas de batalla no ha recibido un área visible.');
      return false;
    }
    console.log('HUD mounted', { hud: Boolean(this.app.querySelector('.battle-side')), gameField: Boolean(this.app.querySelector('.game-field')) });
    return true;
  }

  configureCanvas() {
    if (!this.canvas || !this.ctx) return;
    const { width, height } = GAME_CONFIG.map;
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth || width;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || height;
    const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 3));
    const rect = this.canvas.getBoundingClientRect();
    const cssWidth = rect.width || Math.min(width, Math.max(320, viewportWidth - 32));
    const cssHeight = cssWidth * height / width;
    this.canvas.width = Math.max(1, Math.round(width * dpr));
    this.canvas.height = Math.max(1, Math.round(height * dpr));
    this.canvas.style.width = '100%';
    this.canvas.style.height = 'auto';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.canvasMetrics = { cssWidth, cssHeight, dpr, viewportWidth, viewportHeight };
    console.log('canvas configured', { width: this.canvas.width, height: this.canvas.height, cssWidth, cssHeight, dpr, viewportWidth, viewportHeight });
  }

  verifyBattleMount() {
    const shell = this.app.querySelector('.battle-screen');
    const field = this.app.querySelector('.game-field');
    const canvasRect = this.canvas.getBoundingClientRect();
    const shellStyle = getComputedStyle(shell);
    const overlays = [...this.app.querySelectorAll('.upgrade-overlay, .result-overlay')].map((node) => ({
      id: node.id,
      display: getComputedStyle(node).display,
      visibility: getComputedStyle(node).visibility,
      opacity: getComputedStyle(node).opacity,
      zIndex: getComputedStyle(node).zIndex,
    }));
    console.log('battle visibility check', {
      shell: { display: shellStyle.display, visibility: shellStyle.visibility, opacity: shellStyle.opacity, zIndex: shellStyle.zIndex },
      field: { width: field.getBoundingClientRect().width, height: field.getBoundingClientRect().height },
      canvas: { width: canvasRect.width, height: canvasRect.height, backingWidth: this.canvas.width, backingHeight: this.canvas.height },
      overlays,
    });
    if (!canvasRect.width || !canvasRect.height) {
      console.error('canvas size invalid', { width: canvasRect.width, height: canvasRect.height });
      return false;
    }
    return true;
  }

  removeBattleResizeHandler() {
    if (this.resizeHandler) window.removeEventListener('resize', this.resizeHandler);
    document.removeEventListener('pointermove', this.onPointerMove);
    document.removeEventListener('pointerup', this.onPointerUp);
    document.removeEventListener('pointercancel', this.onPointerUp);
    this.resizeHandler = null;
  }

  showBattleError(title, message) {
    this.removeBattleResizeHandler();
    this.screen = 'battle-error';
    this.canvas = null;
    this.ctx = null;
    this.app.innerHTML = `<main class="app-shell battle-screen"><section class="result-card defeat" role="alert"><span class="eyebrow">ERROR DE INICIALIZACIÓN</span><h2>${title}</h2><p>${message}</p><button class="primary-button battle-error-back">VOLVER AL MAPA <span>→</span></button></section></main>`;
    this.app.querySelector('.battle-error-back').addEventListener('click', () => this.game.returnToMap());
  }

  bindBattle() {
    this.removeBattleResizeHandler();
    this.resizeHandler = () => this.configureCanvas();
    window.addEventListener('resize', this.resizeHandler);
    this.app.querySelector('.back-map').addEventListener('click', () => this.game.returnToMap());
    this.app.querySelector('#clicker-button').addEventListener('click', () => this.game.clicker.press());
    this.app.querySelector('#upgrade-clicker').addEventListener('click', () => this.game.clicker.upgrade());
    this.app.querySelectorAll('.tower-card').forEach((button) => button.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      if (!this.game.towers.buy(button.dataset.tower)) this.game.feedback('No hay suficientes monedas', 'info');
    }));
    this.canvas.addEventListener('pointerdown', (event) => this.onCanvasPointerDown(event));
    document.addEventListener('pointermove', this.onPointerMove);
    document.addEventListener('pointerup', this.onPointerUp);
    document.addEventListener('pointercancel', this.onPointerUp);
  }

  canvasPoint(event) {
    const rect = this.canvas.getBoundingClientRect();
    return { x: (event.clientX - rect.left) * GAME_CONFIG.map.width / rect.width, y: (event.clientY - rect.top) * GAME_CONFIG.map.height / rect.height };
  }

  pointInsideCanvas(event) {
    const rect = this.canvas.getBoundingClientRect();
    return event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
  }

  onCanvasPointerDown(event) {
    if (!this.game.run || this.game.run.pausedForUpgrade) return;
    event.preventDefault();
    const run = this.game.run;
    const point = this.canvasPoint(event);
    if (run.placingType) {
      run.drag = { mode: 'place', type: run.placingType, pointerId: event.pointerId, moved: false, point };
      run.placementPreview = point;
      return;
    }
    const tower = run.towers.find((item) => Math.hypot(item.x - point.x, item.y - point.y) < 30);
    if (!tower) { this.game.towers.select(null); run.mergeTargetId = null; return; }
    run.drag = { mode: 'merge', towerId: tower.id, pointerId: event.pointerId, start: point, point, moved: false };
    this.game.towers.select(tower);
  }

  onPointerMove = (event) => {
    const run = this.game?.run;
    if (!run?.drag || run.pausedForUpgrade) return;
    const drag = run.drag;
    if (drag.mode === 'place') {
      if (!this.pointInsideCanvas(event)) return;
      drag.point = this.canvasPoint(event);
      drag.moved = true;
      run.placementPreview = drag.point;
      return;
    }
    if (!this.pointInsideCanvas(event)) return;
    drag.point = this.canvasPoint(event);
    if (!drag.moved && Math.hypot(drag.point.x - drag.start.x, drag.point.y - drag.start.y) > 10) drag.moved = true;
    if (!drag.moved) return;
    const candidate = run.towers.find((tower) => tower.id !== drag.towerId && Math.hypot(tower.x - drag.point.x, tower.y - drag.point.y) < 30);
    const source = run.towers.find((tower) => tower.id === drag.towerId);
    run.mergeTargetId = candidate && source && candidate.type === source.type && candidate.level === source.level ? candidate.id : null;
  };

  onPointerUp = (event) => {
    const run = this.game?.run;
    if (!run?.drag) return;
    const drag = run.drag;
    run.drag = null;
    if (drag.mode === 'place') {
      const point = run.placementPreview || drag.point;
      const spot = point && run.map.buildSpots.find((item) => !item.occupied && Math.hypot(item.x - point.x, item.y - point.y) < 36);
      if (drag.moved && spot) this.game.towers.place(spot);
      else this.game.feedback('Suelta sobre una zona verde', 'info');
      return;
    }
    if (drag.moved && run.mergeTargetId && this.game.towers.merge(drag.towerId, run.mergeTargetId)) {
      run.mergeTargetId = null;
      return;
    }
    run.mergeTargetId = null;
    if (!drag.moved) this.game.towers.select(run.towers.find((tower) => tower.id === drag.towerId));
    else this.game.feedback('La defensa vuelve a su posición', 'info');
  }

  render() {
    if (this.screen !== 'battle' || !this.game.run) return;
    if (!this.renderFrameLogged) {
      this.renderFrameLogged = true;
      console.log('render frame');
    }
    this.renderBattleHud();
    this.drawField();
    this.renderFeedback();
    this.renderUpgrade();
    this.renderResult();
  }

  renderBattleHud() {
    const run = this.game.run;
    const set = (selector, value) => { const node = this.app.querySelector(selector); if (node) node.textContent = value; };
    set('.coins-value', Math.floor(run.coins)); set('.base-value', `${Math.ceil(run.baseHp)}%`); set('.kills-value', run.kills); set('.clicker-level', run.clickerLevel); set('.clicker-cost', this.game.economy.clickerCost()); set('.auto-value', `+${run.autoCoins + Math.floor(run.clickerLevel / 3)}`); set('.combo-value', `x${run.combo}`);
    const clickValue = Math.max(1, Math.round(Math.pow(1.8, run.clickerLevel - 1) * (1 + (run.buffs.coins || 0)))); set('.click-value', clickValue);
    const progress = Math.min(100, Math.floor(run.kills / run.totalEnemies * 100)); const progressNode = this.app.querySelector('.wave-progress'); if (progressNode) progressNode.style.width = `${progress}%`;
    const next = run.difficulty.miniBossThresholds.find((item) => !run.miniBosses.includes(item)); set('.next-boss', next ? `${next}%` : run.bossActive ? 'JEFE' : 'FINAL');
    const warning = this.app.querySelector('#boss-warning'); if (warning) warning.classList.toggle('visible', run.bossActive);
    const hint = this.app.querySelector('#field-hint'); if (hint) { hint.textContent = run.placingType ? 'Arrastra · verde coloca · rojo no disponible' : run.drag?.mode === 'merge' ? 'Suelta sobre una defensa igual para fusionar' : 'Toca una defensa para ver sus datos'; hint.classList.toggle('visible', Boolean(run.placingType || run.drag?.mode === 'merge')); }
    const panel = this.app.querySelector('#tower-panel');
    const selected = run.towers.find((tower) => tower.id === run.selectedTowerId);
    if (selected) {
      const stats = getTowerStats(selected.type, selected.level, run.buffs);
      const canMerge = run.towers.some((tower) => tower.id !== selected.id && tower.type === selected.type && tower.level === selected.level);
      panel.innerHTML = `<div class="selected-tower"><div class="selected-heading"><span class="tower-icon" style="--tower-color:${stats.color}">${stats.icon}</span><div><span class="eyebrow">DEFENSA SELECCIONADA</span><h3>${stats.name} <b>MK-${selected.level}</b></h3></div><button class="panel-close">×</button></div><div class="selected-stats"><span><small>DAÑO</small><b>${stats.damage}</b></span><span><small>CADENCIA</small><b>${stats.cooldown.toFixed(2)}s</b></span><span><small>RANGO</small><b>${Math.round(stats.range / 30)}m</b></span></div><div class="priority-row"><span>OBJETIVO</span><select class="priority-select"><option value="first">PRIMERO</option><option value="last">ÚLTIMO</option><option value="strong">FUERTE</option><option value="weak">DÉBIL</option><option value="boss">JEFE</option></select></div><button class="merge-button" ${canMerge ? '' : 'disabled'}>ARRASTRA SOBRE IGUAL <span>${canMerge ? '◆ LISTA' : '—'}</span></button></div>`;
      panel.querySelector('.panel-close').addEventListener('click', () => this.game.towers.select(null));
      panel.querySelector('.priority-select').value = selected.priority; panel.querySelector('.priority-select').addEventListener('change', (event) => { selected.priority = event.target.value; });
      panel.querySelector('.merge-button').addEventListener('click', () => { if (canMerge) this.game.feedback('Mantén pulsada la defensa y arrástrala sobre otra igual', 'merge'); });
    } else panel.innerHTML = '';
  }

  drawField() {
    const ctx = this.ctx; const run = this.game.run; const { width, height } = GAME_CONFIG.map;
    if (!ctx || !run?.map) return;
    ctx.clearRect(0, 0, width, height);
    const grass = ctx.createLinearGradient(0, 0, width, height); grass.addColorStop(0, '#8ca96c'); grass.addColorStop(.55, '#72945b'); grass.addColorStop(1, '#567648'); ctx.fillStyle = grass; ctx.fillRect(0, 0, width, height);
    ctx.globalAlpha = .13; ctx.fillStyle = '#d4dc9c';
    for (let i = 0; i < 95; i += 1) { const x = (i * 137 + run.map.seed * 3) % width; const y = (i * 71 + run.map.seed) % height; ctx.fillRect(x, y, 2, 6); }
    ctx.globalAlpha = 1;
    const points = run.map.points;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); points.forEach((p, index) => index ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.strokeStyle = 'rgba(55, 67, 35, .35)'; ctx.lineWidth = 58; ctx.stroke(); ctx.strokeStyle = '#8d673f'; ctx.lineWidth = 45; ctx.stroke(); ctx.strokeStyle = '#b98a54'; ctx.lineWidth = 37; ctx.stroke(); ctx.strokeStyle = 'rgba(224, 184, 122, .5)'; ctx.lineWidth = 2; ctx.setLineDash([8, 16]); ctx.stroke(); ctx.setLineDash([]);
    for (const obstacle of run.map.obstacles) {
      ctx.save(); ctx.translate(obstacle.x, obstacle.y); ctx.rotate(obstacle.rotation || 0);
      if (obstacle.kind === 'tree') { ctx.fillStyle = '#60442f'; ctx.fillRect(-4, -obstacle.size, 8, obstacle.size * 2.3); ctx.fillStyle = '#3e5f3c'; ctx.beginPath(); ctx.arc(-9, -obstacle.size * .75, obstacle.size * .72, 0, Math.PI * 2); ctx.arc(8, -obstacle.size * .85, obstacle.size * .9, 0, Math.PI * 2); ctx.fill(); }
      else if (obstacle.kind === 'shrub') { ctx.fillStyle = '#466e3c'; ctx.beginPath(); ctx.arc(-8, 4, obstacle.size * .7, 0, Math.PI * 2); ctx.arc(7, 2, obstacle.size, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#6f8d49'; ctx.beginPath(); ctx.arc(0, -4, obstacle.size * .55, 0, Math.PI * 2); ctx.fill(); }
      else if (obstacle.kind === 'stump') { ctx.fillStyle = '#765334'; ctx.fillRect(-obstacle.size * .55, -obstacle.size * .4, obstacle.size * 1.1, obstacle.size * .9); ctx.fillStyle = '#c3945c'; ctx.beginPath(); ctx.ellipse(0, -obstacle.size * .42, obstacle.size * .55, obstacle.size * .18, 0, 0, Math.PI * 2); ctx.fill(); }
      else if (obstacle.kind === 'grass') { ctx.strokeStyle = '#547c42'; ctx.lineWidth = 3; for (let blade = -1; blade <= 1; blade += 1) { ctx.beginPath(); ctx.moveTo(blade * 5, 6); ctx.lineTo(blade * 7 - 3, -obstacle.size); ctx.stroke(); } }
      else { ctx.fillStyle = '#737767'; ctx.beginPath(); ctx.moveTo(-obstacle.size, 5); ctx.lineTo(-obstacle.size * .55, -obstacle.size); ctx.lineTo(obstacle.size, -obstacle.size * .6); ctx.lineTo(obstacle.size * .8, 6); ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#9a9a7c'; ctx.stroke(); }
      ctx.restore();
    }
    const base = points[points.length - 1]; ctx.fillStyle = '#6b4c31'; ctx.strokeStyle = '#e7c27d'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(base.x, base.y, 31, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#efe0ad'; ctx.font = '700 18px Arial'; ctx.textAlign = 'center'; ctx.fillText('⌂', base.x, base.y + 7); ctx.font = '700 11px Arial'; ctx.fillText('REFUGIO', base.x, base.y + 48);
    for (const spot of run.map.buildSpots) { const active = Boolean(run.placingType); const invalid = spot.occupied; ctx.fillStyle = active ? (invalid ? 'rgba(211, 74, 55, .22)' : 'rgba(87, 207, 104, .26)') : 'rgba(255,255,255,.035)'; ctx.strokeStyle = active ? (invalid ? '#d34a37' : '#66d878') : 'rgba(245,236,194,.3)'; ctx.setLineDash([4, 5]); ctx.beginPath(); ctx.arc(spot.x, spot.y, 24, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.setLineDash([]); }
    const selected = run.towers.find((tower) => tower.id === run.selectedTowerId); const source = run.drag?.mode === 'merge' ? run.towers.find((tower) => tower.id === run.drag.towerId) : null;
    const rangeTower = source || selected;
    if (rangeTower) { const stats = getTowerStats(rangeTower.type, rangeTower.level, run.buffs); ctx.fillStyle = 'rgba(242, 224, 146, .11)'; ctx.strokeStyle = '#ead58b'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(rangeTower.x, rangeTower.y, stats.range, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
    if (run.placingType && run.placementPreview) { const stats = getTowerStats(run.placingType, 1, run.buffs); const valid = this.game.towers.canPlaceAt(run.placementPreview); ctx.fillStyle = valid ? 'rgba(91, 221, 109, .22)' : 'rgba(211, 74, 55, .22)'; ctx.strokeStyle = valid ? '#66d878' : '#d34a37'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(run.placementPreview.x, run.placementPreview.y, stats.range, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.globalAlpha = .72; this.drawTower(ctx, { type: run.placingType, level: 1, x: run.placementPreview.x, y: run.placementPreview.y }, stats); ctx.globalAlpha = 1; }
    for (const tower of run.towers) { const stats = getTowerStats(tower.type, tower.level, run.buffs); const isTarget = tower.id === run.mergeTargetId; this.drawTower(ctx, tower, stats, tower.id === run.selectedTowerId, isTarget); }
    for (const enemy of run.enemies) { if (!enemy.alive) continue; const p = enemyPosition(enemy); ctx.fillStyle = enemy.color; ctx.beginPath(); ctx.arc(p.x, p.y, enemy.radius, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#332e25'; ctx.beginPath(); ctx.arc(p.x - 4, p.y - 2, 2.2, 0, Math.PI * 2); ctx.arc(p.x + 4, p.y - 2, 2.2, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = 'rgba(31, 48, 26, .7)'; ctx.fillRect(p.x - enemy.radius, p.y - enemy.radius - 8, enemy.radius * 2, 3); ctx.fillStyle = enemy.kind === 'boss' ? '#b9342c' : '#d8e78d'; ctx.fillRect(p.x - enemy.radius, p.y - enemy.radius - 8, enemy.radius * 2 * Math.max(0, enemy.hp / enemy.maxHp), 3); if (enemy.kind === 'mini' || enemy.kind === 'boss') { ctx.strokeStyle = enemy.kind === 'boss' ? '#b9342c' : '#8b5da5'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x, p.y, enemy.radius + 5 + Math.sin(enemy.pulse * 4) * 2, 0, Math.PI * 2); ctx.stroke(); } }
    for (const projectile of run.projectiles) { const t = 1 - projectile.life / projectile.maxLife; const x = projectile.from.x + (projectile.to.x - projectile.from.x) * t; const y = projectile.from.y + (projectile.to.y - projectile.from.y) * t; ctx.fillStyle = projectile.towerType === 'flame' ? '#ec7a35' : '#f3d27c'; ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill(); }
    if (run.mergeFx && run.mergeFx.until > performance.now()) { const progress = 1 - (run.mergeFx.until - performance.now()) / 520; ctx.strokeStyle = `rgba(255, 236, 142, ${1 - progress})`; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(run.mergeFx.x, run.mergeFx.y, 24 + progress * 34, 0, Math.PI * 2); ctx.stroke(); }
  }

  drawTower(ctx, tower, stats, selected = false, target = false) {
    const { x, y } = tower;
    ctx.save(); ctx.translate(x, y); ctx.globalAlpha *= tower.id === this.game.run.drag?.towerId ? .55 : 1;
    if (selected || target) { ctx.strokeStyle = target ? '#7de38b' : '#f1d889'; ctx.lineWidth = target ? 5 : 3; ctx.beginPath(); ctx.arc(0, 0, 25 + (target ? Math.sin(performance.now() / 120) * 2 : 0), 0, Math.PI * 2); ctx.stroke(); }
    ctx.fillStyle = '#6b482f'; ctx.fillRect(-18, 8, 36, 8); ctx.fillStyle = '#9a6b3f'; ctx.fillRect(-14, 5, 28, 7); ctx.strokeStyle = stats.color; ctx.lineWidth = 2;
    if (tower.type === 'gunner') { ctx.fillStyle = '#514f42'; ctx.fillRect(-6, -10, 12, 17); ctx.fillStyle = '#827b60'; ctx.fillRect(-3, -18, 6, 11); ctx.fillStyle = '#3c3b35'; ctx.fillRect(1, -20, 17, 4); }
    else if (tower.type === 'cannon') { ctx.fillStyle = '#6a6a54'; ctx.beginPath(); ctx.arc(0, -2, 11, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#4d4b3d'; ctx.fillRect(-2, -10, 24, 8); ctx.fillStyle = '#b58b55'; ctx.beginPath(); ctx.arc(-8, 8, 5, 0, Math.PI * 2); ctx.arc(8, 8, 5, 0, Math.PI * 2); ctx.fill(); }
    else { ctx.fillStyle = '#b04e2e'; ctx.beginPath(); ctx.roundRect(-12, -9, 19, 17, 5); ctx.fill(); ctx.strokeStyle = '#e8b35b'; ctx.stroke(); ctx.strokeStyle = '#6c4330'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(6, 0); ctx.quadraticCurveTo(14, -5, 11, -14); ctx.stroke(); ctx.fillStyle = '#f4b13c'; ctx.beginPath(); ctx.arc(12, -16, 4, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = '#f5edc5'; ctx.font = '700 10px Arial'; ctx.textAlign = 'center'; ctx.fillText(`N${tower.level}`, 0, -27); ctx.restore();
  }

  renderUpgrade() { const overlay = this.app.querySelector('#upgrade-overlay'); const options = this.game.run.upgradeOptions; if (!options.length) { overlay.classList.remove('visible'); overlay.innerHTML = ''; return; } overlay.innerHTML = `<div class="upgrade-modal"><span class="eyebrow">MUTACIÓN DE CAMPO · ELECCIÓN ${this.game.run.miniBosses.length}</span><h2>Elige una mejora</h2><p>Tu build cambia aquí. Solo puedes escoger una.</p><div class="upgrade-options">${options.map((option) => `<button class="upgrade-option" data-upgrade="${option.id}" style="--upgrade-color:${option.color}"><span class="rarity">${option.rarity}</span><strong>${option.title}</strong><small>${option.text}</small><span class="upgrade-arrow">→</span></button>`).join('')}</div></div>`; overlay.classList.add('visible'); overlay.querySelectorAll('.upgrade-option').forEach((button) => button.addEventListener('click', () => this.game.roguelike.choose(button.dataset.upgrade))); }

  renderResult() { const overlay = this.app.querySelector('#result-overlay'); if (!this.game.run.result) { overlay.classList.remove('visible'); overlay.innerHTML = ''; return; } const victory = this.game.run.result === 'victory'; overlay.innerHTML = `<div class="result-card ${victory ? 'victory' : 'defeat'}"><span class="eyebrow">${victory ? 'SECTOR ASEGURADO' : 'SEÑAL PERDIDA'}</span><h2>${victory ? 'VICTORIA' : 'LA BASE HA CAÍDO'}</h2><p>${victory ? 'THE TITAN ha sido neutralizado. El siguiente sector está disponible.' : 'Has resistido lo suficiente para recuperar recursos. Inténtalo de nuevo.'}</p>${victory ? `<div class="stars-result">${'★'.repeat(this.game.save.stars[this.game.run.level] || 1)}</div>` : ''}<div class="result-reward">+${victory ? 50 + this.game.run.level * 4 : Math.max(5, Math.floor(this.game.run.kills * .7))} ◆ CHAPA</div><button class="primary-button result-button">${victory ? 'CONTINUAR' : 'VOLVER AL MAPA'} <span>→</span></button></div>`; overlay.classList.add('visible'); overlay.querySelector('.result-button').addEventListener('click', () => this.game.returnToMap()); }

  renderFeedback() { const node = this.app.querySelector('#feedback'); if (!node || !this.game.feedbackMessage) return; const feedback = this.game.feedbackMessage; node.textContent = feedback.message; node.className = `feedback visible ${feedback.kind}`; if (feedback.expires < performance.now()) node.className = 'feedback'; }

  bottomNav(active) { return `<nav class="bottom-nav"><button class="nav-item ${active === 'map' ? 'active' : ''}" data-nav="map"><span>⌂</span><small>MAPA</small></button><button class="nav-item" data-nav="defenses"><span>◈</span><small>DEFENSAS</small></button><button class="nav-item" data-nav="commanders"><span>♙</span><small>COMANDANTES</small></button><button class="nav-item" data-nav="chests"><span>◇</span><small>COFRES</small></button><button class="nav-item" data-nav="settings"><span>⚙</span><small>AJUSTES</small></button></nav>`; }
  bindNav() { this.app.querySelectorAll('[data-nav]').forEach((button) => button.addEventListener('click', () => { if (button.dataset.nav === 'map') return; this.showToast('Disponible en la siguiente expedición'); })); }
  showToast(message) { const toast = document.createElement('div'); toast.className = 'toast'; toast.textContent = message; document.body.append(toast); setTimeout(() => toast.remove(), 1800); }
}
