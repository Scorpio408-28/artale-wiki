import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const gameRoot = process.argv[2];
if (!gameRoot) throw new Error('請提供遊戲專案資料夾路徑');
const load = file => import(pathToFileURL(resolve(gameRoot, file)).href);
const source = await load('src/content.js');
// 新版遊戲在 content.js 匯出合併同名材料後的掉落表；舊版才退回 loot.js。
const dropPools = source.dropPools || (await load('src/loot.js')).dropPools;
const { sellPrice } = await load('src/engine.js');
const { skills, skillDetails } = await load('src/progression.js');
const changelog = JSON.parse(readFileSync(resolve(gameRoot, 'src/data/changelog.json'), 'utf8'));
const output = new URL('./docs/world.json', import.meta.url);
const existing = JSON.parse(readFileSync(output, 'utf8'));
const monsters = Object.fromEntries(Object.entries(source.monsters).map(([id, monster]) =>
  [id, { ...monster, drops: dropPools[id] || [] }]));
const usedItemIds = new Set(Object.values(monsters).flatMap(monster => [monster.drop, ...monster.drops.map(drop => drop.id)]));
// 野王（含殘暴炎魔）掉的裝備、卷軸也要有名稱。
for (const boss of Object.values(source.fieldBosses)) for (const id of [...(boss.drops || []).map(drop => drop.id), ...(boss.weaponPool || [])]) usedItemIds.add(id);
const skillBooks = await load('src/skillbooks.js').catch(() => null);
const aliases = source.materialAliases || {};
const itemIds = new Set([...usedItemIds, ...Object.keys(source.items).filter(id => source.items[id].slot === 'material' && !aliases[id])]);
const items = Object.fromEntries([...itemIds].filter(id => source.items[id]).map(id => {
  const item = source.items[id];
  return [id, { name: item.name, slot: item.slot,
    ...(item.slot === 'material' ? { sellPrice: item.price, priceSource: item.priceSource || '文字版暫定售價' } : {}) }];
}));
// 圖鑑裝備在文字版商店的 [售價, NPC 收購價（售價一半）, 售價是否來自圖鑑 NPC 1／0]；用陣列讓檔案保持輕量。
const gearPrices = Object.fromEntries(Object.entries(source.items)
  .filter(([id, item]) => id.startsWith('eq_') && item.price > 0)
  .map(([id, item]) => [id, [item.price, sellPrice(item), item.priceSource === '圖鑑 NPC 售價' ? 1 : 0]]));
// 遊戲自己加的裝備（社群圖鑑沒有的：龍王項鍊與翅膀、龍系列補件、拉圖斯記號、次元耳環、自訂戒指…）：
// 照圖鑑的格式輸出，資料站裝備頁併進清單；另附特殊效果、能不能交易。
const statsModule = await load('src/stats.js').catch(() => null);
const market = await load('src/market.js').catch(() => null);
const ALL_JOBS = ['BEGINNER', 'WARRIOR', 'MAGICIAN', 'BOWMAN', 'THIEF', 'PIRATE'];
const customEquipment = Object.entries(source.items)
  .filter(([id, item]) => !id.startsWith('eq_') && item.category === 'equip' && !item.ammo)
  .map(([id, item]) => ({ id, kind: 'equipment', name: item.name, sourceName: item.source || '文字版自訂', type: item.catalogType || String(item.type || item.slot).toUpperCase(),
    level: item.level || 0, jobs: item.jobs?.length ? item.jobs : ALL_JOBS, requirements: item.requirements || {}, stats: item.stats || {},
    acquisition: { monsters: [], npcs: [], quests: [] }, custom: true,
    ...(item.effects && statsModule?.effectText ? { effect: statsModule.effectText(item.effects) } : {}),
    ...(market?.tradeable && !market.tradeable(id) ? { untradeable: true } : {}) }));
