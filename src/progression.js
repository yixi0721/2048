import { ITEM_ORDER } from './engine.js';

export const STORAGE_KEY = 'cream2048.v1';
export const INVENTORY_CAP = 50;
export const STARTER_SKINS = ['cream', 'mint', 'peach', 'night'];
export const SKINS = [
  { id: 'cream', name: '奶油', requirement: '初始可用', starter: true },
  { id: 'mint', name: '薄荷', requirement: '初始可用', starter: true },
  { id: 'peach', name: '蜜桃', requirement: '初始可用', starter: true },
  { id: 'night', name: '月夜', requirement: '初始可用', starter: true },
  { id: 'halloween', name: '万圣节', requirement: '首次合成 128', unlockTile: 128 },
  { id: 'eva01', name: 'EVA 初号机', requirement: '首次合成 256', unlockTile: 256 },
  { id: 'rilakkuma', name: '轻松熊', requirement: '首次合成 512', unlockTile: 512 },
  { id: 'cinnamoroll', name: '玉桂狗', requirement: '首次合成 1024', unlockTile: 1024 }
];
export const ACHIEVEMENTS = [
  { id: 'threeHundred', label: '连锁大师', count: 300, icon: '✺', tier: 'gold' },
  { id: 'sixHundred', label: '千锤百炼', count: 600, icon: '✹', tier: 'gold' },
  { id: 'oneThousand', label: '千次合成', count: 1000, icon: '✷', tier: 'cosmic' },
  { id: 'tile128', label: '闪亮 128', tile: 128, icon: '◆', tier: 'bronze', luxury: 0 },
  { id: 'tile512', label: '甜蜜 512', tile: 512, icon: '✦', tier: 'silver', luxury: 1 },
  { id: 'tile1024', label: '跃过 1024', tile: 1024, icon: '✧', tier: 'silver', luxury: 2 },
  { id: 'tile2048', label: '抵达 2048', tile: 2048, icon: '✴', tier: 'gold', luxury: 3 },
  { id: 'tile4096', label: '穿越 4096', tile: 4096, icon: '✺', tier: 'gold', luxury: 4 },
  { id: 'tile8192', label: '星河 8192', tile: 8192, icon: '✷', tier: 'cosmic', luxury: 5 },
  { id: 'tile16384', label: '极限 16384', tile: 16384, icon: '♛', tier: 'cosmic', luxury: 6 }
];
const unlockAllSkinsForBuild = () => globalThis.__UNLOCK_ALL_SKINS__ === true;
export function initialProfile() {
  return { totalMerges: 0, maxTile: 2, inventory: Object.fromEntries(ITEM_ORDER.map(k => [k, 0])), awarded: [], unlockedSkins: unlockAllSkinsForBuild() ? SKINS.map(skin => skin.id) : [...STARTER_SKINS], selectedSkin: 'cream', achievements: [], tileMergeCounts: {}, approximateTiles: [] };
}
export function initialSave(newGame) {
  return { version: 1, mode: 'normal', activeSize: 4, games: { 4: newGame(4), 5: newGame(5) }, best: { 4: 0, 5: 0 }, profile: initialProfile(), pure: initialPure(newGame), settings: { mergeBounce: true } };
}
export function initialPure(newGame) {
  return { activeSize: 4, games: { 4: newGame(4), 5: newGame(5) }, best: { 4: 0, 5: 0 }, profile: initialProfile() };
}
function mergeMilestones(upTo) {
  const early = [1, 3, 6, 10, 15, 21, 28];
  const output = early.filter(n => n <= upTo);
  for (let n = 35; n <= upTo; n += 7) output.push(n);
  return output;
}
export function applyProgress(profile, merges, undoneMerges = 0, options = {}) {
  const { grantRewards = true, unlockSkins = true } = options;
  const next = structuredClone(profile), rewards = [];
  next.tileMergeCounts ||= {};
  next.approximateTiles ||= [];
  const previous = next.totalMerges;
  next.totalMerges = Math.max(0, previous + merges.length - undoneMerges);
  const awarded = new Set(next.awarded);
  const grant = (id, item) => {
    if (awarded.has(id)) return;
    awarded.add(id);
    if (grantRewards && next.inventory[item] < INVENTORY_CAP) { next.inventory[item]++; rewards.push(item); }
  };
  for (const n of mergeMilestones(next.totalMerges)) {
    if (n <= previous) continue;
    const index = mergeMilestones(n).length - 1;
    grant(`count:${n}`, ITEM_ORDER[index % ITEM_ORDER.length]);
  }
  for (const merge of merges) {
    next.maxTile = Math.max(next.maxTile, merge.value);
    if (merge.value >= 128) next.tileMergeCounts[merge.value] = (next.tileMergeCounts[merge.value] || 0) + 1;
    if (merge.value >= 128 && (merge.value & (merge.value - 1)) === 0) {
      const rank = Math.log2(merge.value) - 7;
      grant(`tile:${merge.value}`, ITEM_ORDER[(rank + 1) % ITEM_ORDER.length]);
    }
  }
  next.awarded = [...awarded];
  next.achievements = [...new Set([...next.achievements, ...ACHIEVEMENTS.filter(a => (a.count && next.totalMerges >= a.count) || (a.tile && next.maxTile >= a.tile)).map(a => a.id)])];
  for (const skin of STARTER_SKINS) if (!next.unlockedSkins.includes(skin)) next.unlockedSkins.push(skin);
  if (unlockSkins) for (const skin of SKINS.filter(s => s.unlockTile)) {
    if (next.maxTile >= skin.unlockTile && !next.unlockedSkins.includes(skin.id)) next.unlockedSkins.push(skin.id);
  }
  return { profile: next, rewards };
}
export function loadSave(storage, newGame) {
  try {
    const parsed = JSON.parse(storage.getItem(STORAGE_KEY));
    if (parsed?.version !== 1 || ![4, 5].includes(parsed.activeSize)) throw new Error('invalid');
    for (const size of [4, 5]) {
      const game = parsed.games?.[size];
      if (game?.size !== size || game.board?.length !== size * size || !game.uses) throw new Error('invalid game');
    }
    if (!parsed.profile?.inventory || !Array.isArray(parsed.profile.awarded)) throw new Error('invalid profile');
    parsed.mode = parsed.mode === 'pure' ? 'pure' : 'normal';
    const validPure = parsed.pure && [4, 5].includes(parsed.pure.activeSize) && [4, 5].every(size => parsed.pure.games?.[size]?.size === size && parsed.pure.games[size].board?.length === size * size);
    if (!validPure) parsed.pure = initialPure(newGame);
    for (const session of [parsed, parsed.pure]) for (const size of [4, 5]) {
      const game = session.games[size];
      game.clearBonus ??= 0;
      game.peakTile ??= Math.max(...game.board, game.reached2048 ? 2048 : 0);
    }
    if (!parsed.profile.tileMergeCounts) {
      parsed.profile.tileMergeCounts = {};
      parsed.profile.approximateTiles = [];
      for (let value = 128; value <= parsed.profile.maxTile; value *= 2) {
        parsed.profile.tileMergeCounts[value] = 1;
        parsed.profile.approximateTiles.push(value);
      }
    }
    parsed.profile = applyProgress(parsed.profile, []).profile;
    parsed.pure.profile = applyProgress(parsed.pure.profile || initialProfile(), [], 0, { grantRewards: false, unlockSkins: false }).profile;
    if (unlockAllSkinsForBuild()) {
      const unlockedSkins = SKINS.map(skin => skin.id);
      parsed.profile.unlockedSkins = [...unlockedSkins];
      parsed.pure.profile.unlockedSkins = [...unlockedSkins];
    }
    parsed.settings = { mergeBounce: parsed.settings?.mergeBounce !== false };
    return parsed;
  } catch { return initialSave(newGame); }
}
export function save(storage, state) { storage.setItem(STORAGE_KEY, JSON.stringify(state)); }
