import { ITEM_ICONS, ITEM_NAMES, ITEM_ORDER, canUse, itemLimit, move, newGame, placePreview, useItem } from './engine.js';
import { ACHIEVEMENTS, SKINS, applyProgress, loadSave, save } from './progression.js';

const $ = id => document.getElementById(id);
const state = loadSave(localStorage, newGame);
let selectedItem = null, selection = [], busy = false, modeSwitching = false, wonNotice = false;
const isPure = () => state.mode === 'pure';
const session = () => isPure() ? state.pure : state;
const game = () => session().games[session().activeSize];
const setGame = value => { session().games[session().activeSize] = value; };
const persist = () => { try { save(localStorage, state); } catch { say('本机存储不可用，当前进度只能保留到关闭页面。'); } };
const say = message => { $('status').textContent = message; };
const closeDrawers = () => document.querySelectorAll('.drawer[open]').forEach(drawer => drawer.close());

function tileClass(value) { return value >= 2048 ? 'tile-super' : `tile-${value}`; }
function renderBoard(spawned, merges = []) {
  const g = game(), board = $('board');
  board.style.setProperty('--size', g.size);
  board.innerHTML = '';
  g.board.forEach((value, index) => {
    const cell = document.createElement('button');
    cell.type = 'button'; cell.className = 'cell'; cell.setAttribute('role', 'gridcell');
    cell.setAttribute('aria-label', `${Math.floor(index / g.size) + 1} 行 ${index % g.size + 1} 列，${value || '空位'}`);
    cell.dataset.index = index;
    if (g.pending && !value) cell.classList.add('placeable');
    if (selection.includes(index)) cell.classList.add('picked');
    if (value) {
      const tile = document.createElement('span');
      tile.className = `tile size-${g.size} ${tileClass(value)}${spawned?.index === index ? ' appeared' : ''}${state.settings.mergeBounce && merges.some(m => m.index === index) ? ' merged' : ''}`;
      tile.textContent = value;
      if (value >= 1024) tile.classList.add('small-text');
      cell.append(tile);
    }
    board.append(cell);
  });
}
function renderOverlay() {
  const overlay = $('overlay'), g = game();
  overlay.classList.add('hidden'); overlay.innerHTML = '';
  if (g.pending) {
    overlay.classList.remove('hidden', 'blocking');
    overlay.innerHTML = `<div class="mini-banner">下一块是 <strong>${g.pending.value}</strong> · 点选生成空位</div>`;
  } else if (g.over) {
    overlay.classList.remove('hidden'); overlay.classList.add('blocking');
    const canContinue = !isPure() && state.profile.inventory.continue > 0 && canUse(g, 'continue');
    overlay.innerHTML = `<div class="end-card"><span>这局辛苦啦</span><h2>没有可移动的方块</h2><p>本局得分 ${g.score}</p>${canContinue ? '<button id="continueGame" type="button">使用失败续局</button>' : ''}<button id="restartGame" type="button" class="secondary">开始新游戏</button></div>`;
    $('continueGame')?.addEventListener('click', () => activate('continue'));
    $('restartGame').addEventListener('click', requestNewGame);
  } else if (wonNotice) {
    overlay.classList.remove('hidden'); overlay.classList.add('blocking');
    overlay.innerHTML = '<div class="end-card"><span>太棒了！</span><h2>合成 2048</h2><p>还可以继续挑战更大的方块。</p><button id="keepPlaying" type="button">继续游戏</button></div>';
    $('keepPlaying').addEventListener('click', () => { wonNotice = false; renderOverlay(); });
  }
}
function render(spawned, merges = []) {
  const g = game(), current = session(), profile = current.profile;
  document.body.dataset.skin = isPure() ? 'cream' : state.profile.selectedSkin;
  document.body.dataset.mode = state.mode;
  const journeyTabs = document.querySelector('.journey-tabs');
  journeyTabs.classList.toggle('single', isPure());
  $('themesTab').hidden = isPure();
  if (isPure() && journeyTabs.dataset.active === 'themes') setJourneyTab('achievements');
  $('modeSwitch').setAttribute('aria-pressed', String(isPure()));
  $('modeSwitch').setAttribute('aria-label', isPure() ? '返回普通模式' : '进入纯净模式');
  $('modeSwitchLabel').textContent = isPure() ? '纯净模式' : '普通模式';
  $('modeSubtitle').textContent = isPure() ? '只留下数字与滑动' : '轻轻滑动，慢慢变大';
  $('journeyCaption').textContent = isPure() ? '纯净模式的分数和成就独立保存在本机。' : '你的进度保存在本机。';
  $('itemsButton').hidden = isPure();
  $('pureInfo').hidden = !isPure();
  $('journeyDescription').textContent = isPure() ? '纯净成就' : '成就与主题';
  $('mergeBounce').checked = state.settings.mergeBounce;
  document.querySelectorAll('[data-size]').forEach(button => { button.classList.toggle('active', Number(button.dataset.size) === current.activeSize); button.setAttribute('aria-pressed', String(Number(button.dataset.size) === current.activeSize)); });
  $('score').textContent = g.score.toLocaleString(); $('best').textContent = current.best[current.activeSize].toLocaleString();
  $('totalMerges').textContent = profile.totalMerges.toLocaleString(); $('maxTile').textContent = profile.maxTile.toLocaleString();
  $('achievementMergeCount').textContent = profile.totalMerges.toLocaleString();
  renderBoard(spawned, merges); renderOverlay();
  $('items').innerHTML = '';
  ITEM_ORDER.forEach(item => {
    const button = document.createElement('button');
    button.type = 'button'; button.className = `item${selectedItem === item ? ' active' : ''}`;
    const remaining = itemLimit(g, item) - g.uses[item], inventory = state.profile.inventory[item] || 0;
    button.disabled = isPure() || !inventory || !canUse(g, item) || busy;
    button.innerHTML = `<span class="item-icon">${ITEM_ICONS[item]}</span><span class="item-name">${ITEM_NAMES[item]}</span><span class="item-count">库存 ${inventory} · 本局 ${remaining}</span>`;
    button.addEventListener('click', () => activate(item)); $('items').append(button);
  });
  $('achievements').innerHTML = '';
  ACHIEVEMENTS.forEach(a => {
    const unlocked = profile.achievements.includes(a.id);
    const card = document.createElement('div'); card.className = `achievement-card tier-${a.tier}${a.tile ? ` tile-achievement luxury-${a.luxury}` : ''}${unlocked ? ' unlocked' : ' locked'}`;
    const goal = a.count ? `${a.count.toLocaleString()} 次` : `${a.tile.toLocaleString()}`;
    const tileCount = a.tile ? profile.tileMergeCounts[a.tile] || 0 : 0;
    const approximate = a.tile && profile.approximateTiles.includes(a.tile);
    const detail = a.tile ? (tileCount ? `${approximate ? '至少' : '已合成'} ${tileCount.toLocaleString()} 次` : '尚未合成') : unlocked ? '已达成' : `进度 ${Math.min(profile.totalMerges, a.count).toLocaleString()} / ${a.count.toLocaleString()}`;
    card.setAttribute('aria-label', `${a.label}，${a.count ? '累计合成' : '合成方块'} ${goal}，${detail}`);
    card.innerHTML = `<span class="achievement-icon" aria-hidden="true">${a.icon}</span><span class="achievement-goal">${goal}</span><strong class="achievement-name">${a.label}</strong><small class="achievement-detail">${detail}</small>`;
    $('achievements').append(card);
  });
  $('starterSkins').innerHTML = ''; $('challengeSkins').innerHTML = '';
  SKINS.forEach(s => {
    const unlocked = state.profile.unlockedSkins.includes(s.id), button = document.createElement('button');
    button.type = 'button'; button.disabled = !unlocked; button.className = `skin skin-${s.id}${state.profile.selectedSkin === s.id ? ' active' : ''}`;
    button.innerHTML = `<span class="swatch"></span><strong>${s.name}</strong><small>${unlocked ? (state.profile.selectedSkin === s.id ? '使用中' : '点击使用') : s.requirement}</small>`;
    button.addEventListener('click', () => { state.profile.selectedSkin = s.id; persist(); render(); });
    $(s.starter ? 'starterSkins' : 'challengeSkins').append(button);
  });
}
function finish(result, previous, animate = false) {
  const before2048 = previous.reached2048;
  setGame(result.game);
  const current = session();
  const progress = applyProgress(current.profile, result.merges || [], result.undoneMerges || 0, isPure() ? { grantRewards: false, unlockSkins: false } : {});
  current.profile = progress.profile;
  current.best[current.activeSize] = Math.max(current.best[current.activeSize], result.game.score);
  selectedItem = null; selection = [];
  if (!before2048 && result.game.reached2048) wonNotice = true;
  persist();
  const notice = progress.rewards.length ? `获得 ${progress.rewards.map(i => ITEM_NAMES[i]).join('、')}！` : result.game.pending ? `下一块是 ${result.game.pending.value}，请点选空位。` : result.game.over ? (isPure() ? '棋盘已满，可以开始新游戏。' : '棋盘已满，试试失败续局。') : `+${result.game.score - previous.score} 分`;
  if (animate && result.motions?.length) animateMove(previous, result, () => { render(result.spawned, result.merges); say(notice); });
  else { render(result.spawned, result.merges); say(notice); }
}
function animateMove(previous, result, done) {
  const board = $('board'), cells = [...board.children], boardRect = board.getBoundingClientRect();
  const layer = document.createElement('div'); layer.className = 'motion-layer'; board.parentElement.append(layer);
  for (const motion of result.motions) {
    const source = cells[motion.from].getBoundingClientRect(), target = cells[motion.to].getBoundingClientRect();
    const tile = document.createElement('span'); tile.className = `tile size-${previous.size}${motion.value >= 1024 ? ' small-text' : ''} moving ${tileClass(motion.value)}`;
    tile.textContent = motion.value; tile.style.left = `${source.left - boardRect.left + board.offsetLeft}px`; tile.style.top = `${source.top - boardRect.top + board.offsetTop}px`;
    tile.style.width = `${source.width}px`; tile.style.height = `${source.height}px`;
    layer.append(tile);
    requestAnimationFrame(() => { tile.style.transform = `translate(${target.left - source.left}px, ${target.top - source.top}px)`; });
  }
  board.classList.add('during-motion'); busy = true;
  setTimeout(() => { layer.remove(); board.classList.remove('during-motion'); busy = false; done(); }, 190);
}
function attemptMove(direction) {
  if (busy || modeSwitching || game().pending || wonNotice) return;
  const previous = game(), result = move(previous, direction);
  if (result.changed) finish(result, previous, true);
}
function activate(item) {
  const g = game();
  if (isPure() || busy || modeSwitching || !state.profile.inventory[item] || !canUse(g, item)) return;
  if (['clear', 'swap', 'merge'].includes(item)) {
    selectedItem = selectedItem === item ? null : item; selection = [];
    render(); closeDrawers(); say(selectedItem ? (item === 'clear' ? '点选要清除的方块。' : '依次点选两个方块。') : '已取消选择。');
    return;
  }
  try { consume(item, useItem(g, item)); closeDrawers(); } catch (error) { say(error.message); }
}
function consume(item, result) {
  const previous = game(); state.profile.inventory[item]--;
  finish(result, previous);
}
function selectCell(index) {
  if (busy || modeSwitching) return;
  const g = game();
  if (g.pending) {
    try { setGame(placePreview(g, index)); persist(); render(); say('预知方块已落下。'); } catch (error) { say(error.message); }
    return;
  }
  if (!selectedItem) return;
  if (!g.board[index]) { say('请选择有数字的方块。'); return; }
  if (selection.includes(index)) { selection = selection.filter(i => i !== index); renderBoard(); return; }
  selection.push(index);
  const needed = selectedItem === 'clear' ? 1 : 2;
  if (selection.length < needed) { renderBoard(); return; }
  try { consume(selectedItem, useItem(g, selectedItem, selection)); }
  catch (error) { selection = []; renderBoard(); say(error.message); }
}
function startNew() {
  if (busy || modeSwitching) return;
  setGame(newGame(session().activeSize)); selectedItem = null; selection = []; wonNotice = false;
  persist(); render(); say('新棋局开始，祝你玩得开心。');
}
function requestNewGame() {
  if (busy || modeSwitching || $('newGameDialog').open) return;
  $('newGameMessage').textContent = `当前 ${session().activeSize} × ${session().activeSize} 棋局和分数将重置，最高分与成就会保留。`;
  $('newGameDialog').showModal();
}
document.querySelectorAll('[data-size]').forEach(button => button.addEventListener('click', () => {
  if (busy || modeSwitching) return; session().activeSize = Number(button.dataset.size); selectedItem = null; selection = []; wonNotice = false; persist(); render(); say(`已切换到 ${session().activeSize} × ${session().activeSize} 棋盘。`);
}));
async function switchMode() {
  if (busy || modeSwitching || $('newGameDialog').open) return;
  modeSwitching = true; closeDrawers();
  const target = isPure() ? 'normal' : 'pure';
  const button = $('modeSwitch'), rect = button.getBoundingClientRect();
  const x = rect.left + rect.width / 2, y = rect.top + rect.height / 2;
  const radius = Math.ceil(Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y)));
  const applyMode = () => {
    state.mode = target; selectedItem = null; selection = []; wonNotice = false;
    persist(); render(); say(isPure() ? '已进入纯净模式' : '已返回普通模式。');
  };
  try {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { applyMode(); return; }
    if (document.startViewTransition) {
      document.documentElement.style.setProperty('--mode-x', `${x}px`);
      document.documentElement.style.setProperty('--mode-y', `${y}px`);
      document.documentElement.style.setProperty('--mode-radius', `${radius}px`);
      await document.startViewTransition(applyMode).finished;
    } else {
      const reveal = document.createElement('div'); reveal.className = `mode-reveal to-${target}`;
      reveal.style.setProperty('--ripple-x', `${x}px`); reveal.style.setProperty('--ripple-y', `${y}px`);
      document.body.append(reveal);
      try {
        await reveal.animate([{ clipPath: `circle(0px at ${x}px ${y}px)`, opacity: 0 }, { clipPath: `circle(${radius}px at ${x}px ${y}px)`, opacity: .72 }], { duration: 560, easing: 'cubic-bezier(.2,.72,.25,1)', fill: 'forwards' }).finished;
        applyMode();
        await reveal.animate([{ opacity: .72 }, { opacity: 0 }], { duration: 260, easing: 'ease-out', fill: 'forwards' }).finished;
      } finally { reveal.remove(); }
    }
  } finally { modeSwitching = false; }
}
$('modeSwitch').addEventListener('click', switchMode);
$('newGame').addEventListener('click', requestNewGame);
$('confirmNewGame').addEventListener('click', () => { $('newGameDialog').close(); startNew(); });
$('mergeBounce').addEventListener('change', event => { state.settings.mergeBounce = event.target.checked; persist(); say(`Q 弹合成动效已${event.target.checked ? '开启' : '关闭'}。`); });
$('helpButton').addEventListener('click', () => $('helpDialog').showModal());
$('itemsButton').addEventListener('click', () => { if (!isPure()) $('itemsDrawer').showModal(); });
$('journeyButton').addEventListener('click', () => $('journeyDrawer').showModal());
function setJourneyTab(tab) {
  if (isPure()) tab = 'achievements';
  const achievements = tab === 'achievements';
  $('achievementPanel').hidden = !achievements;
  $('themePanel').hidden = isPure() || achievements;
  $('themesTab').hidden = isPure();
  $('achievementsTab').setAttribute('aria-selected', String(achievements));
  $('themesTab').setAttribute('aria-selected', String(!achievements));
  document.querySelector('.journey-tabs').dataset.active = tab;
  document.querySelector('.journey-scroll').scrollTop = 0;
}
$('achievementsTab').addEventListener('click', () => setJourneyTab('achievements'));
$('themesTab').addEventListener('click', () => setJourneyTab('themes'));
document.querySelectorAll('.drawer').forEach(drawer => {
  drawer.querySelector('.drawer-close').addEventListener('click', () => drawer.close());
  drawer.addEventListener('click', event => { if (event.target === drawer) drawer.close(); });
  drawer.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button > 0 || event.target.closest('button')) return;
    if (!event.target.closest('.drawer-handle, .drawer .section-heading')) return;
    event.preventDefault();
    drawer._dismissDrag = { pointerId: event.pointerId, startY: event.clientY, lastY: event.clientY, lastAt: performance.now(), velocity: 0 };
    try { drawer.setPointerCapture(event.pointerId); } catch { /* Keep the gesture usable if capture is unavailable. */ }
  });
  drawer.addEventListener('pointermove', event => {
    const drag = drawer._dismissDrag;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const now = performance.now(), elapsed = Math.max(1, now - drag.lastAt);
    drag.velocity = (event.clientY - drag.lastY) / elapsed;
    drag.lastY = event.clientY; drag.lastAt = now;
    const offset = Math.max(0, event.clientY - drag.startY);
    drawer.style.setProperty('--drawer-drag-y', `${offset}px`);
    drawer.classList.add('is-dragging');
  });
  drawer.addEventListener('pointerup', event => {
    const drag = drawer._dismissDrag;
    if (!drag || drag.pointerId !== event.pointerId) return;
    drawer._dismissDrag = null;
    const offset = Math.max(0, event.clientY - drag.startY);
    if (offset > 84 || (offset > 28 && drag.velocity > 0.65)) {
      drawer.classList.remove('is-dragging');
      drawer.classList.add('is-dismissing');
      window.setTimeout(() => { if (drawer.open) drawer.close(); }, 230);
    } else {
      drawer.classList.remove('is-dragging');
      drawer.style.removeProperty('--drawer-drag-y');
    }
  });
  drawer.addEventListener('pointercancel', () => {
    drawer._dismissDrag = null;
    drawer.classList.remove('is-dragging');
    drawer.style.removeProperty('--drawer-drag-y');
  });
  drawer.addEventListener('close', () => {
    drawer.classList.remove('is-dragging', 'is-dismissing');
    drawer.style.removeProperty('--drawer-drag-y');
  });
});
$('board').addEventListener('click', event => { const cell = event.target.closest('.cell'); if (cell) selectCell(Number(cell.dataset.index)); });
window.addEventListener('keydown', event => {
  if ($('helpDialog').open || $('newGameDialog').open || document.querySelector('.drawer[open]')) return;
  const directions = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
  if (directions[event.key]) { event.preventDefault(); attemptMove(directions[event.key]); }
});
let touchStart = null;
$('board').addEventListener('pointerdown', event => { touchStart = { x: event.clientX, y: event.clientY }; });
$('board').addEventListener('pointerup', event => {
  if (!touchStart) return;
  const dx = event.clientX - touchStart.x, dy = event.clientY - touchStart.y; touchStart = null;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 28) return;
  attemptMove(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
});
render();
