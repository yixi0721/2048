import { createGame, reveal, toggleFlag } from './minesweeper-engine.js';

const $ = id => document.getElementById(id);
const RECORD_KEY = 'minesweeper-best-times-v1';
const formatTime = value => `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`;
function loadRecords() {
  try {
    const stored = JSON.parse(localStorage.getItem(RECORD_KEY) || '{}');
    return Object.fromEntries(['easy', 'medium', 'hard'].filter(level => Number.isInteger(stored[level]) && stored[level] >= 0).map(level => [level, stored[level]]));
  } catch { return {}; }
}
const bestTimes = loadRecords();
let game = createGame(), seconds = 0, timer = null, flagMode = false, pressTimer = null, longPressed = false;
let pressOrigin = null, lastTouchFlagAt = 0;
let zoomEnabled = false, zoom = 1.6, panX = 0, panY = 0, drag = null, suppressClick = false;
const pointers = new Map();
let pinch = null;
let shownEnd = null, endDismissed = false;
const frame = $('mineBoard').parentElement;
function updateZoom() {
  const available = game.level !== 'easy';
  if (!available) zoomEnabled = false;
  $('mineZoomControls').hidden = !available;
  $('mineZoomSteps').hidden = !zoomEnabled;
  $('mineZoomToggle').setAttribute('aria-pressed', String(zoomEnabled));
  $('mineZoomToggle').classList.toggle('active', zoomEnabled);
  $('mineZoomValue').textContent = `${Math.round(zoom * 100)}%`;
  $('mineZoomOut').disabled = zoom <= 1.01;
  $('mineZoomIn').disabled = zoom >= 2.49;
  frame.classList.toggle('zoomed', zoomEnabled);
  const size = Math.max(0, frame.clientWidth - 16), limit = size * (zoom - 1);
  panX = Math.max(-limit, Math.min(0, panX));
  panY = Math.max(-limit, Math.min(0, panY));
  $('mineBoard').style.transform = zoomEnabled ? `translate(${panX}px, ${panY}px) scale(${zoom})` : '';
}
const stopTimer = () => { clearInterval(timer); timer = null; };
function startTimer() { if (!timer) timer = setInterval(() => { seconds++; $('mineTime').textContent = seconds; }, 1000); }
function render() {
  $('mineBoard').style.setProperty('--cols', game.cols);
  $('mineBoard').innerHTML = '';
  game.cells.forEach((cell, index) => {
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'mine-cell'; button.dataset.index = index;
    if (cell.revealed) button.classList.add('revealed');
    if (cell.mine && cell.revealed) button.classList.add('mine-hit');
    if (cell.count && cell.revealed) button.dataset.number = cell.count;
    button.textContent = cell.revealed ? (cell.mine ? '✹' : cell.count || '') : (cell.flagged ? '⚑' : '');
    button.setAttribute('aria-label', `${Math.floor(index / game.cols) + 1} 行 ${index % game.cols + 1} 列，${cell.revealed ? cell.mine ? '地雷' : cell.count || '空格' : cell.flagged ? '旗帜' : '未打开'}`);
    $('mineBoard').append(button);
  });
  $('mineRemaining').textContent = game.mines - game.flags;
  $('mineBest').textContent = bestTimes[game.level] === undefined ? '—' : formatTime(bestTimes[game.level]);
  $('mineStatus').textContent = game.status === 'won' ? '完成！' : game.status === 'lost' ? '踩到地雷了' : game.started ? '' : '点击格子开始';
  document.querySelectorAll('[data-level]').forEach(b => { b.classList.toggle('active', b.dataset.level === game.level); b.setAttribute('aria-pressed', String(b.dataset.level === game.level)); });
  $('flagMode').classList.toggle('active', flagMode);
  $('flagMode').setAttribute('aria-pressed', String(flagMode));
  const ended = game.status !== 'playing';
  $('mineEnd').hidden = !ended || endDismissed;
  if (ended && shownEnd !== game.status) {
    shownEnd = game.status;
    $('mineEnd').className = `mine-end ${game.status}`;
    $('mineEndIcon').textContent = game.status === 'won' ? '✦' : '✹';
    $('mineEndTitle').textContent = game.status === 'won' ? '挑战成功' : '踩到地雷';
    $('mineEndTime').textContent = `用时 ${formatTime(seconds)}`;
  }
  updateZoom();
}
function reset(level = game.level) { stopTimer(); seconds = 0; $('mineTime').textContent = '0'; game = createGame(level); shownEnd = null; endDismissed = false; zoomEnabled = false; zoom = 1.6; panX = panY = 0; pointers.clear(); pinch = drag = null; render(); }
function act(index, flag) {
  const previousStatus = game.status;
  if (flag) toggleFlag(game, index);
  else { const wasStarted = game.started; reveal(game, index); if (!wasStarted && game.started && game.status === 'playing') startTimer(); }
  if (game.status !== 'playing') stopTimer();
  if (previousStatus === 'playing' && game.status === 'won' && (bestTimes[game.level] === undefined || seconds < bestTimes[game.level])) {
    bestTimes[game.level] = seconds;
    try { localStorage.setItem(RECORD_KEY, JSON.stringify(bestTimes)); } catch { /* Current result remains visible if storage is unavailable. */ }
  }
  render();
}
$('mineBoard').addEventListener('contextmenu', event => {
  const cell = event.target.closest('.mine-cell');
  if (!cell) return;
  event.preventDefault();
  if (event.pointerType === 'touch' || Date.now() - lastTouchFlagAt < 900) return;
  act(Number(cell.dataset.index), true);
});
$('mineBoard').addEventListener('pointerdown', event => {
  if (event.pointerType === 'mouse') return;
  if (zoomEnabled && pointers.size) { clearTimeout(pressTimer); pressOrigin = null; return; }
  const cell = event.target.closest('.mine-cell'); if (!cell) return;
  longPressed = false;
  pressOrigin = { id: event.pointerId, x: event.clientX, y: event.clientY, index: Number(cell.dataset.index) };
  clearTimeout(pressTimer);
  pressTimer = setTimeout(() => {
    if (!pressOrigin || pressOrigin.id !== event.pointerId) return;
    longPressed = true;
    lastTouchFlagAt = Date.now();
    act(pressOrigin.index, true);
    navigator.vibrate?.(25);
    pressOrigin = null;
  }, 520);
});
$('mineBoard').addEventListener('pointermove', event => { if (pressOrigin?.id === event.pointerId && Math.hypot(event.clientX - pressOrigin.x, event.clientY - pressOrigin.y) > 12) { clearTimeout(pressTimer); pressOrigin = null; } });
for (const type of ['pointerup', 'pointercancel', 'pointerleave']) $('mineBoard').addEventListener(type, () => { clearTimeout(pressTimer); pressOrigin = null; });
$('mineBoard').addEventListener('click', event => { const cell = event.target.closest('.mine-cell'); if (!cell) return; if (suppressClick) { suppressClick = false; return; } if (longPressed || Date.now() - lastTouchFlagAt < 700) { longPressed = false; return; } act(Number(cell.dataset.index), flagMode); });
$('mineZoomToggle').addEventListener('click', () => { zoomEnabled = !zoomEnabled; pointers.clear(); pinch = drag = null; if (zoomEnabled) { const offset = (frame.clientWidth - 16) * (zoom - 1) / 2; panX = panY = -offset; } updateZoom(); });
function changeZoom(delta) { const old = zoom; zoom = Math.max(1, Math.min(2.5, Math.round((zoom + delta) * 10) / 10)); const center = (frame.clientWidth - 16) / 2; panX = center - (center - panX) * zoom / old; panY = center - (center - panY) * zoom / old; updateZoom(); }
$('mineZoomOut').addEventListener('click', () => changeZoom(-0.2));
$('mineZoomIn').addEventListener('click', () => changeZoom(0.2));
function pair() {
  const [a, b] = [...pointers.values()];
  const rect = frame.getBoundingClientRect();
  return { x: (a.x + b.x) / 2 - rect.left - 8, y: (a.y + b.y) / 2 - rect.top - 8, distance: Math.hypot(a.x - b.x, a.y - b.y) };
}
frame.addEventListener('pointerdown', event => {
  if (!zoomEnabled || event.button !== 0) return;
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  if (pointers.size === 1) drag = { id: event.pointerId, x: event.clientX, y: event.clientY, panX, panY, moved: false };
  if (pointers.size === 2) {
    clearTimeout(pressTimer);
    drag = null;
    const point = pair();
    pinch = { distance: Math.max(1, point.distance), zoom, contentX: (point.x - panX) / zoom, contentY: (point.y - panY) / zoom };
    for (const id of pointers.keys()) try { frame.setPointerCapture(id); } catch { /* Pointer may already have ended. */ }
  }
});
frame.addEventListener('pointermove', event => {
  if (!pointers.has(event.pointerId)) return;
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  if (pinch && pointers.size >= 2) {
    const point = pair();
    zoom = Math.max(1, Math.min(2.5, pinch.zoom * point.distance / pinch.distance));
    panX = point.x - pinch.contentX * zoom;
    panY = point.y - pinch.contentY * zoom;
    updateZoom();
    return;
  }
  if (!drag || event.pointerId !== drag.id) return;
  const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
  if (Math.hypot(dx, dy) > 6) {
    if (!drag.moved) frame.setPointerCapture(event.pointerId);
    drag.moved = true;
    clearTimeout(pressTimer);
    panX = drag.panX + dx; panY = drag.panY + dy; updateZoom();
  }
});
function endPointer(event) {
  if (!pointers.has(event.pointerId)) return;
  const used = !!pinch || !!drag?.moved;
  pointers.delete(event.pointerId);
  if (used) { suppressClick = true; setTimeout(() => { suppressClick = false; }, 350); }
  if (pinch && pointers.size < 2) {
    pinch = null;
    const [id, point] = pointers.entries().next().value || [];
    drag = id === undefined ? null : { id, x: point.x, y: point.y, panX, panY, moved: true };
  } else if (drag?.id === event.pointerId) drag = null;
  if (!pointers.size) { pinch = null; drag = null; }
}
frame.addEventListener('pointerup', endPointer);
frame.addEventListener('pointercancel', endPointer);
window.addEventListener('resize', updateZoom);
document.querySelectorAll('[data-level]').forEach(b => b.addEventListener('click', () => reset(b.dataset.level)));
$('mineReset').addEventListener('click', () => $('mineResetDialog').showModal());
$('confirmMineReset').addEventListener('click', () => { $('mineResetDialog').close(); reset(); });
$('mineEndClose').addEventListener('click', () => { endDismissed = true; $('mineEnd').hidden = true; });
$('mineEndRestart').addEventListener('click', () => {
  if (game.status === 'lost') reset();
  else $('mineResetDialog').showModal();
});
$('flagMode').addEventListener('click', () => { flagMode = !flagMode; render(); });
$('mineHelp').addEventListener('click', () => $('mineHelpDialog').showModal());
render();
