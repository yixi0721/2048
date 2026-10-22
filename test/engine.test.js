import test from 'node:test';
import assert from 'node:assert/strict';
import { ITEM_LIMITS, findMergePairs, hasMoves, itemLimit, move, newGame, placePreview, useItem } from '../src/engine.js';
import { ACHIEVEMENTS, INVENTORY_CAP, SKINS, STARTER_SKINS, applyProgress, initialProfile, initialSave, loadSave, save } from '../src/progression.js';

const gameWith = (board, size = 4) => ({ ...newGame(size, () => 0), board, peakTile: Math.max(...board), score: 0 });
test('两个棋盘分别为 4×4 和 5×5，开局各有两个数字', () => {
  for (const size of [4, 5]) {
    const game = newGame(size, () => 0);
    assert.equal(game.board.length, size * size);
    assert.equal(game.board.filter(Boolean).length, 2);
  }
});
test('滑动时每个方块每步只合成一次，分数正确', () => {
  const game = gameWith([2, 2, 2, 2, ...Array(12).fill(0)]);
  const result = move(game, 'left', () => 0);
  assert.deepEqual(result.game.board.slice(0, 4), [4, 4, 2, 0]);
  assert.equal(result.game.score, 8);
  assert.equal(result.merges.length, 2);
  assert.deepEqual(game.board.slice(0, 4), [2, 2, 2, 2]);
});
test('无效移动不生成新块，满盘无移动时检测失败', () => {
  const game = gameWith([2, 4, 8, 16, 4, 8, 16, 32, 8, 16, 32, 64, 16, 32, 64, 128]);
  assert.equal(hasMoves(game.board, 4), false);
  assert.equal(move(game, 'left').changed, false);
  assert.equal(move(game, 'left').game, game);
});
test('撤销恢复棋盘和分数，但消耗每局次数', () => {
  const initial = gameWith([2, 2, ...Array(14).fill(0)]);
  const moved = move(initial, 'left', () => 0).game;
  const undo = useItem(moved, 'undo');
  assert.deepEqual(undo.game.board, initial.board);
  assert.equal(undo.game.score, 0);
  assert.equal(undo.game.uses.undo, 1);
  assert.equal(undo.undoneMerges, 1);
});
test('清除、交换、定点合成与每局上限', () => {
  const initial = gameWith([2, 2, 4, ...Array(13).fill(0)]);
  const cleared = useItem(initial, 'clear', [2]).game;
  assert.equal(cleared.board[2], 0);
  const swapped = useItem(initial, 'swap', [0, 2]).game;
  assert.deepEqual(swapped.board.slice(0, 3), [4, 2, 2]);
  assert.deepEqual(findMergePairs(initial), [[0, 1]]);
  const merged = useItem(initial, 'merge', [0, 1]);
  assert.deepEqual(merged.game.board.slice(0, 3), [4, 0, 4]);
  assert.equal(merged.game.score, 4);
  assert.equal(merged.merges.length, 1);
  assert.throws(() => useItem({ ...initial, uses: { ...initial.uses, clear: ITEM_LIMITS.clear } }, 'clear', [0]));
});
test('清除初始三次，合成新的最大数字从 128 起增加次数且撤销不重复增加', () => {
  const initial = gameWith([64, 64, ...Array(14).fill(0)]);
  assert.equal(itemLimit(initial, 'clear'), 3);
  const moved = move(initial, 'left', () => 0).game;
  assert.equal(moved.peakTile, 128);
  assert.equal(itemLimit(moved, 'clear'), 4);
  const undone = useItem(moved, 'undo').game;
  assert.equal(itemLimit(undone, 'clear'), 4);
  assert.equal(itemLimit(move(undone, 'left', () => 0).game, 'clear'), 4);
  const repeated = gameWith([64, 64, ...Array(14).fill(0)]);
  repeated.peakTile = 128;
  assert.equal(itemLimit(move(repeated, 'left', () => 0).game, 'clear'), 3);
  const next = gameWith([128, 128, ...Array(14).fill(0)]);
  next.peakTile = 128;
  assert.equal(itemLimit(move(next, 'left', () => 0).game, 'clear'), 4);
});
test('重排小数字在上、大数字在下，续局保留最大方块与分数', () => {
  const initial = { ...gameWith([2, 64, 4, 64, 8, ...Array(11).fill(0)]), score: 900 };
  const shuffled = useItem(initial, 'shuffle').game;
  assert.equal(shuffled.board[0], 2);
  assert.equal(shuffled.board.at(-1), 64);
  assert.deepEqual(shuffled.board.filter(Boolean).sort((a, b) => a - b), [2, 4, 8, 64, 64]);
  const continued = useItem({ ...initial, over: true }, 'continue').game;
  assert.equal(continued.score, 900);
  assert.deepEqual(continued.board.slice(0, 5), [0, 64, 2, 64, 4]);
  assert.equal(continued.uses.continue, 1);
});
test('规则重排在 4×4 和 5×5 上都可指定最大数字的四个角', () => {
  for (const size of [4, 5]) {
    const values = [2, 4, 8, 64];
    const initial = { ...gameWith([...values, ...Array(size * size - values.length).fill(0)], size), score: 200 };
    const corners = [
      ['top-left', 0, size * size - 1],
      ['top-right', size - 1, size * (size - 1)],
      ['bottom-left', size * (size - 1), size - 1],
      ['bottom-right', size * size - 1, 0]
    ];
    for (const [corner, largestIndex, smallestIndex] of corners) {
      const shuffled = useItem(initial, 'shuffle', corner).game;
      assert.equal(shuffled.board[largestIndex], 64);
      assert.equal(shuffled.board[smallestIndex], 2);
      assert.deepEqual(shuffled.board.filter(Boolean).sort((a, b) => a - b), values);
      assert.equal(shuffled.score, 200);
      assert.equal(shuffled.uses.shuffle, 1);
    }
  }
});
test('预知下一块后可指定滑动完成后的空位', () => {
  const initial = gameWith([2, 0, 0, 0, ...Array(12).fill(0)]);
  const predicted = useItem(initial, 'foresight', [], () => 0).game;
  const moved = move(predicted, 'right', () => 0).game;
  assert.equal(moved.pending.value, 2);
  assert.equal(moved.board.filter(Boolean).length, 1);
  const placed = placePreview(moved, 0);
  assert.equal(placed.board[0], 2);
  assert.equal(placed.pending, null);
});
test('撤销不能重复领取同一里程碑，库存最多 50 个', () => {
  let profile = initialProfile();
  profile = applyProgress(profile, [{ value: 4 }]).profile;
  assert.equal(profile.inventory.undo, 1);
  profile = applyProgress(profile, [], 1).profile;
  profile = applyProgress(profile, [{ value: 4 }]).profile;
  assert.equal(profile.totalMerges, 1);
  assert.equal(profile.inventory.undo, 1);
  for (let i = 0; i < 200; i++) profile = applyProgress(profile, [{ value: 128 }]).profile;
  assert.ok(Object.values(profile.inventory).every(n => n <= INVENTORY_CAP));
  profile.inventory.clear = 49;
  profile.totalMerges = 2;
  profile.awarded = profile.awarded.filter(id => id !== 'count:3');
  profile = applyProgress(profile, [{ value: 4 }]).profile;
  assert.equal(profile.inventory.clear, 50);
  profile.totalMerges = 2;
  profile.awarded = profile.awarded.filter(id => id !== 'count:3');
  assert.equal(applyProgress(profile, [{ value: 4 }]).profile.inventory.clear, 50);
  assert.ok(profile.unlockedSkins.includes('mint'));
});
test('两个棋盘和最高分、道具库存可序列化保存', () => {
  const memory = new Map();
  const storage = { getItem: key => memory.get(key), setItem: (key, value) => memory.set(key, value) };
  const state = initialSave(newGame);
  state.games[5].score = 99; state.best[5] = 144; state.profile.inventory.clear = 2;
  save(storage, state);
  const restored = loadSave(storage, newGame);
  assert.equal(restored.games[5].score, 99);
  assert.equal(restored.best[5], 144);
  assert.equal(restored.profile.inventory.clear, 2);
  assert.equal(restored.games[4].score, 0);
  assert.equal(restored.settings.mergeBounce, true);
});
test('纯净模式的棋局、最高分和成就独立保存且不发道具', () => {
  const state = initialSave(newGame);
  state.mode = 'pure';
  state.pure.games[4].score = 128;
  state.pure.best[4] = 128;
  state.pure.profile = applyProgress(state.pure.profile, [{ value: 128 }], 0, { grantRewards: false, unlockSkins: false }).profile;
  assert.ok(state.pure.profile.achievements.includes('tile128'));
  assert.equal(state.pure.profile.inventory.clear, 0);
  assert.equal(state.profile.maxTile, 2);
  assert.equal(state.best[4], 0);
  const memory = new Map();
  const storage = { getItem: key => memory.get(key), setItem: (key, value) => memory.set(key, value) };
  save(storage, state);
  const restored = loadSave(storage, newGame);
  assert.equal(restored.mode, 'pure');
  assert.equal(restored.pure.games[4].score, 128);
  assert.equal(restored.pure.best[4], 128);
  assert.equal(restored.profile.maxTile, 2);
  delete restored.pure;
  save(storage, restored);
  assert.equal(loadSave(storage, newGame).mode, 'pure');
  assert.equal(loadSave(storage, newGame).pure.best[4], 0);
});
test('Q 弹合成开关保存，并为旧存档默认开启', () => {
  const memory = new Map();
  const storage = { getItem: key => memory.get(key), setItem: (key, value) => memory.set(key, value) };
  const state = initialSave(newGame);
  state.settings.mergeBounce = false;
  save(storage, state);
  assert.equal(loadSave(storage, newGame).settings.mergeBounce, false);
  delete state.settings;
  save(storage, state);
  assert.equal(loadSave(storage, newGame).settings.mergeBounce, true);
});
test('旧存档在解锁主题迁移后保持棋局和库存', () => {
  const memory = new Map();
  const storage = { getItem: key => memory.get(key), setItem: (key, value) => memory.set(key, value) };
  const state = initialSave(newGame);
  state.games[4].score = 128;
  state.profile.maxTile = 2048;
  state.profile.inventory.swap = 3;
  save(storage, state);
  const restored = loadSave(storage, newGame);
  assert.equal(restored.games[4].score, 128);
  assert.equal(restored.profile.inventory.swap, 3);
  assert.ok(STARTER_SKINS.every(id => restored.profile.unlockedSkins.includes(id)));
  assert.ok(['halloween', 'eva01', 'rilakkuma'].every(id => restored.profile.unlockedSkins.includes(id)));
  assert.ok(restored.profile.unlockedSkins.includes('cinnamoroll'));
});
test('皮肤先列初始四款，挑战皮肤按难度递增', () => {
  assert.deepEqual(SKINS.slice(0, 4).map(s => s.id), STARTER_SKINS);
  assert.ok(STARTER_SKINS.every(id => initialProfile().unlockedSkins.includes(id)));
  assert.deepEqual(SKINS.filter(s => s.unlockTile).map(s => s.unlockTile), [128, 256, 512, 1024]);
  const profile = applyProgress(initialProfile(), [{ value: 1024 }]).profile;
  assert.ok(profile.unlockedSkins.includes('cinnamoroll'));
});
test('高位方块与更难累计次数均有成就', () => {
  assert.ok([4096, 8192, 16384].every(tile => ACHIEVEMENTS.some(a => a.tile === tile)));
  assert.deepEqual(ACHIEVEMENTS.filter(a => a.count).map(a => a.count), [300, 600, 1000]);
  const profile = applyProgress(initialProfile(), [{ value: 16384 }]).profile;
  assert.ok(['tile4096', 'tile8192', 'tile16384'].every(id => profile.achievements.includes(id)));
});
test('大数字合成次数累积记录，旧存档以最低次数迁移', () => {
  let profile = applyProgress(initialProfile(), [{ value: 512 }, { value: 512 }]).profile;
  assert.equal(profile.tileMergeCounts[512], 2);
  profile = applyProgress(profile, [], 1).profile;
  assert.equal(profile.tileMergeCounts[512], 2);
  const memory = new Map();
  const storage = { getItem: key => memory.get(key), setItem: (key, value) => memory.set(key, value) };
  const state = initialSave(newGame);
  state.profile.maxTile = 2048;
  delete state.profile.tileMergeCounts;
  delete state.profile.approximateTiles;
  save(storage, state);
  const restored = loadSave(storage, newGame);
  assert.equal(restored.profile.tileMergeCounts[2048], 1);
  assert.ok(restored.profile.approximateTiles.includes(2048));
});
