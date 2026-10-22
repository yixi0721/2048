export const ITEM_LIMITS = Object.freeze({ undo: 3, clear: 3, shuffle: 1, continue: 1, swap: 1, merge: 1, foresight: 2 });
export const ITEM_NAMES = Object.freeze({ undo: '撤销一步', clear: '清除方块', shuffle: '规则重排', continue: '失败续局', swap: '交换方块', merge: '定点合成', foresight: '预知下一块' });
export const ITEM_ICONS = Object.freeze({ undo: '↶', clear: '✦', shuffle: '⤨', continue: '♡', swap: '⇄', merge: '＋', foresight: '◉' });
export const ITEM_ORDER = Object.keys(ITEM_LIMITS);
export const emptyBoard = size => Array(size * size).fill(0);
export const nextValue = rng => rng() < 0.9 ? 2 : 4;
export const emptyIndices = board => board.flatMap((v, i) => v === 0 ? [i] : []);
export function spawn(board, rng = Math.random, value = nextValue(rng), position) {
  const empty = emptyIndices(board);
  if (!empty.length) return null;
  const index = position === undefined ? empty[Math.min(empty.length - 1, Math.floor(rng() * empty.length))] : position;
  if (!empty.includes(index)) throw new Error('生成位置必须为空');
  board[index] = value;
  return { index, value };
}
export function newGame(size, rng = Math.random) {
  if (size !== 4 && size !== 5) throw new Error('棋盘尺寸必须是 4 或 5');
  const board = emptyBoard(size);
  spawn(board, rng); spawn(board, rng);
  return { size, board, score: 0, uses: Object.fromEntries(ITEM_ORDER.map(k => [k, 0])), clearBonus: 0, peakTile: Math.max(...board), undo: null, pending: null, over: false, reached2048: false };
}
export const itemLimit = (game, item) => ITEM_LIMITS[item] + (item === 'clear' ? (game.clearBonus || 0) : 0);
function peakProgress(game, merges) {
  const previous = game.peakTile ?? Math.max(...game.board);
  const newPeaks = [...new Set(merges.map(m => m.value).filter(value => value >= 128 && value > previous))];
  return { peakTile: Math.max(previous, ...merges.map(m => m.value)), clearBonus: (game.clearBonus || 0) + newPeaks.length };
}
export function hasMoves(board, size) {
  if (board.includes(0)) return true;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = y * size + x;
    if (x + 1 < size && board[i] === board[i + 1]) return true;
    if (y + 1 < size && board[i] === board[i + size]) return true;
  }
  return false;
}
function lines(size, direction) {
  const output = [];
  for (let n = 0; n < size; n++) {
    const line = [];
    for (let p = 0; p < size; p++) {
      const x = direction === 'left' ? p : direction === 'right' ? size - 1 - p : n;
      const y = direction === 'up' ? p : direction === 'down' ? size - 1 - p : n;
      line.push(y * size + x);
    }
    output.push(line);
  }
  return output;
}
export function move(game, direction, rng = Math.random) {
  if (!['left', 'right', 'up', 'down'].includes(direction)) throw new Error('无效方向');
  if (game.pending || game.over) return { game, changed: false, merges: [], motions: [], spawned: null };
  const board = emptyBoard(game.size), merges = [], motions = [];
  for (const line of lines(game.size, direction)) {
    const tiles = line.filter(i => game.board[i]).map(i => ({ index: i, value: game.board[i] }));
    let target = 0;
    for (let i = 0; i < tiles.length; i++) {
      const first = tiles[i], second = tiles[i + 1];
      const destination = line[target++];
      if (second && first.value === second.value) {
        board[destination] = first.value * 2;
        merges.push({ index: destination, value: first.value * 2 });
        motions.push({ from: first.index, to: destination, value: first.value }, { from: second.index, to: destination, value: second.value });
        i++;
      } else {
        board[destination] = first.value;
        motions.push({ from: first.index, to: destination, value: first.value });
      }
    }
  }
  if (board.every((v, i) => v === game.board[i])) return { game, changed: false, merges: [], motions: [], spawned: null };
  const score = game.score + merges.reduce((sum, m) => sum + m.value, 0);
  const undo = { board: [...game.board], score: game.score, reached2048: game.reached2048, mergeCount: merges.length };
  let spawned = null, pending = null;
  if (game.previewValue) pending = { value: game.previewValue };
  else spawned = spawn(board, rng);
  const reached2048 = game.reached2048 || merges.some(m => m.value >= 2048);
  return { game: { ...game, ...peakProgress(game, merges), board, score, undo, pending, previewValue: null, over: !pending && !hasMoves(board, game.size), reached2048 }, changed: true, merges, motions, spawned };
}
export function placePreview(game, index) {
  if (!game.pending || game.board[index] !== 0) throw new Error('请选择空位');
  const board = [...game.board]; board[index] = game.pending.value;
  return { ...game, board, pending: null, over: !hasMoves(board, game.size) };
}
export function canUse(game, item) {
  if (!ITEM_ORDER.includes(item) || game.uses[item] >= itemLimit(game, item) || game.pending) return false;
  if (item === 'undo') return Boolean(game.undo);
  if (item === 'continue') return game.over;
  if (game.over) return false;
  if (item === 'clear') return game.board.some(Boolean);
  if (item === 'shuffle') return game.board.some(Boolean);
  if (item === 'swap') return game.board.filter(Boolean).length >= 2;
  if (item === 'merge') return findMergePairs(game).length > 0;
  if (item === 'foresight') return !game.previewValue;
  return false;
}
export function findMergePairs(game) {
  const pairs = [];
  game.board.forEach((value, index) => {
    if (!value) return;
    const x = index % game.size, y = Math.floor(index / game.size);
    if (x + 1 < game.size && game.board[index + 1] === value) pairs.push([index, index + 1]);
    if (y + 1 < game.size && game.board[index + game.size] === value) pairs.push([index, index + game.size]);
  });
  return pairs;
}
function used(game, item, patch) {
  return { ...game, ...patch, uses: { ...game.uses, [item]: game.uses[item] + 1 } };
}
export function useItem(game, item, selection = [], rng = Math.random) {
  if (!canUse(game, item)) throw new Error('此时无法使用道具');
  const board = [...game.board];
  if (item === 'undo') {
    const previous = game.undo;
    return { game: used(game, item, { board: previous.board, score: previous.score, reached2048: previous.reached2048, undo: null, over: false, previewValue: null }), merges: [], undoneMerges: previous.mergeCount };
  }
  if (item === 'continue') {
    const largest = Math.max(...board);
    for (let i = 0; i < board.length; i++) {
      if (board[i] !== largest) board[i] = board[i] <= 2 ? 0 : board[i] / 2;
    }
    return { game: used(game, item, { board, over: false, undo: null }), merges: [] };
  }
  if (item === 'foresight') return { game: used(game, item, { previewValue: nextValue(rng), undo: null }), merges: [] };
  if (item === 'shuffle') {
    const values = board.filter(Boolean).sort((a, b) => a - b);
    board.fill(0);
    // 固定规则：按数值从小到大均匀分布，最小在左上、最大在右下，空位留在中间。
    values.forEach((value, i) => {
      const index = values.length === 1 ? board.length - 1 : Math.round(i * (board.length - 1) / (values.length - 1));
      board[index] = value;
    });
    return { game: used(game, item, { board, undo: null, over: !hasMoves(board, game.size) }), merges: [] };
  }
  const [a, b] = selection;
  if (!Number.isInteger(a) || a < 0 || a >= board.length || !board[a]) throw new Error('请选择有数字的方块');
  if (item === 'clear') board[a] = 0;
  if (item === 'swap') {
    if (!Number.isInteger(b) || b === a || !board[b]) throw new Error('请选择另一个有数字的方块');
    [board[a], board[b]] = [board[b], board[a]];
  }
  let merges = [];
  if (item === 'merge') {
    if (!findMergePairs(game).some(pair => pair.includes(a) && pair.includes(b))) throw new Error('请选择相邻且相同的方块');
    board[a] *= 2; board[b] = 0;
    merges = [{ index: a, value: board[a] }];
  }
  const score = game.score + merges.reduce((sum, m) => sum + m.value, 0);
  return { game: used(game, item, { ...peakProgress(game, merges), board, score, undo: null, over: !hasMoves(board, game.size), reached2048: game.reached2048 || merges.some(m => m.value >= 2048) }), merges };
}
