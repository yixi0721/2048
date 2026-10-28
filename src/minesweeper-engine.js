export const LEVELS = { easy: { rows: 9, cols: 9, mines: 10 }, medium: { rows: 12, cols: 12, mines: 24 }, hard: { rows: 16, cols: 16, mines: 48 } };

export function neighbors(index, rows, cols) {
  const row = Math.floor(index / cols), col = index % cols, result = [];
  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
    const r = row + dr, c = col + dc;
    if ((dr || dc) && r >= 0 && r < rows && c >= 0 && c < cols) result.push(r * cols + c);
  }
  return result;
}

export function createGame(level = 'easy') {
  const config = LEVELS[level];
  if (!config) throw new Error('未知难度');
  return { ...config, level, cells: Array.from({ length: config.rows * config.cols }, () => ({ mine: false, count: 0, revealed: false, flagged: false })), started: false, status: 'playing', flags: 0 };
}

function plant(game, first, random) {
  const safe = new Set([first, ...neighbors(first, game.rows, game.cols)]);
  const candidates = game.cells.map((_, i) => i).filter(i => !safe.has(i));
  for (let i = 0; i < game.mines; i++) {
    const pick = i + Math.floor(random() * (candidates.length - i));
    [candidates[i], candidates[pick]] = [candidates[pick], candidates[i]];
    game.cells[candidates[i]].mine = true;
  }
  game.cells.forEach((cell, i) => { if (!cell.mine) cell.count = neighbors(i, game.rows, game.cols).filter(n => game.cells[n].mine).length; });
  game.started = true;
}

export function reveal(game, index, random = Math.random) {
  if (game.status !== 'playing' || !game.cells[index] || game.cells[index].flagged || game.cells[index].revealed) return game;
  if (!game.started) plant(game, index, random);
  const cell = game.cells[index];
  if (cell.mine) {
    cell.revealed = true; game.status = 'lost';
    game.cells.forEach(c => { if (c.mine) c.revealed = true; });
    return game;
  }
  const queue = [index];
  while (queue.length) {
    const at = queue.pop(), current = game.cells[at];
    if (current.revealed || current.flagged) continue;
    current.revealed = true;
    if (!current.count) queue.push(...neighbors(at, game.rows, game.cols).filter(n => !game.cells[n].revealed && !game.cells[n].mine));
  }
  if (game.cells.every(c => c.mine || c.revealed)) game.status = 'won';
  return game;
}

export function toggleFlag(game, index) {
  const cell = game.cells[index];
  if (game.status !== 'playing' || !cell || cell.revealed) return game;
  cell.flagged = !cell.flagged;
  game.flags += cell.flagged ? 1 : -1;
  return game;
}