const previousSkills = new Map(existing.skills.map(skill => [skill.id, skill]));
const skillCatalog = Object.entries(skills).map(([id, skill]) => {
  const first = skillDetails(id, 1);
  const max = skillDetails(id, skill.maxLevel);
  return {
    id, name: skill.name, job: skill.job, tier: skill.tier || 1,
    ...(skill.kind ? { kind: skill.kind } : {}),
    ...(skill.jobs ? { jobs: skill.jobs } : {}),
    weapons: skill.weapon || [], maxLevel: skill.maxLevel,
    ...(!skill.kind ? { hits: first.hits, firstPercent: first.damagePercent, maxPercent: max.damagePercent, ...(max.targets > 1 ? { targets: max.targets } : {}) } : {}),
    ...(max.duration ? { duration: max.duration } : {}),
    firstMp: first.mpCost, maxMp: max.mpCost,
    ...(first.hpCost ? { firstHp: first.hpCost, maxHp: max.hpCost } : {}),
    ...(skill.prerequisite ? { prerequisite: skill.prerequisite } : {}),
    // 四轉：沒技能書時的上限、技能書在阿泰爾從哪來（資料站給玩家查）。
    ...(skill.masterLevel !== undefined ? { masterLevel: skill.masterLevel } : {}),
    ...(skill.books ? { books: skill.books } : {}),
    ...(skill.inert ? { inert: true } : {}),
    // 說明一律用滿級的最新文字；遊戲沒有說明文字的才沿用資料站舊的。
    ...(skill.effect || previousSkills.get(id)?.description ? { description: skill.effect ? skill.effect(skill.maxLevel) : previousSkills.get(id).description } : {})
  };
});
// 0.7 起遊戲有大區、船班與原作路線；舊版遊戲沒有這些檔案時照舊輸出地圖。
const regions = await load('src/regions.js').catch(() => null);
const jobInfo = await load('src/jobinfo.js').catch(() => null);
const routes = await load('src/routes.js').catch(() => null);
const mapIdByName = new Map(Object.entries(source.maps).map(([id, map]) => [map.name, id]));
// 遊戲裡標成重複（duplicateOf）的地圖不列在資料站。
const listedMaps = Object.fromEntries(Object.entries(source.maps).filter(([, map]) => !map.duplicateOf));
const maps = routes ? Object.fromEntries(Object.entries(listedMaps).map(([id, map]) => {
  const route = routes.routeFromTown(id);
  const shops = routes.shopsAt(id);
  return [id, { ...map, ...(route?.length > 1 ? { route } : {}), ...(shops.length ? { shops } : {}) }];
})) : listedMaps;
const world = {
  ...existing,
  version: changelog.versions[0].version,
  jobs: source.jobs, items, gearPrices, skills: skillCatalog,
  maps, monsters,
  fieldBosses: source.fieldBosses,
  customEquipment,
  ...(source.RING_BOX_ODDS ? { ringBox: source.RING_BOX_ODDS } : {}),
  ...(skillBooks ? { skillBooks: { zakum: skillBooks.ZAKUM_BOOKS, custom: skillBooks.CUSTOM_UNLOCKS, success: skillBooks.BOOK_SUCCESS, needLevel: skillBooks.BOOK_NEED_LEVEL,
    ...(skillBooks.BOOK_SOURCES ? { sources: skillBooks.BOOK_SOURCES, mobRate: skillBooks.BOOK_MOB_RATE, bossRate: skillBooks.BOOK_BOSS_RATE } : {}) } } : {}),
  ...(regions ? { regions: regions.worldRegions, ships: regions.shipRoutes } : {}),
  ...(jobInfo ? { jobIntros: Object.fromEntries(Object.entries(jobInfo.jobIntros).map(([id, intro]) => [id, { role: intro.role, summary: intro.summary }])) } : {}),
  ...(routes ? { featuredRoute: routes.originalRoute(mapIdByName.get('楓之島・楓之港'), mapIdByName.get('天空之城')) } : {})
};
writeFileSync(output, JSON.stringify(world, null, 2).replace(/\[\n\s+(\d+),\n\s+(\d+),\n\s+([01])\n\s+\]/g, '[$1, $2, $3]') + '\n');
writeFileSync(new URL('./docs/game-changelog.json', import.meta.url), JSON.stringify(changelog.versions, null, 2) + '\n');
const materials = Object.values(items).filter(item => item.slot === 'material').length;
console.log(`Wiki 同步遊戲 v${world.version}：${Object.keys(world.maps).length} 張地圖、${Object.keys(monsters).length} 種普通怪、${materials} 種雜物、${Object.keys(gearPrices).length} 件裝備價格。`);
