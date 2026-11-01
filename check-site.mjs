import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const pages = ['index', 'guide', 'equipment', 'scrolls', 'materials', 'shops', 'maps', 'monsters', 'jobs', 'skillbooks', 'roadmap', 'changelog'];
for (const page of pages) {
  const html = readFileSync(new URL(`./docs/${page}.html`, import.meta.url), 'utf8');
  assert.ok(html.includes(`data-page="${page}"`));
  assert.ok(html.includes('app.js'));
  for (const target of pages) assert.ok(html.includes(`href="${target}.html"`), `${page} missing ${target}`);
}
const catalog = JSON.parse(readFileSync(new URL('./docs/catalog.json', import.meta.url)));
const world = JSON.parse(readFileSync(new URL('./docs/world.json', import.meta.url)));
assert.equal(catalog.equipment.length, 1840);
assert.equal(catalog.scrolls.length, 274);
assert.equal(catalog.shops.length, 47);
assert.ok(Object.keys(world.maps).length >= 360, '0.7 起含天空之城、冰原雪域、玩具城一帶');
assert.ok(world.regions?.some(region => region.id === 'ossyria') && world.regions.some(region => region.id === 'ludus'));
assert.ok(world.featuredRoute?.length > 3, '地圖頁要有楓之島到天空之城的原作路線');
assert.ok(world.ships?.some(ship => ship.price === 5000));
assert.ok(Object.keys(world.monsters).length >= 113);
// 圖鑑沒有列掉落的任務怪（例如變身小鬼怪）只掉楓幣，其餘怪物都要有掉落。
assert.ok(Object.values(world.monsters).filter(monster => !monster.drops?.length).length <= 2);
assert.ok(world.monsters.snail.drops.some(drop => drop.id === 'eq_b14c71893bc3'));
assert.ok(world.skills.length >= 90, '一轉加十二條二轉技能');
for (const id of ['fighter', 'page', 'spearman', 'fire_poison', 'ice_lightning', 'cleric', 'hunter', 'crossbowman', 'assassin', 'bandit', 'brawler', 'gunslinger'])
  assert.ok(world.jobs[id]?.tier === 2 && world.skills.some(skill => skill.jobs?.includes(id)), `missing second job ${id}`);
for (const name of ['激勵', '神聖之火', '火焰箭', '雷閃電鳴', '神聖之箭', '炸彈箭', '穿透之箭', '狂暴衝擊', '散射'])
  assert.ok(world.skills.some(skill => skill.name === name), `missing ${name}`);
for (const name of ['極限迴避', '衝擊拳', '旋風斬', '雙子星攻擊', '衝鋒'])
  assert.ok(world.skills.some(skill => skill.job === 'pirate' && skill.name === name), `missing pirate ${name}`);
for (const name of ['魔力恢復', '魔力擴展', '魔心防禦', '魔力之盾', '魔靈彈', '魔力爪'])
  assert.ok(world.skills.some(skill => skill.job === 'magician' && skill.name === name), `missing magician ${name}`);
for (const name of ['精準強化', '百步穿楊', '霸王箭', '集中術', '斷魂箭', '二連箭'])
  assert.ok(world.skills.some(skill => skill.job === 'bowman' && skill.name === name), `missing bowman ${name}`);
assert.equal(world.jobs.assassin.parent, 'thief');
assert.equal(world.jobs.bandit.parent, 'thief');
for (const name of ['精準暗器', '強力投擲', '吸血術', '精準之刀', '妙手術', '迴旋斬', '恢復術', '速度激發'])
  assert.ok(world.skills.some(skill => skill.name === name), `missing ${name}`);
for (const name of ['生命淨化', '生命擴展', '生命恢復', '自身強化', '魔天一擊', '劍氣縱橫'])
  assert.ok(world.skills.some(skill => skill.job === 'warrior' && skill.name === name), `missing warrior ${name}`);
const ids = new Set([...catalog.equipment, ...catalog.scrolls].map(item => item.id));
assert.equal(ids.size, 2114);
for (const shop of catalog.shops) for (const offer of shop.offers) assert.ok(ids.has(offer.itemId));
for (const asset of ['app.js', 'styles.css', 'avatar.png', 'city-cover.png']) assert.ok(existsSync(new URL(`./docs/${asset}`, import.meta.url)));
const roadmap = JSON.parse(readFileSync(new URL('./docs/roadmap.json', import.meta.url)));
assert.equal(roadmap.version, world.version, '開發路線必須同步目前遊戲版本');
assert.equal(new Set(roadmap.phases.map(phase => phase.id)).size, roadmap.phases.length);
assert.ok(roadmap.current.some(line => line.includes(`${Object.keys(world.maps).length} 張地圖`)));
assert.ok(roadmap.current.some(line => line.includes(`${world.skills.filter(skill => skill.inert).length} 個技能項目`)));
for (const phase of roadmap.phases) {
  assert.ok(phase.features.length >= 2, `${phase.id} missing features`);
  assert.ok(phase.acceptance.length >= 1, `${phase.id} missing acceptance`);
}
for (const phrase of ['自動配點', '掉落', '野王', '二轉', '三轉', '四轉'])
  assert.ok(JSON.stringify(roadmap).includes(phrase), `roadmap missing ${phrase}`);
