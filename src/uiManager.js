import { GAME_CONFIG, WORLDS } from './config.js';
import { getTowerStats, towerCost } from './towerData.js';
import { enemyPosition } from './enemyData.js';
import { SaveSystem } from './saveSystem.js';
import groundSprite from '../sprites/cesped.png';
import treeSprite from '../sprites/arbol.png';
import shrubSprite from '../sprites/arbusto.png';
import rockSprite from '../sprites/roca.png';
import gunnerSprite from '../sprites/amt_n1.png';
import cannonSprite from '../sprites/cañ_n1.png';
import flameSprite from '../sprites/flm_n1.png';
import sniperSprite from '../sprites/hie_n1.png';
import mortarSprite from '../sprites/mis_n1.png';
import teslaSprite from '../sprites/tes_n1.png';

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
    this.upgradeRenderKey = '';
    this.upgradeSelectionLocked = false;
    this.selectedPanelKey = '';
    this.sprites = {};
    this.spritePaths = {
      ground: groundSprite,
      tree: treeSprite,
      shrub: shrubSprite,
      rock: rockSprite,
      gunner: gunnerSprite,
      cannon: cannonSprite,
      flame: flameSprite,
      sniper: sniperSprite,
      mortar: mortarSprite,
      tesla: teslaSprite,
    };
  }

  mount(game) {
    this.game = game;
    this.loadSprites();
    const maxLevel = game.levels.maxLevel();
    const savedMapLevel = Math.min(maxLevel, game.save.mapLevel || game.save.currentLevel || 1);
    const fallbackLevel = Math.min(maxLevel, game.save.currentLevel || 1);
    this.selectedLevel = game.levels.isUnlocked(savedMapLevel) ? savedMapLevel : fallbackLevel;
    this.showMap();
  }

  loadSprites() {
    Object.entries(this.spritePaths).forEach(([key, src]) => {
      const image = new Image();
      image.decoding = 'async';
      image.src = src;
      this.sprites[key] = image;
    });
  }

  showMap() {
    this.removeBattleResizeHandler();
    this.screen = 'map';
    this.app.innerHTML = `
      <main class="app-shell map-screen">
        <header class="topbar map-topbar">
          <div class="brand-lockup"><span class="brand-mark">✦</span><div><span class="eyebrow">BASE CENTRAL · TEMPORADA 01</span><h1>Tower <em>Defense</em></h1></div></div>
          <div class="resource-stack"><div class="resource special-resource"><span class="resource-icon">✦</span><strong class="crystal-value">${this.game.save.crystals}</strong><small>NÚCLEOS</small></div><div class="resource"><span class="resource-icon scrap-icon">◆</span><strong>${this.game.save.scrap}</strong><small>CHAPA</small></div><div class="resource"><span class="resource-icon tech-icon">✦</span><strong>${this.game.save.technology}</strong><small>TECH</small></div></div>
          ${this.game.save.settings?.developer ? '<span class="dev-indicator">DEV</span>' : ''}
        </header>
        <section class="map-scroll" id="map-scroll">
          <section class="map-heading"><div><span class="eyebrow">RUTA DE SUPERVIVENCIA</span><h2>Conquista el mundo</h2><p>Avanza por el camino, supera cada defensa y desbloquea el siguiente sector.</p></div><div class="map-stat"><span class="pulse-dot"></span><span>SEÑAL ACTIVA</span></div></section>
          <section class="world-track" id="world-track"></section>
        </section>
        <button class="infinite-entry" id="infinite-entry" aria-label="Abrir modo infinito"><span>∞</span><small>INFINITO</small></button>
        ${this.bottomNav('map')}
      </main>`;
    this.renderMapNodes();
    this.app.querySelector('.map-screen').addEventListener('pointerdown', (event) => {
      if (!event.target.closest('.level-node, .level-selection-card')) this.closeLevelCard();
    });
    this.app.querySelector('#infinite-entry')?.addEventListener('click', () => this.openInfinitePreparation());
    this.bindNav();
  }

  openInfinitePreparation() {
    const status = this.game.getInfiniteStatus();
    const reward = status.rewardPending ? this.game.infiniteRewardFor(status.phase) : null;
    const overlay = document.createElement('div');
    overlay.className = 'modal-backdrop infinite-preparation-backdrop';
    overlay.innerHTML = `<div class="level-modal infinite-preparation"><button class="modal-close" aria-label="Cerrar">×</button><span class="eyebrow">SUPERVIVENCIA CONTINUA</span><h2>INFINITO · FASE ${status.phase}</h2><p class="modal-title">Las fases son consecutivas. Mantén tu equipo entre fases y decide cuándo salir.</p><div class="mission-grid"><div><span>FASE ACTUAL</span><strong>${status.phase}</strong></div><div><span>RÉCORD</span><strong>${status.record}</strong></div><div><span>OBJETIVO DE DAÑO</span><strong>${this.game.createInfiniteRun(status.phase).damageTarget}</strong></div><div><span>RECOMPENSA</span><strong>${reward ? this.rewardLabel(reward) : 'YA COBRADA / SIN BONO'}</strong></div></div><div class="infinite-preparation-actions"><button class="primary-button infinite-enter">${status.activeRun ? 'CONTINUAR' : 'ENTRAR'} <span>→</span></button><button class="soft-button infinite-upgrades">MEJORAR CARTAS</button></div></div>`;
    document.body.append(overlay);
    overlay.querySelector('.modal-close').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (event) => { if (event.target === overlay) overlay.remove(); });
    overlay.querySelector('.infinite-enter').addEventListener('click', () => { overlay.remove(); this.game.startInfinite({ continueSaved: true }); });
    overlay.querySelector('.infinite-upgrades').addEventListener('click', () => { overlay.remove(); this.game.openInfiniteUpgrades(); });
  }

  rewardLabel(reward) {
    return Object.entries({ scrap: 'CHAPA', crystals: 'NÚCLEOS', technology: 'TECNO' }).filter(([key]) => reward[key]).map(([key, label]) => `+${reward[key]} ${label}`).join(' · ');
  }

  renderMapNodes() {
    const track = this.app.querySelector('#world-track');
    let html = '';
    for (const world of [...WORLDS].reverse()) {
      html += `<section class="world-card" style="--world-color:${world.color}"><div class="world-label"><span class="world-number">0${world.id}</span><div><span class="eyebrow">MUNDO ${world.id}</span><h3>${world.name}</h3><p>${world.subtitle}</p></div><span class="world-progress">${this.worldProgress(world)}%</span></div><div class="world-decor"></div><div class="level-path">`;
      for (let i = world.levels; i >= 1; i -= 1) {
        const level = (world.id - 1) * 10 + i;
        const unlocked = this.game.levels.isUnlocked(level);
        const completed = this.game.save.completedLevels.includes(level);
        const stars = this.game.save.stars[level] || 0;
        const current = unlocked && !completed && level === this.game.save.currentLevel;
        html += `<button class="level-node ${unlocked ? 'unlocked' : 'locked'} ${completed ? 'completed' : ''} ${current ? 'current' : ''} ${level % 5 === 0 ? 'boss-node' : ''}" data-level="${level}" ${unlocked ? '' : 'disabled'}><span class="node-orbit">${unlocked ? '✦' : ''}</span><span class="node-number">${level}</span><span class="node-name">${level % 5 === 0 ? 'JEFE' : current ? 'JUGAR' : completed ? 'LISTO' : 'BLOQUEADO'}</span><span class="stars">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</span></button>`;
      }
      html += '</div></section>';
    }
    track.innerHTML = html;
    track.querySelectorAll('.level-node.unlocked').forEach((button) => button.addEventListener('click', () => this.selectLevel(Number(button.dataset.level), false)));
    const fallbackLevel = Math.min(this.game.levels.maxLevel(), this.game.save.currentLevel || 1);
    const firstUnlocked = this.game.levels.isUnlocked(this.selectedLevel) ? this.selectedLevel : fallbackLevel;
    this.selectLevel(firstUnlocked, false);
    // El mapa tiene su propio scroll. Ajustarlo aquí, de forma síncrona,
    // evita pintar primero el nivel 30 y elimina el salto visible al entrar.
    this.focusMapLevel(firstUnlocked, 'auto');
    this.mapFocusLevel = null;
  }

  focusMapLevel(level, behavior = 'auto') {
    const scroll = this.app.querySelector('#map-scroll');
    const node = this.app.querySelector(`.level-node[data-level="${level}"]`);
    if (!scroll || !node) return;
    const scrollRect = scroll.getBoundingClientRect();
    const nodeRect = node.getBoundingClientRect();
    const nodeTop = nodeRect.top - scrollRect.top + scroll.scrollTop;
    const target = nodeTop - (scroll.clientHeight - nodeRect.height) / 2;
    const maxScroll = Math.max(0, scroll.scrollHeight - scroll.clientHeight);
    scroll.scrollTo({ top: Math.max(0, Math.min(maxScroll, target)), behavior });
  }

  selectLevel(level, scroll = true) {
    if (!this.game.levels.isUnlocked(level)) return;
    this.selectedLevel = level;
    this.app.querySelectorAll('.level-node').forEach((node) => node.classList.toggle('current', Number(node.dataset.level) === level));
    const meta = this.game.levels.getLevel(level);
    this.closeLevelCard();
    const node = this.app.querySelector(`.level-node[data-level="${level}"]`);
    const path = node?.closest('.level-path');
    if (!node || !path) return;
    const card = document.createElement('aside');
    card.className = 'level-selection-card';
    card.innerHTML = `<button class="level-card-close" aria-label="Cerrar">×</button><span class="level-card-number">${level}</span><strong>${meta.name}</strong><button class="primary-button play-selected">JUGAR NIVEL</button>`;
    path.append(card);
    card.querySelector('.level-card-close').addEventListener('click', (event) => { event.stopPropagation(); this.closeLevelCard(); });
    card.querySelector('.play-selected').addEventListener('click', () => this.game.startLevel(level));
    window.requestAnimationFrame(() => this.positionLevelCard(card, node, path));
    if (scroll) this.focusMapLevel(level, 'smooth');
  }

  positionLevelCard(card, node, path) {
    const nodeRect = node.getBoundingClientRect();
    const pathRect = path.getBoundingClientRect();
    const cardWidth = card.getBoundingClientRect().width;
    const gap = 12;
    const rightPosition = nodeRect.right - pathRect.left + gap;
    const leftPosition = nodeRect.left - pathRect.left - cardWidth - gap;
    const fitsRight = rightPosition + cardWidth <= pathRect.width - 8;
    const fitsLeft = leftPosition >= 8;
    const left = fitsRight ? rightPosition : fitsLeft ? leftPosition : Math.max(8, Math.min(pathRect.width - cardWidth - 8, rightPosition));
    card.dataset.side = fitsRight ? 'right' : 'left';
    card.style.left = `${left}px`;
    card.style.top = `${nodeRect.top - pathRect.top + nodeRect.height / 2}px`;
  }

  closeLevelCard() {
    this.app?.querySelector('.level-selection-card')?.remove();
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

  showChests() {
    this.removeBattleResizeHandler();
    this.screen = 'chests';
    this.app.innerHTML = `<main class="app-shell screen-shell"><header class="topbar"><div class="brand-lockup"><span class="brand-mark">✦</span><div><span class="eyebrow">RECOMPENSAS DE CAMPAÑA</span><h1>Mis <em>cofres</em></h1></div></div><div class="resource-stack"><div class="resource special-resource"><span class="resource-icon">✦</span><strong class="crystal-value">${this.game.save.crystals}</strong><small>NÚCLEOS</small></div><div class="resource"><span class="resource-icon">◆</span><strong>${this.game.save.scrap}</strong><small>CHAPA</small></div></div></header><section class="screen-head"><div><span class="eyebrow">BOTÍN DISPONIBLE</span><h2>Abre y celebra</h2><p>Usa núcleos de jefe para decidir entre recompensas inmediatas o mejoras permanentes.</p></div><span class="screen-badge">3 RAREZAS</span></section><section class="collection-grid chest-grid"><article class="chest-card" data-cost="2" data-scrap="25" data-tech="1" style="--chest-color:#a8b7a5"><span class="rarity">COMÚN · ✦ 2</span><div class="chest-visual">🧰</div><h3>Kit de campo</h3><p>Materiales y recursos básicos.</p><div class="chest-timer">LISTO</div><div class="reward-reveal">+25 CHAPA · +1 TECNO</div><button class="soft-button open-chest">ABRIR COFRE</button></article><article class="chest-card" data-cost="5" data-scrap="60" data-tech="1" style="--chest-color:#78c8db"><span class="rarity">RARO · ✦ 5</span><div class="chest-visual">🎁</div><h3>Caja táctica</h3><p>Una mejora para tu próxima partida.</p><div class="chest-timer">02:34:16</div><div class="reward-reveal">+60 CHAPA · +1 TECNO</div><button class="soft-button open-chest">ABRIR COFRE</button></article><article class="chest-card" data-cost="8" data-scrap="120" data-tech="2" style="--chest-color:#d69bff"><span class="rarity">ÉPICO · ✦ 8</span><div class="chest-visual">💎</div><h3>Cofre de élite</h3><p>Recompensas de comandante.</p><div class="chest-timer">06:00:00</div><div class="reward-reveal">+120 CHAPA · +2 TECNO</div><button class="soft-button open-chest">ABRIR COFRE</button></article></section>${this.bottomNav('chests')}</main>`;
    this.app.querySelectorAll('.open-chest').forEach((button) => button.addEventListener('click', () => {
      const card = button.closest('.chest-card');
      if (card.classList.contains('opened')) return;
      const cost = Number(card.dataset.cost || 0);
      if (!this.game.spendCrystals(cost)) {
        this.showToast(`Necesitas ${cost} núcleos de jefe`);
        return;
      }
      this.game.save.scrap += Number(card.dataset.scrap || 0);
      this.game.save.technology += Number(card.dataset.tech || 0);
      SaveSystem.save(this.game.save);
      const currency = this.app.querySelector('.crystal-value');
      if (currency) currency.textContent = this.game.save.crystals;
      card.classList.add('opening');
      window.setTimeout(() => card.classList.add('opened'), 280);
      button.textContent = 'RECOMPENSA VISTA';
    }));
    this.bindNav();
  }

  showDefenses() {
    this.removeBattleResizeHandler();
    this.screen = 'defenses';
    const cards = Object.values(GAME_CONFIG.towers).map((tower) => {
      const level = this.game.towerLevel(tower.id);
      const stats = getTowerStats(tower.id, 1, {}, level);
      const damage = Math.min(100, Math.round(stats.damage / 70 * 100));
      const speed = Math.min(100, Math.round(1 / stats.cooldown * 24));
      const range = Math.min(100, Math.round(stats.range / 2));
      return `<button class="defense-card" data-defense="${tower.id}"><span class="rarity" style="--chest-color:${tower.rarityColor}">${tower.rarity} · NIVEL ${level}</span><span class="tower-art defense-art">${this.towerArt(tower.id)}</span><h3>${tower.name}</h3><div class="defense-meta"><span>${tower.type}</span><b>✦ ${this.game.towerUpgradeCost(tower.id)}</b></div><div class="stat-bars"><div class="stat-bar"><span>DAÑO</span><i class="stat-track"><i style="width:${damage}%"></i></i><b>${stats.damage}</b></div><div class="stat-bar"><span>RITMO</span><i class="stat-track"><i style="width:${speed}%"></i></i><b>${Math.round(1 / stats.cooldown * 10)}</b></div><div class="stat-bar"><span>RANGO</span><i class="stat-track"><i style="width:${range}%"></i></i><b>${Math.round(stats.range)}</b></div></div></button>`;
    }).join('');
    this.app.innerHTML = `<main class="app-shell screen-shell"><header class="topbar"><div class="brand-lockup"><span class="brand-mark">✦</span><div><span class="eyebrow">ARSENAL DE LA BASE</span><h1>Tus <em>defensas</em></h1></div></div><div class="resource-stack"><div class="resource special-resource"><span class="resource-icon">✦</span><strong class="crystal-value">${this.game.save.crystals}</strong><small>NÚCLEOS</small></div><div class="resource"><span class="resource-icon tech-icon">✦</span><strong>${this.game.save.technology}</strong><small>TECNO</small></div></div></header><section class="screen-head"><div><span class="eyebrow">COLECCIÓN ACTIVA</span><h2>Elige tu guardián</h2><p>Invierte núcleos de jefe para mejorar permanentemente el nivel inicial de tus defensas.</p></div><span class="screen-badge">${Object.keys(GAME_CONFIG.towers).length} TORRES</span></section><section class="collection-grid defense-grid">${cards}</section><section class="defense-detail panel" id="defense-detail"></section>${this.bottomNav('defenses')}</main>`;
    this.app.querySelectorAll('[data-defense]').forEach((card) => card.addEventListener('click', () => this.selectDefense(card.dataset.defense)));
    this.selectDefense('gunner');
    this.bindNav();
  }

  selectDefense(type) {
    const tower = GAME_CONFIG.towers[type];
    if (!tower) return;
    const level = this.game.towerLevel(type);
    const stats = getTowerStats(type, 1, {}, level);
    const cost = this.game.towerUpgradeCost(type);
    const detail = this.app.querySelector('#defense-detail');
    if (!detail) return;
    detail.innerHTML = `<span class="tower-art detail-art">${this.towerArt(type)}</span><div><span class="eyebrow">DEFENSA PERMANENTE</span><h3>${tower.name} · NIVEL ${level}</h3><p>${tower.description}</p></div><div class="detail-stats"><span>DAÑO<b>${stats.damage}</b></span><span>RITMO<b>${Math.round(1 / stats.cooldown * 10)}</b></span><span>RANGO<b>${Math.round(stats.range)}</b></span></div><button class="soft-button defense-upgrade" ${this.game.save.crystals < cost ? 'disabled' : ''}>MEJORAR · ✦ ${cost}</button>`;
    detail.querySelector('.defense-upgrade').addEventListener('click', () => {
      if (!this.game.upgradePermanentTower(type)) {
        this.showToast(`Necesitas ${cost} núcleos de jefe`);
        return;
      }
      this.showToast(`${tower.name} · nivel permanente ${level + 1}`);
      this.showDefenses();
    });
  }

  showCommanders() {
    this.removeBattleResizeHandler();
    this.screen = 'commanders';
    const completed = this.game.save.completedLevels.length;
    const level = Math.max(1, Math.floor(completed / 3) + 1);
    const progress = completed % 3 === 0 && completed ? 100 : Math.round((completed % 3) / 3 * 100);
    this.app.innerHTML = `<main class="app-shell screen-shell"><header class="topbar"><div class="brand-lockup"><span class="brand-mark">✦</span><div><span class="eyebrow">CENTRO DE MANDO</span><h1>Mi <em>comandante</em></h1></div></div><div class="resource-stack"><div class="resource"><span class="resource-icon">◆</span><strong>${this.game.save.scrap}</strong><small>CHAPA</small></div></div></header><section class="screen-head"><div><span class="eyebrow">PROGRESIÓN DEL JUGADOR</span><h2>La base crece contigo</h2><p>Completa sectores para desbloquear experiencia y fortalecer tus habilidades.</p></div><span class="screen-badge">NIVEL ${level}</span></section><section class="commander-hero"><div class="commander-avatar">♙</div><div><span class="eyebrow">COMANDANTE SELECCIONADO</span><h3>Ingeniera Nova</h3><p>Optimiza la base y convierte cada recurso en una oportunidad.</p><div class="xp-row"><div class="xp-label"><span>NIVEL ${level}</span><span>${progress}% XP</span></div><div class="progress-track"><i class="xp-progress" style="width:${progress}%"></i></div></div></div></section><section class="commander-grid"><article class="panel"><h3>Habilidades</h3><div class="skill-row"><div><strong>Reactor eficiente</strong><span>+10% monedas por clic</span></div><b>ACTIVA</b></div><div class="skill-row"><div><strong>Orden de construcción</strong><span>Reduce el coste inicial</span></div><b>NV. 2</b></div><div class="skill-row"><div><strong>Último bastión</strong><span>Refuerza la vida de la base</span></div><b>NV. 1</b></div></article><article class="panel"><h3>Resumen de campaña</h3><div class="skill-row"><div><strong>Sectores superados</strong><span>Tu avance en el mapa</span></div><b>${completed}</b></div><div class="skill-row"><div><strong>Estrellas reunidas</strong><span>Valoración total</span></div><b>${Object.values(this.game.save.stars).reduce((sum, stars) => sum + stars, 0)}</b></div><div class="skill-row"><div><strong>Tecnología</strong><span>Recursos de comandante</span></div><b>${this.game.save.technology}</b></div></article></section>${this.bottomNav('commanders')}</main>`;
    this.bindNav();
  }

  showSettings() {
    this.removeBattleResizeHandler();
    this.screen = 'settings';
    const sound = this.game.save.settings.sound;
    const haptics = this.game.save.settings.haptics;
    const developer = Boolean(this.game.save.settings.developer);
    this.app.innerHTML = `<main class="app-shell screen-shell"><header class="topbar"><div class="brand-lockup"><span class="brand-mark">✦</span><div><span class="eyebrow">CONTROL DE LA BASE</span><h1>Opciones de <em>juego</em></h1></div></div><span class="dev-indicator ${developer ? 'active' : ''}">${developer ? 'DEV ACTIVO' : 'NORMAL'}</span></header><section class="screen-head"><div><span class="eyebrow">PERSONALIZA TU EXPERIENCIA</span><h2>Ajustes</h2><p>Controles rápidos para que la campaña se sienta como tú quieres.</p></div><span class="screen-badge">GUARDADO LOCAL</span></section><section class="commander-grid settings-grid"><article class="panel"><h3>Experiencia</h3><div class="setting-row"><div><strong>Sonido de batalla</strong><span>Efectos y alertas de oleada</span></div><button class="toggle ${sound ? 'on' : ''}" data-setting="sound" aria-label="Activar sonido"><i></i></button></div><div class="setting-row"><div><strong>Respuesta háptica</strong><span>Feedback al pulsar controles</span></div><button class="toggle ${haptics ? 'on' : ''}" data-setting="haptics" aria-label="Activar respuesta háptica"><i></i></button></div></article><article class="panel"><h3>Partida</h3><div class="setting-row"><div><strong>Formato vertical</strong><span>Optimizado para pantalla móvil</span></div><b>ACTIVO</b></div><div class="setting-row"><div><strong>Progreso local</strong><span>Tu campaña se guarda en este navegador</span></div><b>OK</b></div><div class="setting-row developer-setting"><div><strong>Modo desarrollador</strong><span>Prueba niveles y bosses sin desbloquearlos</span></div><button class="toggle ${developer ? 'on' : ''}" data-setting="developer" aria-label="Activar modo desarrollador"><i></i></button></div></article></section>${this.bottomNav('settings')}</main>`;
    this.app.querySelectorAll('[data-setting]').forEach((button) => button.addEventListener('click', () => {
      const key = button.dataset.setting;
      this.game.save.settings[key] = !this.game.save.settings[key];
      SaveSystem.save(this.game.save);
      button.classList.toggle('on', this.game.save.settings[key]);
    }));
    this.bindNav();
  }

  showBattle() {
    this.screen = 'battle';
    this.renderFrameLogged = false;
    this.upgradeRenderKey = '';
    this.upgradeSelectionLocked = false;
    this.selectedPanelKey = '';
    const run = this.game.run;
    this.resultRenderKey = '';
    const infinite = run.mode === 'infinite';
    const battleLabel = infinite ? `FASE ${run.infinitePhase}` : `NIVEL ${String(run.level).padStart(2, '0')}`;
    const currentClickValue = GAME_CONFIG.economy.clickValues[Math.min(GAME_CONFIG.economy.clickValues.length - 1, run.clickerLevel - 1)] || 1;
    const nextClickValue = GAME_CONFIG.economy.clickValues[run.clickerLevel] || 'MÁX';
    const clickerCost = this.game.economy.clickerCost() || 'MÁX';
    console.log('showBattle', { level: run?.level, mapReady: Boolean(run?.map) });
    this.app.innerHTML = `<main class="app-shell battle-screen ${infinite ? 'infinite-battle' : ''}"><header class="battle-header"><button class="icon-button back-map" aria-label="Volver al mapa">‹</button><div class="battle-title"><h1>${battleLabel}</h1></div><div class="battle-progress"><div class="battle-progress-top"><span class="phase-label">${infinite ? 'DAÑO' : 'OLEADA'}</span><b class="progress-value">0%</b></div><div class="progress-track"><i class="wave-progress"></i><span class="progress-marker marker-10"></span><span class="progress-marker marker-20"></span><span class="progress-marker marker-30"></span><span class="progress-marker marker-40"></span><span class="progress-marker marker-50"></span><span class="progress-marker marker-60"></span><span class="progress-marker marker-70"></span><span class="progress-marker marker-80"></span><span class="progress-marker marker-90"></span></div><small class="phase-value">${infinite ? 'FASE EN CURSO' : 'PREPARACIÓN'}</small><small class="next-boss">${infinite ? '' : 'SIGUIENTE · MINIBOSS'}</small></div><div class="battle-resources"><span class="hud-resource coins-resource"><i class="hud-icon coin-icon" aria-hidden="true">◆</i><b class="coins-value">${run.coins}</b></span>${infinite ? '' : `<span class="hud-resource enemies-resource"><i class="hud-icon enemy-icon" aria-hidden="true">●</i><b class="enemy-count">0/${run.totalEnemies}</b></span>`}</div></header><section class="battle-layout"><div class="game-field"><canvas id="battle-canvas" width="540" height="640"></canvas><div class="boss-hud" id="boss-hud"><div><strong class="boss-name">THE TITAN</strong><span class="boss-health-label">100%</span></div><div class="boss-health-track"><i class="boss-progress"></i></div></div><div class="field-hint" id="field-hint">Mantén y arrastra hasta una zona verde</div><div class="boss-warning" id="boss-warning"><span>MINIBOSS</span><strong>THE TITAN</strong></div></div><aside class="battle-side"><div class="tower-shop"><div class="section-label"><span>DEFENSAS</span><small>ARRASTRA AL MAPA</small></div><div class="tower-cards">${Object.values(GAME_CONFIG.towers).map((tower) => `<button class="tower-card" data-tower="${tower.id}" title="Arrastra para colocar o fusionar" style="--rarity-color:${tower.rarityColor}"><span class="tower-art" style="--tower-color:${tower.color}">${this.towerArt(tower.id)}</span><span><strong>${tower.shortName}</strong><small>${tower.name} · ${infinite ? 'NIVEL' : 'NV.'}${this.game.towerLevel(tower.id)}</small></span><em>◆ ${tower.cost}</em></button>`).join('')}</div></div><div class="clicker-zone"><div class="clicker-currency"><i class="hud-icon coin-icon" aria-hidden="true">◆</i><b class="coins-value">${run.coins}</b></div><div class="clicker-card"><button class="clicker-button" id="clicker-button" aria-label="CLICKER ×${currentClickValue}"><span class="clicker-title">CLICKER</span><strong>×<b class="click-value">${currentClickValue}</b></strong></button></div><button class="upgrade-clicker" id="upgrade-clicker" aria-label="MEJORAR a ×${nextClickValue} por ◆ ${clickerCost}"><strong>MEJORAR <span aria-hidden="true">→</span> ×<b class="clicker-next-level">${nextClickValue}</b></strong><span class="clicker-price">◆ <b class="clicker-cost">${clickerCost}</b></span></button></div><div class="tower-panel" id="tower-panel"></div></aside></section><div class="shop-drag-preview" id="shop-drag-preview" aria-hidden="true"></div><div class="feedback" id="feedback"></div><div class="upgrade-overlay" id="upgrade-overlay"></div><div class="result-overlay" id="result-overlay"></div></main>`;
    this.app.querySelectorAll('.tower-card').forEach((card) => {
      const tower = GAME_CONFIG.towers[card.dataset.tower];
      const cost = towerCost(card.dataset.tower, this.game.towerLevel(card.dataset.tower));
      const price = card.querySelector('em');
      if (tower && price) price.textContent = `◆ ${cost}`;
    });
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
    this.canvas.style.height = '100%';
    this.canvas.style.maxWidth = '100%';
    this.canvas.style.maxHeight = '100%';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.canvasMetrics = { cssWidth: rect.width || cssWidth, cssHeight: rect.height || cssHeight, dpr, viewportWidth, viewportHeight };
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
    document.removeEventListener('pointercancel', this.onPointerCancel);
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
    const clickerButton = this.app.querySelector('#clicker-button');
    clickerButton.addEventListener('pointerdown', (event) => {
      // Activar en pointerdown elimina el retardo de click en móvil. La
      // política touch-action del botón evita que una ráfaga se convierta en
      // doble toque/zoom del navegador.
      if (!event.isPrimary || (event.button !== undefined && event.button !== 0)) return;
      event.preventDefault();
      this.game.clicker.press();
    });
    // Mantener la activación por teclado sin duplicar la activación táctil.
    clickerButton.addEventListener('click', (event) => {
      if (event.detail === 0) this.game.clicker.press();
    });
    this.app.querySelector('#upgrade-clicker').addEventListener('click', () => this.game.clicker.upgrade());
    this.app.querySelectorAll('.tower-card').forEach((button) => button.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      if (!this.game.towers.buy(button.dataset.tower)) {
        this.game.feedback('No hay suficientes monedas', 'info');
        return;
      }
      const drag = this.game.run.drag;
      drag.pointerId = event.pointerId;
      drag.clientX = event.clientX;
      drag.clientY = event.clientY;
      drag.fromShop = true;
      drag.inCanvas = false;
      drag.pointerValid = false;
      drag.pointerPoint = null;
      drag.lastValidPoint = null;
      this.updateShopDragPreview(event);
    }));
    this.app.querySelector('.battle-side').addEventListener('pointerdown', (event) => {
      if (!event.target.closest('.tower-panel')) this.game.towers.select(null);
    });
    this.canvas.addEventListener('pointerdown', (event) => this.onCanvasPointerDown(event));
    document.addEventListener('pointermove', this.onPointerMove);
    document.addEventListener('pointerup', this.onPointerUp);
    document.addEventListener('pointercancel', this.onPointerCancel);
  }

  canvasPoint(event) {
    const rect = this.canvas.getBoundingClientRect();
    return { x: (event.clientX - rect.left) * GAME_CONFIG.map.width / rect.width, y: (event.clientY - rect.top) * GAME_CONFIG.map.height / rect.height };
  }

  pointInsideCanvas(event) {
    const rect = this.canvas.getBoundingClientRect();
    return event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
  }

  towerArt(type) {
    const src = this.spritePaths[type] || this.spritePaths.gunner;
    return `<img class="tower-sprite" src="${src}" alt="" draggable="false" aria-hidden="true">`;
  }

  updateShopDragPreview(event = null) {
    const node = this.app.querySelector('#shop-drag-preview');
    const run = this.game?.run;
    const drag = run?.drag;
    if (!node || !run || drag?.mode !== 'place' || !drag.fromShop || !run.placingType) {
      this.hideShopDragPreview();
      return;
    }
    if (event) {
      drag.clientX = event.clientX;
      drag.clientY = event.clientY;
    }
    const hasPointer = Number.isFinite(drag.clientX) && Number.isFinite(drag.clientY);
    if (!hasPointer) return;
    const inside = this.pointInsideCanvas({ clientX: drag.clientX, clientY: drag.clientY });
    if (inside) {
      node.classList.remove('visible');
      node.setAttribute('aria-hidden', 'true');
      return;
    }
    const tower = GAME_CONFIG.towers[run.placingType];
    const shellRect = this.app.querySelector('.battle-screen').getBoundingClientRect();
    if (node.dataset.type !== run.placingType) {
      node.dataset.type = run.placingType;
      node.innerHTML = `<div class="drag-preview-card" style="--rarity-color:${tower.rarityColor}"><span class="drag-preview-art">${this.towerArt(tower.id)}</span><strong>${tower.name}</strong><small>NV.${run.placingLevel || 1} · ◆ ${towerCost(tower.id, run.placingLevel || 1)}</small></div>`;
    }
    node.style.left = `${drag.clientX - shellRect.left}px`;
    node.style.top = `${drag.clientY - shellRect.top}px`;
    node.classList.add('visible');
    node.setAttribute('aria-hidden', 'false');
  }

  hideShopDragPreview() {
    const node = this.app?.querySelector('#shop-drag-preview');
    if (!node) return;
    node.classList.remove('visible');
    node.setAttribute('aria-hidden', 'true');
  }

  updateMergeIndicators() {
    const run = this.game?.run;
    if (!run) return new Set();
    const activeDrag = run.drag?.mode === 'merge' && run.drag.ready && run.drag.moved
      ? run.towers.find((tower) => tower.id === run.drag.towerId)
      : run.drag?.mode === 'place' && run.drag.inCanvas && run.drag.moved && run.placingType
        ? { type: run.placingType, level: run.placingLevel || 1 }
        : null;
    if (!activeDrag) {
      run.mergeableTowerIds = new Set();
      return run.mergeableTowerIds;
    }
    const groups = new Map();
    for (const tower of run.towers) {
      const key = `${tower.type}:${tower.level}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(tower.id);
    }
    const compatible = activeDrag.level < 5 ? (groups.get(`${activeDrag.type}:${activeDrag.level}`) || []) : [];
    const mergeable = new Set(compatible.filter((id) => id !== run.drag?.towerId));
    run.mergeableTowerIds = mergeable;
    return mergeable;
  }

  onCanvasPointerDown(event) {
    if (!this.game.run || this.game.run.pausedForUpgrade) return;
    event.preventDefault();
    const run = this.game.run;
    const point = this.canvasPoint(event);
    if (run.placingType) {
      const valid = this.game.towers.getPlacementValidation(point, run.placingType).valid;
      run.drag = { mode: 'place', type: run.placingType, level: run.placingLevel || 1, pointerId: event.pointerId, moved: false, point, fromShop: false, inCanvas: true, pointerValid: valid, pointerPoint: point, lastValidPoint: valid ? { ...point } : null };
      run.placementPreview = valid ? { ...point } : null;
      return;
    }
    const tower = run.towers.find((item) => Math.hypot(item.x - point.x, item.y - point.y) < 30);
    if (!tower) { this.game.towers.select(null); run.mergeTargetId = null; return; }
    run.drag = { mode: 'merge', towerId: tower.id, pointerId: event.pointerId, start: point, point, moved: false, ready: false, holdTimer: window.setTimeout(() => { if (run.drag?.towerId === tower.id) run.drag.ready = true; }, 360) };
    run.mergeTargetId = null;
    this.game.towers.select(tower);
  }

  onPointerMove = (event) => {
    const run = this.game?.run;
    if (!run?.drag || run.pausedForUpgrade) return;
    const drag = run.drag;
    if (drag.pointerId !== null && event.pointerId !== drag.pointerId) return;
    if (drag.mode === 'place') {
      drag.clientX = event.clientX;
      drag.clientY = event.clientY;
      if (!this.pointInsideCanvas(event)) {
        drag.inCanvas = false;
        drag.pointerValid = false;
        drag.pointerPoint = null;
        run.mergeTargetId = null;
        this.updateShopDragPreview(event);
        return;
      }
      drag.inCanvas = true;
      drag.point = this.canvasPoint(event);
      drag.pointerPoint = drag.point;
      drag.moved = true;
      const candidate = run.towers.find((tower) => Math.hypot(tower.x - drag.point.x, tower.y - drag.point.y) < 30);
      const level = run.placingLevel || 1;
      const directTarget = candidate && candidate.level < 5 && candidate.type === run.placingType && candidate.level === level ? candidate : null;
      run.mergeTargetId = directTarget?.id || null;
      if (directTarget) {
        run.placementPreview = { x: directTarget.x, y: directTarget.y };
        drag.pointerValid = true;
      } else {
        const validation = this.game.towers.getPlacementValidation(drag.point, run.placingType);
        if (validation.valid) {
          drag.pointerValid = true;
          run.placementPreview = drag.point;
          drag.lastValidPoint = { ...drag.point };
        } else if (drag.lastValidPoint) {
          const slid = this.game.towers.slidePlacement(drag.lastValidPoint, drag.point, run.placingType);
          if (slid) {
            run.placementPreview = slid;
            drag.lastValidPoint = { ...slid };
          }
          drag.pointerValid = Boolean(run.placementPreview && this.game.towers.getPlacementValidation(run.placementPreview, run.placingType).valid);
        } else {
          // Al entrar directamente sobre un obstáculo mostramos el punto rojo
          // bajo el puntero; sólo creamos un ancla de deslizamiento después de
          // haber alcanzado una posición válida, evitando saltos radiales.
          run.placementPreview = { ...drag.point };
          drag.pointerValid = false;
        }
      }
      this.updateShopDragPreview(event);
      return;
    }
    if (!drag.ready) return;
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
    if (drag.pointerId !== null && event.pointerId !== drag.pointerId) return;
    if (drag.holdTimer) window.clearTimeout(drag.holdTimer);
    this.hideShopDragPreview();
    if (drag.mode === 'place') {
      const inside = this.pointInsideCanvas(event);
      const point = inside ? this.canvasPoint(event) : null;
      const candidate = point && run.towers.find((tower) => Math.hypot(tower.x - point.x, tower.y - point.y) < 30);
      const level = run.placingLevel || 1;
      const directTarget = candidate && candidate.level < 5 && candidate.type === run.placingType && candidate.level === level ? candidate : null;
      if (inside && drag.moved && directTarget && this.game.towers.mergePurchased(run.placingType, directTarget.id)) return;
      const finalPoint = run.placementPreview || point;
      if (inside && drag.moved && finalPoint && this.game.towers.getPlacementValidation(finalPoint, run.placingType).valid && this.game.towers.place(finalPoint)) return;
      this.game.towers.cancelPlacement();
      this.game.feedback('Colocación cancelada · sin gasto', 'info');
      return;
    }
    run.drag = null;
    if (this.pointInsideCanvas(event) && drag.moved && run.mergeTargetId && this.game.towers.merge(drag.towerId, run.mergeTargetId)) {
      run.mergeTargetId = null;
      return;
    }
    run.mergeTargetId = null;
    if (!drag.moved) this.game.towers.select(run.towers.find((tower) => tower.id === drag.towerId));
    else this.game.feedback('La defensa vuelve a su posición', 'info');
    run.mergeableTowerIds = new Set();
  }

  onPointerCancel = (event) => {
    const run = this.game?.run;
    if (!run?.drag) return;
    const drag = run.drag;
    if (drag.pointerId !== null && event.pointerId !== drag.pointerId) return;
    if (drag.holdTimer) window.clearTimeout(drag.holdTimer);
    this.hideShopDragPreview();
    if (drag.mode === 'place') this.game.towers.cancelPlacement();
    else {
      run.drag = null;
      run.mergeTargetId = null;
      run.mergeableTowerIds = new Set();
    }
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
    this.updateMergeIndicators();
    this.updateShopDragPreview();
    const set = (selector, value) => this.app.querySelectorAll(selector).forEach((node) => { node.textContent = value; });
    set('.coins-value', Math.floor(run.coins)); set('.base-value', `${Math.ceil(run.baseHp)}%`); set('.kills-value', run.kills); if (run.mode !== 'infinite') set('.enemy-count', `${run.kills}/${run.totalEnemies}`); set('.clicker-cost', this.game.economy.clickerCost() || 'MÁX'); set('.clicker-next-level', GAME_CONFIG.economy.clickValues[run.clickerLevel] || 'MÁX'); set('.phase-value', run.mode === 'infinite' ? 'FASE EN CURSO' : run.phase?.type === 'boss' ? 'BOSS FINAL' : run.phase?.type === 'miniboss' ? 'MINIBOSS' : run.phase?.type === 'wave' ? `OLEADA ${run.waveNumber}` : run.phaseLabel || 'PREPARACIÓN');
    const clickValue = GAME_CONFIG.economy.clickValues[Math.min(GAME_CONFIG.economy.clickValues.length - 1, run.clickerLevel - 1)] || 1; set('.click-value', clickValue);
    const clickerButton = this.app.querySelector('#clicker-button');
    if (clickerButton) clickerButton.setAttribute('aria-label', `CLICKER ×${clickValue}`);
    this.app.querySelectorAll('.tower-card').forEach((card) => {
      const affordable = run.coins >= towerCost(card.dataset.tower, this.game.towerLevel(card.dataset.tower));
      card.classList.toggle('insufficient', !affordable);
      card.setAttribute('aria-disabled', String(!affordable));
    });
    const upgradeButton = this.app.querySelector('#upgrade-clicker');
    if (upgradeButton) {
      const clickerCost = this.game.economy.clickerCost();
      const canAfford = Boolean(clickerCost && run.coins >= clickerCost);
      upgradeButton.classList.toggle('can-afford', canAfford);
      upgradeButton.setAttribute('aria-disabled', String(!canAfford));
      upgradeButton.setAttribute('aria-label', `MEJORAR a ×${GAME_CONFIG.economy.clickValues[run.clickerLevel] || 'MÁX'} por ◆ ${clickerCost || 'MÁX'}`);
      upgradeButton.disabled = !clickerCost;
    }
    const progress = run.mode === 'infinite' ? Math.min(100, Math.max(0, run.damageDone / Math.max(1, run.damageTarget) * 100)) : Math.min(100, Math.floor(run.kills / Math.max(1, run.totalEnemies) * 100)); const progressNode = this.app.querySelector('.wave-progress'); if (progressNode) progressNode.style.width = `${progress}%`; set('.progress-value', `${Math.floor(progress)}%`);
    const next = run.wavePlan.slice(Math.max(0, run.phaseIndex + 1)).find((item) => item.type === 'miniboss' || item.type === 'boss'); if (run.mode !== 'infinite') set('.next-boss', run.phase?.type === 'boss' ? 'BOSS FINAL' : next?.type === 'boss' ? 'BOSS FINAL' : 'MINIBOSS');
    const warning = this.app.querySelector('#boss-warning'); if (warning) { warning.classList.toggle('visible', run.bossActive || run.miniBossActive); const label = warning.querySelector('span'); const title = warning.querySelector('strong'); if (label) label.textContent = run.bossActive ? 'BOSS FINAL' : 'MINIBOSS'; if (title) title.textContent = run.bossActive ? 'THE TITAN' : 'MINI JEFE'; }
    const bossHud = this.app.querySelector('#boss-hud'); const boss = run.enemies.find((enemy) => enemy.alive && (enemy.kind === 'boss' || enemy.kind === 'mini')); if (bossHud) { bossHud.classList.toggle('visible', Boolean(boss)); if (boss) { const ratio = Math.max(0, Math.min(1, boss.hp / boss.maxHp)); const bossBar = bossHud.querySelector('.boss-progress'); if (bossBar) bossBar.style.width = `${ratio * 100}%`; const bossName = bossHud.querySelector('.boss-name'); if (bossName) bossName.textContent = boss.kind === 'boss' ? 'THE TITAN' : 'MINI JEFE'; const bossLabel = bossHud.querySelector('.boss-health-label'); if (bossLabel) bossLabel.textContent = `${Math.ceil(ratio * 100)}%`; } }
    const hint = this.app.querySelector('#field-hint'); if (hint) { hint.textContent = run.placingType ? (run.mergeTargetId ? 'FUSIÓN DIRECTA · suelta para combinar' : 'Arrastra · verde coloca · el camino bloquea') : run.drag?.mode === 'merge' ? (run.drag.ready ? 'Suelta sobre una defensa igual para fusionar' : 'Mantén pulsada para fusionar') : 'Toca una defensa para ver sus datos'; hint.classList.toggle('visible', Boolean(run.placingType || run.drag?.mode === 'merge')); }
    const panel = this.app.querySelector('#tower-panel');
    const selected = run.towers.find((tower) => tower.id === run.selectedTowerId);
    if (selected) {
      const stats = getTowerStats(selected.type, selected.level, run.buffs, this.game.towerLevel(selected.type));
      const canMerge = selected.level < 5 && run.towers.some((tower) => tower.id !== selected.id && tower.type === selected.type && tower.level === selected.level);
      const panelKey = `${selected.id}:${selected.level}:${canMerge}:${selected.priority}:${JSON.stringify(run.buffs)}`;
      if (panel && panelKey !== this.selectedPanelKey) {
        panel.innerHTML = `<div class="selected-tower"><div class="selected-heading"><span class="tower-icon tower-art" style="--tower-color:${stats.color}">${this.towerArt(selected.type)}</span><div><span class="eyebrow">DEFENSA</span><h3>${stats.name} <b>NV-${selected.level}</b></h3></div><button class="panel-close" aria-label="Cerrar información">×</button></div><div class="selected-stats"><span><small>DAÑO</small><b>${stats.damage}</b></span><span><small>CADENCIA</small><b>${stats.cooldown.toFixed(2)}s</b></span><span><small>ALCANCE</small><b>${Math.round(stats.range)}</b></span></div><div class="tower-action-row"><button data-action="upgrade">MEJORAR</button><button data-action="sell">VENDER</button><button data-action="ability">HABILIDAD</button></div><div class="priority-row"><span>OBJETIVO</span><select class="priority-select"><option value="first">PRIMERO</option><option value="last">ÚLTIMO</option><option value="strong">FUERTE</option><option value="weak">DÉBIL</option><option value="boss">JEFE</option></select></div><button class="merge-button" ${canMerge ? '' : 'disabled'}>FUSIONAR <span>${canMerge ? '◆ LISTA' : '—'}</span></button></div>`;
        panel.querySelector('.panel-close').addEventListener('click', () => this.game.towers.select(null));
        panel.querySelector('.priority-select').value = selected.priority; panel.querySelector('.priority-select').addEventListener('change', (event) => { selected.priority = event.target.value; });
        panel.querySelector('.merge-button').addEventListener('click', () => { if (canMerge) this.game.feedback('Mantén pulsada la defensa y arrástrala sobre otra igual', 'merge'); });
        panel.querySelectorAll('[data-action]').forEach((button) => button.addEventListener('click', () => this.game.feedback(`${button.textContent} disponible en el árbol de progresión`, 'info')));
        this.selectedPanelKey = panelKey;
      }
    } else if (panel && this.selectedPanelKey) {
      panel.innerHTML = '';
      this.selectedPanelKey = '';
    }
  }

  drawSprite(ctx, key, x, y, width, height = width, alpha = 1) {
    const image = this.sprites[key];
    if (!image?.naturalWidth) return false;
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.drawImage(image, x - width / 2, y - height / 2, width, height);
    ctx.restore();
    return true;
  }

  drawGround(ctx, width, height) {
    const image = this.sprites.ground;
    if (!image?.naturalWidth) return false;
    const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
    const sourceWidth = width / scale;
    const sourceHeight = height / scale;
    ctx.drawImage(image, (image.naturalWidth - sourceWidth) / 2, (image.naturalHeight - sourceHeight) / 2, sourceWidth, sourceHeight, 0, 0, width, height);
    return true;
  }

  drawField() {
    const ctx = this.ctx; const run = this.game.run; const { width, height } = GAME_CONFIG.map;
    if (!ctx || !run?.map) return;
    ctx.clearRect(0, 0, width, height);
    if (!this.drawGround(ctx, width, height)) {
      const grass = ctx.createLinearGradient(0, 0, width, height); grass.addColorStop(0, '#8ca96c'); grass.addColorStop(.55, '#72945b'); grass.addColorStop(1, '#567648'); ctx.fillStyle = grass; ctx.fillRect(0, 0, width, height);
    }
    ctx.globalAlpha = .16; ctx.fillStyle = '#e8f1ab';
    for (let i = 0; i < 70; i += 1) { const x = (i * 137 + run.map.seed * 3) % width; const y = (i * 71 + run.map.seed) % height; ctx.fillRect(x, y, 2, 5); }
    ctx.globalAlpha = 1;
    for (const obstacle of run.map.obstacles) {
      ctx.save(); ctx.translate(obstacle.x, obstacle.y); ctx.rotate(obstacle.rotation || 0);
      const asset = obstacle.kind === 'tree' ? 'tree' : obstacle.kind === 'shrub' ? 'shrub' : obstacle.kind === 'rock' ? 'rock' : null;
      const size = obstacle.kind === 'tree' ? obstacle.size * 4.5 : obstacle.size * 3.7;
      if (asset && this.drawSprite(ctx, asset, 0, obstacle.kind === 'tree' ? size * .08 : 0, size, size, .96)) {
        ctx.restore();
        continue;
      }
      if (obstacle.kind === 'stump') { ctx.fillStyle = '#765334'; ctx.fillRect(-obstacle.size * .55, -obstacle.size * .4, obstacle.size * 1.1, obstacle.size * .9); ctx.fillStyle = '#c3945c'; ctx.beginPath(); ctx.ellipse(0, -obstacle.size * .42, obstacle.size * .55, obstacle.size * .18, 0, 0, Math.PI * 2); ctx.fill(); }
      else { ctx.strokeStyle = '#547c42'; ctx.lineWidth = 3; for (let blade = -1; blade <= 1; blade += 1) { ctx.beginPath(); ctx.moveTo(blade * 5, 6); ctx.lineTo(blade * 7 - 3, -obstacle.size); ctx.stroke(); } }
      ctx.restore();
    }
    const paths = run.map.paths || [run.map.points];
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const points of paths) {
      ctx.beginPath(); points.forEach((p, index) => index ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.strokeStyle = 'rgba(55, 67, 35, .35)'; ctx.lineWidth = 58; ctx.stroke(); ctx.strokeStyle = '#8d673f'; ctx.lineWidth = 45; ctx.stroke(); ctx.strokeStyle = '#b98a54'; ctx.lineWidth = 37; ctx.stroke(); ctx.strokeStyle = 'rgba(224, 184, 122, .5)'; ctx.lineWidth = 2; ctx.setLineDash([8, 16]); ctx.stroke(); ctx.setLineDash([]);
    }
    for (const points of paths) {
      const entrance = points[0];
      ctx.fillStyle = 'rgba(38, 49, 30, .82)'; ctx.beginPath(); ctx.arc(entrance.x, entrance.y, 22, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#e7c27d'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(entrance.x, entrance.y, 16, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#fff5c4'; ctx.font = '900 9px Nunito'; ctx.textAlign = 'center'; ctx.fillText('ENTRADA', entrance.x, entrance.y + 3);
    }
    const base = paths[0][paths[0].length - 1]; ctx.fillStyle = '#6b4c31'; ctx.strokeStyle = '#e7c27d'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(base.x, base.y, 31, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#efe0ad'; ctx.font = '700 18px Arial'; ctx.textAlign = 'center'; ctx.fillText('⌂', base.x, base.y + 7); ctx.font = '700 11px Arial'; ctx.fillText('REFUGIO', base.x, base.y + 43);
    const healthWidth = 82;
    const healthX = Math.max(12, Math.min(width - healthWidth - 12, base.x + 38));
    const healthY = Math.max(16, base.y - 14);
    ctx.fillStyle = 'rgba(255,255,255,.94)'; ctx.strokeStyle = '#929a9b'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(healthX, healthY, healthWidth, 28, 14); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ef4f45'; ctx.font = '900 14px Arial'; ctx.textAlign = 'left'; ctx.fillText('♥', healthX + 8, healthY + 19);
    ctx.fillStyle = '#18241e'; ctx.font = '900 13px Nunito'; ctx.fillText(`${Math.ceil(run.baseHp)}%`, healthX + 27, healthY + 19);
    const selected = run.towers.find((tower) => tower.id === run.selectedTowerId); const source = run.drag?.mode === 'merge' ? run.towers.find((tower) => tower.id === run.drag.towerId) : null;
    const rangeTower = source || selected;
    if (rangeTower) { const stats = getTowerStats(rangeTower.type, rangeTower.level, run.buffs, this.game.towerLevel(rangeTower.type)); ctx.fillStyle = 'rgba(242, 224, 146, .11)'; ctx.strokeStyle = '#ead58b'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(rangeTower.x, rangeTower.y, stats.range, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
    if (run.drag?.mode === 'merge' && run.drag.ready && run.drag.moved) {
      const source = run.towers.find((tower) => tower.id === run.drag.towerId);
      if (source) {
        for (const tower of run.towers) {
          if (tower.id === source.id || tower.type !== source.type || tower.level !== source.level) continue;
          const pulse = 29 + Math.sin(performance.now() / 130) * 3;
          ctx.strokeStyle = tower.id === run.mergeTargetId ? '#fff0a6' : '#9be48c';
          ctx.lineWidth = tower.id === run.mergeTargetId ? 5 : 3;
          ctx.beginPath(); ctx.arc(tower.x, tower.y, pulse, 0, Math.PI * 2); ctx.stroke();
        }
      }
    }
    if (run.placingType && run.placementPreview && run.drag?.inCanvas) {
      const level = run.placingLevel || 1;
      const stats = getTowerStats(run.placingType, level, run.buffs, this.game.towerLevel(run.placingType));
      const directMerge = Boolean(run.mergeTargetId);
      const valid = directMerge || Boolean(run.drag.pointerValid && this.game.towers.getPlacementValidation(run.placementPreview, run.placingType).valid);
      const color = directMerge ? '#ffe06f' : valid ? '#66d878' : '#d34a37';
      ctx.fillStyle = directMerge ? 'rgba(255, 224, 111, .2)' : valid ? 'rgba(91, 221, 109, .18)' : 'rgba(211, 74, 55, .18)';
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(run.placementPreview.x, run.placementPreview.y, stats.range, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      if (!directMerge) {
        ctx.fillStyle = valid ? 'rgba(97, 225, 121, .12)' : 'rgba(211, 74, 55, .12)';
        ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.setLineDash([7, 6]);
        ctx.beginPath(); ctx.arc(run.placementPreview.x, run.placementPreview.y, GAME_CONFIG.placement.towerSeparation, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.setLineDash([]);
      }
      this.drawTower(ctx, { type: run.placingType, level, x: run.placementPreview.x, y: run.placementPreview.y }, stats, false, directMerge, { scale: 1.13, lift: -8, held: true, alpha: .72 });
      if (directMerge) { const target = run.towers.find((tower) => tower.id === run.mergeTargetId); if (target) { ctx.strokeStyle = '#fff0a6'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(target.x, target.y, 31 + Math.sin(performance.now() / 130) * 3, 0, Math.PI * 2); ctx.stroke(); } }
      if (run.drag.pointerPoint && !run.drag.pointerValid) { ctx.fillStyle = 'rgba(211, 74, 55, .8)'; ctx.beginPath(); ctx.arc(run.drag.pointerPoint.x, run.drag.pointerPoint.y, 5, 0, Math.PI * 2); ctx.fill(); }
    }
    if (run.drag?.mode === 'merge' && run.drag.ready && run.drag.moved && run.drag.point) {
      const source = run.towers.find((tower) => tower.id === run.drag.towerId);
      if (source) {
        const stats = getTowerStats(source.type, source.level, run.buffs, this.game.towerLevel(source.type));
        ctx.fillStyle = 'rgba(242, 224, 146, .08)'; ctx.strokeStyle = 'rgba(234, 213, 139, .55)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(run.drag.point.x, run.drag.point.y, stats.range, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        this.drawTower(ctx, { type: source.type, level: source.level, x: run.drag.point.x, y: run.drag.point.y }, stats, false, Boolean(run.mergeTargetId), { scale: 1.08, lift: -7, alpha: .65, held: true });
      }
    }
    if (run.mergeFx && run.mergeFx.until > performance.now()) this.drawMergeEffect(ctx, run);
    for (const tower of run.towers) { const stats = getTowerStats(tower.type, tower.level, run.buffs, this.game.towerLevel(tower.type)); const isTarget = tower.id === run.mergeTargetId; const fx = run.mergeFx && tower.id === run.mergeFx.resultId ? this.mergeProgress(run.mergeFx) : null; const animation = fx ? { scale: .72 + fx * .28, alpha: .45 + fx * .55, lift: (1 - fx) * 6 } : {}; animation.mergeable = run.mergeableTowerIds?.has(tower.id); this.drawTower(ctx, tower, stats, tower.id === run.selectedTowerId, isTarget, animation); }
    for (const enemy of run.enemies) {
      if (!enemy.alive) continue;
      const p = enemyPosition(enemy);
      if (enemy.slowTimer > 0) {
        ctx.strokeStyle = '#8fe7ff';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(p.x, p.y, enemy.radius + 5 + Math.sin(enemy.pulse * 7) * 1.5, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.fillStyle = enemy.color; ctx.beginPath(); ctx.arc(p.x, p.y, enemy.radius, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#332e25'; ctx.beginPath(); ctx.arc(p.x - 4, p.y - 2, 2.2, 0, Math.PI * 2); ctx.arc(p.x + 4, p.y - 2, 2.2, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = 'rgba(31, 48, 26, .7)'; ctx.fillRect(p.x - enemy.radius, p.y - enemy.radius - 8, enemy.radius * 2, 3); ctx.fillStyle = enemy.kind === 'boss' ? '#b9342c' : '#d8e78d'; ctx.fillRect(p.x - enemy.radius, p.y - enemy.radius - 8, enemy.radius * 2 * Math.max(0, enemy.hp / enemy.maxHp), 3); if (enemy.kind === 'mini' || enemy.kind === 'boss') { ctx.strokeStyle = enemy.kind === 'boss' ? '#b9342c' : '#8b5da5'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x, p.y, enemy.radius + 5 + Math.sin(enemy.pulse * 4) * 2, 0, Math.PI * 2); ctx.stroke(); }
    }
    for (const projectile of run.projectiles) { const t = 1 - projectile.life / projectile.maxLife; const x = projectile.from.x + (projectile.to.x - projectile.from.x) * t; const y = projectile.from.y + (projectile.to.y - projectile.from.y) * t; ctx.fillStyle = projectile.towerType === 'flame' ? '#ec7a35' : '#f3d27c'; ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill(); }
  }

  mergeProgress(effect) { return Math.min(1, Math.max(0, 1 - (effect.until - performance.now()) / (effect.until - effect.started))); }

  drawMergeEffect(ctx, run) {
    const effect = run.mergeFx;
    const progress = this.mergeProgress(effect);
    const ease = progress * (2 - progress);
    ctx.save();
    if (effect.from) {
      ctx.globalAlpha = 1 - progress;
      const ghost = { type: effect.type, level: effect.level, x: effect.from.x + (effect.x - effect.from.x) * ease, y: effect.from.y + (effect.y - effect.from.y) * ease };
      this.drawTower(ctx, ghost, getTowerStats(effect.type, effect.level, run.buffs, this.game.towerLevel(effect.type)), false, false, { scale: 1 + progress * .12, held: true });
    }
    ctx.globalAlpha = .7;
    ctx.strokeStyle = `rgba(255, 235, 140, ${1 - progress})`;
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(effect.x, effect.y, 20 + progress * 42, 0, Math.PI * 2); ctx.stroke();
    for (let index = 0; index < 8; index += 1) {
      const angle = index / 8 * Math.PI * 2;
      const distance = 24 + progress * 34;
      ctx.fillStyle = index % 2 ? '#fff0a6' : '#91dd8c';
      ctx.beginPath(); ctx.arc(effect.x + Math.cos(angle) * distance, effect.y + Math.sin(angle) * distance, 3 + progress * 2, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = progress > .68 ? 1 : 0;
    ctx.fillStyle = '#fff5bf'; ctx.font = '900 22px Nunito'; ctx.textAlign = 'center'; ctx.fillText(`LV.${effect.level + 1}`, effect.x, effect.y - 42);
    ctx.restore();
  }

  drawTower(ctx, tower, stats, selected = false, target = false, animation = {}) {
    const { x, y } = tower;
    const scale = (animation.scale || 1) * (target ? 1.04 + Math.sin(performance.now() / 130) * .025 : 1);
    ctx.save(); ctx.translate(x, y - (animation.lift || 0)); ctx.scale(scale, scale); ctx.globalAlpha *= (animation.alpha || 1) * (tower.id === this.game.run.drag?.towerId ? .55 : 1); if (animation.held) { ctx.shadowColor = 'rgba(24, 38, 22, .48)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 10; }
    if (animation.mergeable) { ctx.strokeStyle = `rgba(255, 220, 111, ${.72 + Math.sin(performance.now() / 240) * .18})`; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, 0, 29 + Math.sin(performance.now() / 180) * 2, 0, Math.PI * 2); ctx.stroke(); }
    if (selected || target) { ctx.strokeStyle = target ? '#7de38b' : '#f1d889'; ctx.lineWidth = target ? 5 : 3; ctx.beginPath(); ctx.arc(0, 0, 25 + (target ? Math.sin(performance.now() / 120) * 2 : 0), 0, Math.PI * 2); ctx.stroke(); }
    ctx.fillStyle = animation.mergeable ? '#c19b4a' : 'rgba(48, 63, 38, .34)'; ctx.beginPath(); ctx.ellipse(0, 17, 22, 7, 0, 0, Math.PI * 2); ctx.fill();
    const spriteSize = 58;
    if (!this.drawSprite(ctx, tower.type, 0, 0, spriteSize, spriteSize, 1)) {
      ctx.fillStyle = '#6b482f'; ctx.fillRect(-18, 8, 36, 8); ctx.fillStyle = '#9a6b3f'; ctx.fillRect(-14, 5, 28, 7); ctx.strokeStyle = stats.color; ctx.lineWidth = 2;
      ctx.fillStyle = '#514f42'; ctx.fillRect(-6, -10, 12, 17); ctx.fillStyle = '#827b60'; ctx.fillRect(-3, -18, 6, 11); ctx.fillStyle = '#3c3b35'; ctx.fillRect(1, -20, 17, 4);
    }
    ctx.fillStyle = '#f5edc5'; ctx.font = '700 10px Arial'; ctx.textAlign = 'center'; ctx.fillText(`N${tower.level}`, 0, -27); ctx.restore();
  }

  renderUpgrade() {
    const overlay = this.app.querySelector('#upgrade-overlay');
    const options = this.game.run.upgradeOptions;
    if (!options.length) {
      overlay.classList.remove('visible');
      overlay.innerHTML = '';
      overlay.dataset.upgradeKey = '';
      this.upgradeRenderKey = '';
      return;
    }
    const key = options.map((option) => option.id).join('|');
    if (this.upgradeRenderKey !== key) {
      this.upgradeRenderKey = key;
      overlay.innerHTML = `<div class="upgrade-modal"><span class="eyebrow">MUTACIÓN DE CAMPO · ELECCIÓN ${this.game.run.miniBosses.length}</span><h2>Elige una mejora</h2><p>Tu build cambia aquí. Solo puedes escoger una.</p><div class="upgrade-options">${options.map((option) => `<button class="upgrade-option" data-upgrade="${option.id}" style="--upgrade-color:${option.color}"><span class="rarity">${option.rarity}</span><strong>${option.title}</strong><small>${option.text}</small><span class="upgrade-arrow">→</span></button>`).join('')}</div></div>`;
      overlay.dataset.upgradeKey = key;
      overlay.querySelectorAll('.upgrade-option').forEach((button) => button.addEventListener('click', () => {
        if (this.upgradeSelectionLocked) return;
        this.upgradeSelectionLocked = true;
        overlay.querySelectorAll('.upgrade-option').forEach((option) => { option.disabled = true; option.classList.add('locked'); });
        button.classList.remove('locked');
        button.classList.add('selected');
        window.setTimeout(() => {
          if (this.game.run?.upgradeOptions.some((option) => option.id === button.dataset.upgrade)) this.game.roguelike.choose(button.dataset.upgrade);
          this.upgradeSelectionLocked = false;
        }, 180);
      }));
    }
    overlay.classList.add('visible');
  }

  renderResult() {
    const overlay = this.app.querySelector('#result-overlay');
    const run = this.game.run;
    if (!run?.result) { overlay.classList.remove('visible'); overlay.innerHTML = ''; this.resultRenderKey = ''; return; }
    const victory = run.result === 'victory';
    const key = `${run.mode}:${run.result}:${run.infinitePhase || run.level}`;
    if (this.resultRenderKey === key) { overlay.classList.add('visible'); return; }
    this.resultRenderKey = key;
    if (run.mode === 'infinite') {
      const reward = victory ? this.game.infiniteRewardFor(run.infinitePhase) : null;
      overlay.innerHTML = `<div class="result-card ${victory ? 'victory' : 'defeat'}"><span class="eyebrow">${victory ? 'FASE ASEGURADA' : 'SEÑAL PERDIDA'}</span><h2>${victory ? `FASE ${run.infinitePhase} SUPERADA` : 'EL REFUGIO HA CAÍDO'}</h2><p>${victory ? 'El daño objetivo se ha completado. Elige si quieres continuar o guardar tu intento.' : `El intento baja a la fase ${this.game.save.infinite.currentPhase}. Tus defensas y monedas de esta partida se han perdido.`}</p>${reward ? `<div class="result-reward">RECOMPENSA ÚNICA · ${this.rewardLabel(reward)}</div>` : '<div class="result-reward">SIN RECOMPENSA REPETIDA</div>'}<div class="result-actions">${victory ? '<button class="primary-button result-button" data-result="next">SIGUIENTE FASE <span>→</span></button><button class="soft-button result-button" data-result="save">GUARDAR Y SALIR</button>' : '<button class="primary-button result-button" data-result="retry">REINTENTAR <span>→</span></button><button class="soft-button result-button" data-result="upgrades">MEJORAR CARTAS</button><button class="soft-button result-button" data-result="map">VOLVER AL MAPA</button>'}</div></div>`;
      overlay.querySelectorAll('[data-result]').forEach((button) => button.addEventListener('click', () => {
        if (button.dataset.result === 'next') this.game.advanceInfinitePhase();
        if (button.dataset.result === 'save' || button.dataset.result === 'map') this.game.saveAndExitInfinite();
        if (button.dataset.result === 'retry') this.game.retryInfinite();
        if (button.dataset.result === 'upgrades') this.game.openInfiniteUpgrades({ discardRun: true });
      }));
    } else {
      const specialReward = run.bossCurrencyEarned ? `<br><strong>+${run.bossCurrencyEarned} ✦ NÚCLEOS DE JEFE</strong>` : '';
      overlay.innerHTML = `<div class="result-card ${victory ? 'victory' : 'defeat'}"><span class="eyebrow">${victory ? 'SECTOR ASEGURADO' : 'SEÑAL PERDIDA'}</span><h2>${victory ? 'VICTORIA' : 'LA BASE HA CAÍDO'}</h2><p>${victory ? 'THE TITAN ha sido neutralizado. El siguiente sector está disponible.' : 'Has resistido lo suficiente para recuperar recursos. Inténtalo de nuevo.'}</p>${victory ? `<div class="stars-result">${'★'.repeat(this.game.save.stars[run.level] || 1)}</div>` : ''}<div class="result-reward">+${victory ? 50 + run.level * 4 : Math.max(5, Math.floor(run.kills * .7))} ◆ CHAPA${specialReward}</div><button class="primary-button result-button" data-result="map">${victory ? 'CONTINUAR' : 'VOLVER AL MAPA'} <span>→</span></button></div>`;
      overlay.querySelector('[data-result="map"]').addEventListener('click', () => this.game.returnToMap());
    }
    overlay.classList.add('visible');
  }

  renderFeedback() { const node = this.app.querySelector('#feedback'); if (!node || !this.game.feedbackMessage) return; const feedback = this.game.feedbackMessage; node.textContent = feedback.message; node.className = `feedback visible ${feedback.kind}`; if (feedback.expires < performance.now()) node.className = 'feedback'; }

  icon(name) {
    const paths = {
      map: '<path d="m3 6 6-3 6 3 6-3v18l-6 3-6-3-6 3Z"/><path d="M9 3v18M15 6v18"/>',
      chest: '<path d="M4 8h16v12H4z"/><path d="M4 8 6 4h12l2 4M12 4v16M8 12h8"/>',
      shield: '<path d="m12 3 8 3v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6Z"/><path d="m8 12 2.5 2.5L16 9"/>',
      settings: '<path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"/><path d="m19.4 15 .1.1-1.8 3.1-.2-.1-2-1.1a7.6 7.6 0 0 1-1.7 1l-.3 2.3h-3.6l-.3-2.3a7.6 7.6 0 0 1-1.7-1l-2 1.1-.2.1-1.8-3.1.1-.1 1.8-1.4a7.6 7.6 0 0 1 0-2.2L4 10l-.1-.1 1.8-3.1.2.1 2 1.1a7.6 7.6 0 0 1 1.7-1L10 4.7h3.6l.3 2.3a7.6 7.6 0 0 1 1.7 1l2-1.1.2-.1 1.8 3.1-.1.1-1.8 1.4a7.6 7.6 0 0 1 0 2.2Z"/>',
      commander: '<circle cx="12" cy="8" r="3"/><path d="M5 21c.7-3.7 2.9-5.5 7-5.5s6.3 1.8 7 5.5M8 4 12 2l4 2"/>',
    };
    return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name]}</svg>`;
  }

  bottomNav(active) {
    const items = [['chests', 'COFRES'], ['defenses', 'DEFENSAS'], ['map', 'MAPA'], ['commanders', 'COMAND.'], ['settings', 'AJUSTES']];
    return `<nav class="bottom-nav">${items.map(([key, label]) => `<button class="nav-item ${active === key ? 'active' : ''}" data-nav="${key}">${this.icon(key === 'commanders' ? 'commander' : key === 'chests' ? 'chest' : key === 'defenses' ? 'shield' : key === 'settings' ? 'settings' : 'map')}<small>${label}</small></button>`).join('')}</nav>`;
  }

  bindNav() {
    this.app.querySelectorAll('[data-nav]').forEach((button) => button.addEventListener('click', () => {
      const screens = { map: 'showMap', chests: 'showChests', defenses: 'showDefenses', settings: 'showSettings', commanders: 'showCommanders' };
      this[screens[button.dataset.nav]]();
    }));
  }
  showToast(message) { const toast = document.createElement('div'); toast.className = 'toast'; toast.textContent = message; document.body.append(toast); setTimeout(() => toast.remove(), 1800); }
}
