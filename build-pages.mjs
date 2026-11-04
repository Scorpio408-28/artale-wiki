import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const { version } = JSON.parse(readFileSync(new URL('./docs/world.json', import.meta.url), 'utf8'));
const assetVersion = file => `${version}-${createHash('sha256').update(readFileSync(new URL(`./docs/${file}`, import.meta.url))).digest('hex').slice(0, 12)}`;
const appVersion = assetVersion('app.js'), styleVersion = assetVersion('styles.css');

const pages = [
  ['index', '首頁', '文字版阿泰爾的冒險入口'],
  ['guide', '新手指南', '從建立角色到第一次轉職'],
  ['equipment', '裝備圖鑑', '依名稱、部位與等級搜尋裝備'],
  ['scrolls', '卷軸圖鑑', '查看成功率、強化部位與屬性'],
  ['materials', '雜物', '雜物的 NPC 收購價與掉落來源'],
  ['shops', 'NPC 商店', '查詢 NPC 販售裝備與卷軸的資料'],
  ['maps', '地圖', '目前文字版遊戲的地圖與怪物'],
  ['monsters', '怪物', '目前文字版遊戲的怪物資料'],
  ['jobs', '職業', '一轉至四轉的職業、技能與開放狀態'],
  ['skillbooks', '技能書', '四轉技能書在哪裡打、哪隻怪會掉'],
  ['endgame', '畢業裝備', '各職業畢業裝穿什麼、衝什麼卷、去哪裡拿'],
  ['roadmap', '開發路線', '目前已開放、部分完成與待開發的功能'],
  ['changelog', '更新紀錄', '資料來源與網站更新歷程']
];
const nav = pages.map(([id, name]) => `<a href="${id}.html" data-nav="${id}">${name}</a>`).join('');
for (const [id, name, description] of pages) {
  const html = `<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#182b2a">
  <meta name="game-version" content="${version}">
  <meta name="description" content="${description}。文字版阿泰爾資料站。">
  <title>${name}｜文字版阿泰爾資料站</title>
  <link rel="icon" href="avatar.png">
  <link rel="stylesheet" href="styles.css?v=${styleVersion}">
  <script defer src="app.js?v=${appVersion}"></script>
</head>
<body data-page="${id}">
  <a class="skip" href="#main">跳到主要內容</a>
  <header class="site-header">
    <div class="header-inner">
      <a class="brand" href="index.html"><img src="avatar.png" alt="" width="35" height="35"><span>文字版<span class="brand-accent">阿泰爾</span><small>冒險資料站</small></span></a>
      <nav aria-label="主要導覽">${nav}</nav>
    </div>
  </header>
  <main id="main" class="container" tabindex="-1"><div id="app"></div></main>
  <footer class="site-footer"><div class="container"><span>文字版阿泰爾資料站 · 玩家製作的文字遊戲資料</span><span>圖鑑快照不代表台服目前全部可取得 · <a href="changelog.html">資料與更新紀錄</a> · <a href="https://t.me/+BbiLPFcTQkA3YzY1" target="_blank" rel="noopener noreferrer">加入玩家群組弓箭手村</a></span></div></footer>
</body>
</html>\n`;
  writeFileSync(new URL(`./docs/${id}.html`, import.meta.url), html);
}
console.log(`已產生 ${pages.length} 個頁面`);