// 遊戲同步資料：版本、雜物收購價、裝備價格與遊戲更新紀錄。
assert.match(world.version, /^\d+\.\d+\.\d+$/);
const materials = Object.values(world.items).filter(item => item.slot === 'material');
assert.ok(materials.length >= 100, 'missing materials');
assert.ok(materials.every(item => Number.isFinite(item.sellPrice) && item.priceSource), 'material without price');
assert.equal(world.items.snail_shell.sellPrice, 2);
assert.ok(Object.values(world.gearPrices).every(([price, sell]) => sell === Math.floor(price / 2)), 'gear sell price is not half');
// 技能書：來源與掉率從遊戲帶出來，化石龍長老要掉書。
if (world.skillBooks?.sources) {
  assert.ok(Object.keys(world.skillBooks.sources).length >= 90, 'skill book sources missing');
  assert.ok(world.skillBooks.mobRate > 0 && world.skillBooks.bossRate > 0);
  assert.ok(Object.values(world.monsters).some(monster => monster.name === '化石龍長老' && monster.drops.some(drop => drop.id.startsWith('book_'))));
}
const gameChangelog = JSON.parse(readFileSync(new URL('./docs/game-changelog.json', import.meta.url)));
assert.equal(gameChangelog[0].version, world.version);
for (const page of pages) {
  const html = readFileSync(new URL(`./docs/${page}.html`, import.meta.url), 'utf8');
  assert.ok(html.includes(`<meta name="game-version" content="${world.version}">`), `${page} 版本標記過期`);
  assert.ok(html.includes(`src="app.js?v=${world.version}-`), `${page} 缺少程式快取版本`);
  assert.ok(html.includes(`href="styles.css?v=${world.version}-`), `${page} 缺少樣式快取版本`);
}
// 執行實際前端的資料載入及渲染，確認更新頁／路線頁要求最新資料並顯示目前版本。
for (const page of ['changelog', 'roadmap']) {
  const rendered = { innerHTML: '' }, requests = [];
  const document = {
    body: { dataset: { page } }, baseURI: `https://example.test/wiki/${page}.html`,
    querySelector: selector => selector === '#app' ? rendered : selector === 'meta[name="game-version"]' ? { content: world.version } : null
  };
  await runInNewContext(readFileSync(new URL('./docs/app.js', import.meta.url), 'utf8'), {
    document, URL, console,
    fetch: async (url, options) => {
      requests.push({ url, options });
      return { ok: true, json: async () => url.pathname.endsWith('/roadmap.json') ? roadmap : gameChangelog };
    }
  });
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url.searchParams.get('v'), world.version);
  assert.equal(requests[0].options.cache, 'no-store');
  assert.ok(rendered.innerHTML.includes(`v${world.version}`), `${page} 未顯示目前版本`);
}
// 自訂高等區須在實際地圖／怪物頁標明來源並顯示刷寶資訊。
for (const page of ['maps', 'monsters']) {
  const nodes = new Map();
  const node = selector => {
    if (!nodes.has(selector)) nodes.set(selector, { value: '', innerHTML: '', selectedOptions: [] });
    return nodes.get(selector);
  };
  const rendered = { innerHTML: '', querySelector: node };
  const document = { body: { dataset: { page } }, baseURI: `https://example.test/wiki/${page}.html`,
    querySelector: selector => selector === '#app' ? rendered : selector === 'meta[name="game-version"]' ? { content: world.version } : null };
  await runInNewContext(readFileSync(new URL('./docs/app.js', import.meta.url), 'utf8'), {
    document, URL, console, fetch: async () => ({ ok: true, json: async () => world })
  });
  const content = rendered.innerHTML + [...nodes.values()].map(n => n.innerHTML).join('');
  assert.ok(content.includes('文字版自訂'), `${page} missing custom provenance`);
  assert.ok(content.includes(page === 'maps' ? '補給線' : '邊境斥候'), `${page} missing frontier data`);
  assert.ok(content.includes(page === 'maps' ? '武器攻擊／魔力60%' : '拳套攻擊力卷軸60%'), `${page} missing loot`);
  if (page === 'maps') assert.ok(content.includes('文字版路線'), 'custom route mislabeled');
}
console.log(`${pages.length} 頁、2,114 件道具、${materials.length} 種雜物、47 間 NPC 商店、${Object.keys(world.maps).length} 張地圖、遊戲 v${world.version} 及完整路線圖檢查通過。`);
