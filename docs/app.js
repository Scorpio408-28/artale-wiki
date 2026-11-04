const root = document.querySelector('#app');
const page = document.body.dataset.page;
const buildVersion = document.querySelector('meta[name="game-version"]')?.content || '';
document.querySelector(`[data-nav="${page}"]`)?.setAttribute('aria-current', 'page');

const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const number = value => Number(value).toLocaleString('zh-TW');
// 掉率：1% 以上到小數一位；更小的顯示兩位有效數字（0.0069%），不會被四捨五入成 0%。
const percent = chance => { const value = chance * 100; return `${value >= 1 ? Math.round(value * 10) / 10 : Number(value.toPrecision(2))}%`; };
// 打倒後分裂出這隻怪的母怪（例：搞怪CD ← 異型雙碟）。
const splitParent = (world, monsterId) => Object.entries(world.monsters).find(([, monster]) => monster.split?.id === monsterId);
const level = value => value ? `Lv.${value}` : '無等級限制';
const typeNames = {
  HAT:'帽子',TOP:'上衣',BOTTOM:'褲裙',OVERALL:'套服',SHOES:'鞋子',GLOVES:'手套',CAPE:'披風',SHIELD:'盾牌',
  EARRINGS:'耳環',RING:'戒指',PENDANT:'墜飾',BELT:'腰帶',SHOULDERPAD:'肩飾',MEDAL:'勳章',
  'ONE-HANDED SWORD':'單手劍','TWO-HANDED SWORD':'雙手劍','ONE-HANDED AXE':'單手斧','TWO-HANDED AXE':'雙手斧',
  'ONE-HANDED BLUNT WEAPON':'單手棍','TWO-HANDED BLUNT WEAPON':'雙手棍',SPEAR:'槍',POLEARM:'矛',WAND:'短杖',STAFF:'長杖',
  BOW:'弓',CROSSBOW:'弩',DAGGER:'短劍',CLAW:'拳套',KNUCKLE:'指虎',GUN:'火槍',ARROW:'箭矢',
  'THROWING-STAR':'飛鏢',BULLET:'子彈','EYE ACCESSORY':'眼飾','FACE ACCESSORY':'臉飾',
  sword:'劍',wand:'短杖',bow:'弓',dagger:'短劍',claw:'拳套',knuckle:'指虎',gun:'火槍'
};
const statNames = {str:'STR',dex:'DEX',int:'INT',luk:'LUK',hp:'HP',mp:'MP',atk:'物攻',matk:'魔攻',def:'物防',mdef:'魔防',accuracy:'命中',avoidability:'迴避',speed:'速度',jump:'跳躍',upgradeSlots:'可衝次數'};
const jobNames = {BEGINNER:'初心者',WARRIOR:'劍士',MAGICIAN:'法師',BOWMAN:'弓箭手',THIEF:'盜賊',PIRATE:'海盜'};
const typeName = value => typeNames[value] || value || '未分類';

function head(kicker,title,summary){return `<div class="page-head"><div class="eyebrow">${esc(kicker)}</div><h1>${esc(title)}</h1><p>${esc(summary)}</p></div>`;}
function card(icon,title,description,url){return `<a class="card" href="${url}"><span class="icon" aria-hidden="true">${icon}</span><h3>${esc(title)}</h3><p>${esc(description)}</p></a>`;}
function error(message){root.innerHTML=head('資料讀取','暫時無法顯示',message)+'<p><a href="index.html">回首頁</a></p>';}
async function data(file){const url=new URL(file,document.baseURI);if(buildVersion)url.searchParams.set('v',buildVersion);const response=await fetch(url,{cache:'no-store'});if(!response.ok)throw new Error(`無法讀取 ${file}`);return response.json();}
function stats(values={},requirements=false){return Object.entries(values).filter(([key,val])=>!requirements||Number(val)>0).map(([key,val])=>{
  const amount=typeof val==='object'&&val!==null ? val.middle ?? val.value ?? '?' : val;
  const range=Array.isArray(val?.range)&&val.range[0]!==val.range[1] ? ` (${val.range.join('–')})` : '';
  return `${statNames[key]||key} ${key==='upgradeSlots'||requirements?'':'+'}${amount}${range}`;
}).join(' · ')||'來源未列出';}
function pagination(total,current,onChange){
  const max=Math.max(1,Math.ceil(total/20));
  const bar=document.querySelector('.pagination');if(!bar)return;
  bar.innerHTML=`<button id="previous" ${current<=1?'disabled':''}>← 上一頁</button><span>${current} / ${max} 頁</span><button id="next" ${current>=max?'disabled':''}>下一頁 →</button>`;
  bar.querySelector('#previous').onclick=()=>onChange(current-1);
  bar.querySelector('#next').onclick=()=>onChange(current+1);
}
// 遊戲資料（world.json）；裝備、卷軸、雜物頁用來顯示文字版掉落來源與收購價。
let gameWorld=null;
// 反查文字版裡哪些怪會掉這件物品、掉率，以及那隻怪出現在哪些地圖。
function dropSources(world,id){
  if(!world)return[];
  const mapsOf=monsterId=>Object.values(world.maps).filter(map=>map.monsters.includes(monsterId)).map(map=>map.name);
  return Object.entries(world.monsters).map(([monsterId,monster])=>({monster,chance:(monster.drops||[]).filter(drop=>drop.id===id).reduce((sum,drop)=>sum+drop.chance,0),maps:mapsOf(monsterId),from:(parent=>parent?{name:parent[1].name,maps:mapsOf(parent[0])}:null)(splitParent(world,monsterId))}))
    .filter(entry=>entry.chance>0).sort((a,b)=>b.chance-a.chance||a.monster.level-b.monster.level);
}
function dropTable(world,id){
  const rows=dropSources(world,id);
  return rows.length?`<div class="data-wrap"><table><thead><tr><th>怪物</th><th>等級</th><th>掉率</th><th>出現地圖</th></tr></thead><tbody>${rows.map(row=>`<tr><td><strong>${esc(row.monster.name)}</strong></td><td>${row.monster.level}</td><td>${percent(row.chance)}</td><td>${row.maps.length?row.maps.map(esc).join('、'):row.from?`由${esc(row.from.name)}打倒後分裂（${row.from.maps.map(esc).join('、')||'尚無地圖'}）`:'尚無地圖'}</td></tr>`).join('')}</tbody></table></div>`:'<p class="muted">目前文字版沒有怪物會掉這件物品。</p>';
}
const itemPage=(world,id)=>{const slot=world?.items[id]?.slot;return slot==='material'?`materials.html?id=${encodeURIComponent(id)}`:id.startsWith('sc_')?`scrolls.html?id=${encodeURIComponent(id)}`:id.startsWith('eq_')?`equipment.html?id=${encodeURIComponent(id)}`:null;};
function showDetail(item){
  const panel=document.querySelector('#detail');if(!panel)return;
  const gamePrice=gameWorld?.gearPrices?.[item.id];
  const npcs=item.acquisition?.npcs||[];
  const drops=item.acquisition?.monsters||[];
  const quests=item.acquisition?.quests||[];
  const success=item.kind==='scrolls' ? item.name.match(/(10|30|60|70|100)%/)?.[0] : null;
  panel.hidden=false;
  panel.innerHTML=`<button class="close" aria-label="關閉物品詳情">關閉</button><div class="eyebrow">${item.kind==='scrolls'?'卷軸':'裝備'}詳情</div><h2>${esc(item.name)}</h2><p class="muted">${esc(typeName(item.type))} · ${esc(level(item.level))}${success?' · 成功率 '+esc(success):''}</p>
    <div class="detail-grid"><div><small>屬性</small><p>${esc(stats(item.stats))}</p></div><div><small>裝備需求</small><p>${esc(item.requirements?stats(item.requirements,true):'不適用')}</p></div>
    <div><small>職業</small><p>${esc(item.jobs?.map(x=>jobNames[x]||x).join('、')||'來源未列出')}</p></div><div><small>NPC 販售</small><p>${npcs.length?npcs.map(x=>`${esc(x.name)} · ${number(x.price)} 楓幣`).join('<br>'):'來源未列出'}</p></div>
    <div><small>怪物掉落</small><p>${drops.length?drops.map(x=>esc(x.name)).join('、'):'來源未列出'}</p></div><div><small>任務取得</small><p>${quests.length?quests.map(x=>esc(x.name)).join('、'):'來源未列出'}</p></div>
    ${gamePrice?`<div><small>文字版商店</small><p>${gamePrice[2]?`${number(gamePrice[0])} 楓幣（原作 NPC 售價）`:'不賣，只能打怪取得'}</p></div><div><small>賣給 NPC</small><p>${number(gamePrice[1])} 楓幣${gamePrice[2]?'（售價一半）':''}</p></div>`:''}</div>
    <h3>文字版哪些怪會掉</h3>${dropTable(gameWorld,item.id)}
    <p class="source-note">「文字版哪些怪會掉」照玩家圖鑑；裝備、卷軸、藥水的掉率照經典楓之谷 v83 參考資料，阿泰爾未公開官方掉率。</p>
    <p class="source-note">這是玩家社群圖鑑資料；本遊戲商店只賣原作 NPC 有賣的，其餘要打怪取得；特殊屬性仍在逐步接入戰鬥公式。<a href="${item.kind==='scrolls'?'https://www.artalemaplestory.com/zh/scrolls':'https://www.artalemaplestory.com/zh/equipment'}" target="_blank" rel="noopener noreferrer">查看資料來源 ↗</a></p>`;
  panel.querySelector('.close').onclick=()=>{panel.hidden=true;history.replaceState(null,'',location.pathname);};
  history.replaceState(null,'',`?id=${encodeURIComponent(item.id)}`);
  panel.scrollIntoView({behavior:'smooth',block:'start'});
}
function itemCatalog(catalog,kind){
  const list=kind==='equipment'?catalog.equipment:catalog.scrolls;
  const title=kind==='equipment'?'裝備圖鑑':'卷軸圖鑑';
  const source=kind==='equipment'?'https://www.artalemaplestory.com/zh/equipment':'https://www.artalemaplestory.com/zh/scrolls';
  const types=[...new Set(list.map(x=>x.type))].sort((a,b)=>typeName(a).localeCompare(typeName(b),'zh-Hant'));
  root.innerHTML=head('ITEM DATABASE',title,`收錄 ${number(list.length)} 筆玩家社群資料，包含屬性、取得來源與有列出的 NPC 售價。可點名稱查看詳情。`)+
    `<div class="notice">這是資料快照，不保證全部已在台服開放；文字版商店只賣原作 NPC 有賣的裝備與卷軸，其餘打怪取得；部分特殊屬性仍未套入戰鬥公式。<a href="changelog.html">查看資料說明</a></div>
    <div class="tools"><label class="field">搜尋名稱<input id="query" type="search" placeholder="輸入物品名稱或英文名稱" autocomplete="off"></label><label class="field">部位<select id="type"><option value="">全部部位</option>${types.map(x=>`<option value="${esc(x)}">${esc(typeName(x))}</option>`).join('')}</select></label>
    ${kind==='equipment'?'<label class="field">最高需求等級<select id="level"><option value="">全部等級</option><option value="10">Lv.10 以下</option><option value="30">Lv.30 以下</option><option value="70">Lv.70 以下</option><option value="120">Lv.120 以下</option></select></label>':'<label class="field">成功率<select id="rate"><option value="">全部成功率</option><option>10%</option><option>30%</option><option>60%</option><option>70%</option><option>100%</option></select></label>'}</div>
    <div class="results-meta"><span id="count"></span><a href="${source}" target="_blank" rel="noopener noreferrer">資料來源 ↗</a></div><div class="data-wrap"><table><thead><tr><th>名稱</th><th>部位</th><th>${kind==='equipment'?'等級':'成功率'}</th><th>主要屬性</th><th>NPC 商店</th></tr></thead><tbody id="rows"></tbody></table></div><div class="pagination"></div><section id="detail" class="detail" hidden></section>`;
  const query=root.querySelector('#query'),type=root.querySelector('#type'),extra=root.querySelector(kind==='equipment'?'#level':'#rate');
  let current=1;
  const filtered=()=>list.filter(item=>{
    const q=query.value.trim().toLocaleLowerCase();
    return (!q||item.name.toLocaleLowerCase().includes(q)||item.sourceName.toLocaleLowerCase().includes(q))&&
      (!type.value||item.type===type.value)&&
      (!extra.value||(kind==='equipment'?(item.level||0)<=Number(extra.value):item.name.includes(extra.value)));
  }).sort((a,b)=>(a.level||0)-(b.level||0)||a.name.localeCompare(b.name,'zh-Hant'));
  const render=()=>{
    const rows=filtered();const max=Math.max(1,Math.ceil(rows.length/20));current=Math.min(current,max);
    root.querySelector('#count').textContent=`符合 ${number(rows.length)} 筆 · 顯示第 ${current} 頁`;
    root.querySelector('#rows').innerHTML=rows.length?rows.slice((current-1)*20,current*20).map(item=>`<tr><td><button class="item-link" data-id="${item.id}">${esc(item.name)}</button></td><td><span class="pill">${esc(typeName(item.type))}</span></td><td>${kind==='equipment'?esc(level(item.level)):esc(item.name.match(/(10|30|60|70|100)%/)?.[0]||'—')}</td><td>${esc(stats(item.stats))}</td><td>${item.acquisition.npcs.length?`${item.acquisition.npcs.length} 間`:'—'}</td></tr>`).join(''):'<tr><td colspan="5" class="empty">找不到符合的物品，試試其他名稱或篩選條件。</td></tr>';
    root.querySelectorAll('[data-id]').forEach(button=>button.onclick=()=>showDetail(list.find(item=>item.id===button.dataset.id)));
    pagination(rows.length,current,p=>{current=p;render();window.scrollTo({top:0,behavior:'smooth'});});
  };
  for(const input of [query,type,extra])input.addEventListener(input===query?'input':'change',()=>{current=1;render();});
  render();const id=new URLSearchParams(location.search).get('id');if(id){const item=list.find(x=>x.id===id);if(item)showDetail(item);}
}
function materialsPage(world){
  const list=Object.entries(world.items).filter(([,item])=>item.slot==='material').map(([id,item])=>({id,...item,sources:dropSources(world,id)}))
    .sort((a,b)=>(b.sources.length>0)-(a.sources.length>0)||(a.sources[0]?.monster.level??999)-(b.sources[0]?.monster.level??999)||a.name.localeCompare(b.name,'zh-Hant'));
  root.innerHTML=head('ETC ITEMS','雜物',`怪物掉落的雜物與 NPC 收購價。文字版 v${world.version} 撿到雜物會自動依收購價換成楓幣（可在遊戲「設定」關閉）。`)+
    '<div class="notice">收購價採經典楓之谷 GMS v83 的 NPC 收購價：阿泰爾沒有公開收購價，這是目前最接近的參考，尚待遊戲內核對。任務用品在經典資料中收購價為 1 楓幣，照實採用。掉率是文字版設定，並非 Artale 官方掉率。</div>'+
    `<div class="tools"><label class="field">搜尋雜物<input id="material-query" type="search" placeholder="輸入雜物或怪物名稱"></label><label class="field">範圍<select id="material-scope"><option value="dropped">文字版會掉落</option><option value="">全部 ${list.length} 種</option></select></label></div>
    <div id="detail" class="detail" hidden></div><div class="results-meta"><span id="count"></span></div>
    <div class="data-wrap"><table><thead><tr><th>雜物</th><th>收購價</th><th>哪些怪會掉</th></tr></thead><tbody id="rows"></tbody></table></div>`;
  const query=root.querySelector('#material-query'),scope=root.querySelector('#material-scope');
  const show=item=>{const panel=root.querySelector('#detail');panel.hidden=false;
    panel.innerHTML=`<button class="close" aria-label="關閉雜物詳情">關閉</button><div class="eyebrow">雜物詳情</div><h2>${esc(item.name)}</h2>
      <div class="detail-grid"><div><small>賣給 NPC</small><p>${number(item.sellPrice)} 楓幣</p></div><div><small>價格來源</small><p>${esc(item.priceSource)}</p></div></div>
      <h3>文字版哪些怪會掉</h3>${dropTable(world,item.id)}`;
    panel.querySelector('.close').onclick=()=>{panel.hidden=true;history.replaceState(null,'',location.pathname);};
    history.replaceState(null,'',`?id=${encodeURIComponent(item.id)}`);panel.scrollIntoView({behavior:'smooth',block:'start'});};
  const render=()=>{const q=query.value.trim();const rows=list.filter(item=>(!scope.value||item.sources.length)&&(!q||item.name.includes(q)||item.sources.some(source=>source.monster.name.includes(q))));
    root.querySelector('#count').textContent=`符合 ${number(rows.length)} 種`;
    root.querySelector('#rows').innerHTML=rows.map(item=>`<tr><td><button class="item-link" data-id="${esc(item.id)}">${esc(item.name)}</button></td><td>${number(item.sellPrice)} 楓幣</td><td>${item.sources.length?item.sources.map(source=>`${esc(source.monster.name)} Lv.${source.monster.level} ${percent(source.chance)}`).join('<br>'):'<span class="muted">文字版尚未掉落</span>'}</td></tr>`).join('')||'<tr><td colspan="3" class="empty">找不到雜物。</td></tr>';
    root.querySelectorAll('[data-id]').forEach(button=>button.onclick=()=>show(list.find(item=>item.id===button.dataset.id)));};
  query.oninput=render;scope.onchange=render;render();
  const id=new URLSearchParams(location.search).get('id');const target=list.find(item=>item.id===id);if(target){if(!target.sources.length)scope.value='';render();show(target);}
}
function shopsPage(catalog){
  const byId=new Map([...catalog.equipment,...catalog.scrolls].map(x=>[x.id,x]));
  root.innerHTML=head('MERCHANT DIRECTORY','NPC 商店','按 NPC 查詢圖鑑記錄的裝備、卷軸售價；同一件物品可能由多間商店販售。')+
    '<div class="notice">這裡是來源圖鑑的 NPC 售價資料。Telegram 遊戲的單一商店只賣原作 NPC 有賣的裝備、卷軸、彈藥與藥水；其他只能打怪取得。</div><div class="tools"><label class="field">搜尋 NPC<input id="shop-query" type="search" placeholder="例如 山姆、卡爾"></label><label class="field">選擇商店<select id="shop-select"><option value="">請選擇 NPC</option></select></label></div><div class="results-meta" id="shop-meta"></div><div class="data-wrap"><table><thead><tr><th>商品</th><th>類別／部位</th><th>價格</th></tr></thead><tbody id="offers"></tbody></table></div><div class="pagination"></div><section id="detail" class="detail" hidden></section>';
  const query=root.querySelector('#shop-query'),select=root.querySelector('#shop-select'),meta=root.querySelector('#shop-meta');let current=1;
  const fill=()=>{const term=query.value.trim().toLocaleLowerCase();const matching=catalog.shops.filter(x=>x.name.toLocaleLowerCase().includes(term));select.innerHTML='<option value="">請選擇 NPC</option>'+matching.map(shop=>`<option value="${shop.id}">${esc(shop.name)} · ${shop.offers.length} 件</option>`).join('');if(!matching.some(x=>x.id===select.value))select.value=matching.length===1?matching[0].id:'';meta.textContent=`${matching.length} 間符合的 NPC 商店`;render();};
  const render=()=>{const shop=catalog.shops.find(x=>x.id===select.value);const offers=shop?[...shop.offers].sort((a,b)=>a.price-b.price):[];const max=Math.max(1,Math.ceil(offers.length/20));current=Math.min(current,max);
    meta.textContent=shop?`${shop.name} · ${number(offers.length)} 件商品`:`${catalog.shops.length} 間有售價資料的 NPC 商店`;
    root.querySelector('#offers').innerHTML=shop?offers.slice((current-1)*20,current*20).map(offer=>{const item=byId.get(offer.itemId);return `<tr><td><button class="item-link" data-id="${item.id}">${esc(item.name)}</button></td><td>${esc(typeName(item.type))}</td><td>${number(offer.price)} 楓幣</td></tr>`;}).join(''):'<tr><td colspan="3" class="empty">選擇 NPC 後顯示販售商品。</td></tr>';
    root.querySelectorAll('[data-id]').forEach(button=>button.onclick=()=>showDetail(byId.get(button.dataset.id)));
    pagination(offers.length,current,p=>{current=p;render();});
    if(shop)history.replaceState(null,'',`?npc=${encodeURIComponent(shop.id)}`);
  };
  query.oninput=()=>{current=1;fill();};select.onchange=()=>{current=1;render();};fill();
  const npc=new URLSearchParams(location.search).get('npc');if(npc&&catalog.shops.some(x=>x.id===npc)){select.value=npc;render();}
}
function home(world){const version=world?.version;const materials=world?Object.values(world.items).filter(item=>item.slot==='material').length:0;root.innerHTML=`<section class="hero"><div class="hero-content"><div class="eyebrow">TEXT ADVENTURE · GAME WIKI${version?` · 遊戲 v${esc(version)}`:''}</div><h1>每一次冒險，<br>都有資料可查。</h1><p>文字版阿泰爾的裝備、卷軸、雜物收購價、NPC 商店與世界資訊，整理成適合手機查閱的冒險資料站。</p><div class="hero-actions"><a class="btn btn-primary" href="equipment.html">查裝備圖鑑 →</a><a class="btn btn-secondary" href="guide.html">閱讀新手指南</a><a class="btn btn-secondary" href="https://t.me/+BbiLPFcTQkA3YzY1" target="_blank" rel="noopener noreferrer">🏹 加入弓箭手村</a>${version?`<a class="btn btn-secondary" href="changelog.html#v${esc(version.replace(/\./g,'-'))}">v${esc(version)} 更新內容</a>`:''}</div></div></section>
  <section class="stats-strip" aria-label="資料總覽"><div class="stat-box"><strong>1,840</strong><span>裝備資料</span></div><div class="stat-box"><strong>274</strong><span>卷軸資料</span></div><div class="stat-box"><strong>${world?number(materials):'—'}</strong><span>雜物與收購價</span></div><div class="stat-box"><strong>${world?number(Object.keys(world.maps).length):'168'}</strong><span>目前文字版地圖</span></div></section>
  <section class="section"><div class="section-head"><div><div class="eyebrow">EXPLORE</div><h2>冒險資料</h2></div><p>從一件裝備，查到它的屬性與取得來源。</p></div><div class="grid">
  ${card('🛡️','裝備圖鑑','依部位、等級與名稱尋找武器防具，查看能力和來源。','equipment.html')}
  ${card('📜','卷軸圖鑑','查強化部位、成功率、屬性與來源。','scrolls.html')}
  ${card('💰','雜物','查雜物的 NPC 收購價、哪些怪會掉與掉率。','materials.html')}
  ${card('🏪','NPC 商店','依 NPC 查裝備與卷軸的資料庫售價。','shops.html')}
  ${card('🗺️','地圖','查看已開放地圖、進入等級與怪物組成。','maps.html')}
  ${card('👾','怪物','了解目前文字版怪物的等級、經驗與掉落。','monsters.html')}
  ${card('🌟','職業','查看目前可選的一轉職業與裝備方向。','jobs.html')}
  ${card('🎓','畢業裝備','各職業畢業裝穿什麼、衝什麼卷、去哪裡拿。','endgame.html')}
  ${card('📅','開發路線','從第一代完整體驗到四轉，查看每版功能與驗收目標。','roadmap.html')}</div></section>
  <section class="notice"><strong>資料範圍：</strong>圖鑑採公開玩家社群資料快照；地圖、怪物、職業採目前 Telegram 文字版遊戲資料。圖鑑裝備及卷軸都能在 Telegram 遊戲取得：原作 NPC 有賣的在商店買，其他打怪掉落；部分特殊屬性仍未加入戰鬥公式。<a href="changelog.html">查看更新紀錄與來源 →</a></section>`;}
function guide(){root.innerHTML=head('START HERE','新手指南','進入野外後自動狩獵；機器人每分鐘在背景結算，不必按更新。')+
  `<div class="steps"><div class="step"><b>1</b><h3>建立角色</h3><p>開啟機器人並按「開始冒險」，確認初始能力。先選想走的職業與二轉方向，初心者的能力點就會照路線自動分配。</p></div><div class="step"><b>2</b><h3>換圖與收集</h3><p>按「地圖」選大區、城鎮與詳細地圖；按「推薦練功地圖」會依目前武器、技能、補給估算最快又不虧錢的練功點。打開面板可查看經驗、楓幣、材料、裝備與卷軸掉落。</p></div><div class="step"><b>3</b><h3>轉職</h3><p>法師 Lv.8、其他職業 Lv.10 一轉；Lv.30 二轉（五種職業共十二條線）。轉職介紹會先列出要準備的入門武器與彈藥費用；轉職後沒有能用的武器時會自動買最便宜的原作 NPC 武器。</p></div></div>
  <div class="prose section"><h2>自動設定</h2><p>能力值與技能配點、掛機選招預設開啟，可在「設定」各別關閉、改在角色頁手動配。還沒選二轉方向時，主屬性相同的職業（劍士、法師、弓箭手、盜賊）照常自動配點；海盜的打手與槍手主屬性不同，要先選方向。</p><h2>群攻與增益</h2><p>群攻技能（例如劍氣縱橫、雷閃電鳴、炸彈箭）一場同時遇到並打倒多隻。增益學會就自動維持，照持續時間到期才重放並扣 MP，技能頁可個別關掉；減益（詛咒術、降魔咒、緩速術、炸彈投擲）每場對怪物施放。屬性弱點 1.5 倍、抗性一半；中毒持續扣血、冰凍與昏迷的怪不反擊。</p><h2>打怪速度與背景結算</h2><p>每場＝找怪約 8 秒（移動速度與跳躍越高越快）＋出手次數×每下時間（依武器攻速，快速系列增益再快 1～2 段）。機器人開著時每分鐘在背景結算，不必按「更新」；停機期間重開後最多補算 8 小時。</p><h2>停下時自動續練</h2><p>陣亡、沒錢補藥水或打不倒而停下時，休息 10 分鐘補滿 HP／MP，自動到不用搭船的推薦地圖繼續，並私訊告訴你；可在「設定」關閉。手動暫停或走進城鎮不會自動出發。</p><h2>藥水與補給</h2><p>HP、MP 藥水少於 5 瓶時自動補貨；「自動」會依 HP／MP 上限改買橘色、白色或活力藥水，也可指定種類。特殊藥水、超級藥水只能打怪取得，一般藥水喝完又買不到才會喝。</p><h2>商店與掉落</h2><p>商店只賣原作 NPC 有賣的裝備、卷軸、彈藥與藥水，其他要打怪取得。掉什麼照玩家圖鑑，裝備、卷軸、藥水的機率照經典楓之谷 v83 參考資料（阿泰爾未公開掉率）。雜物撿到就依收購價換成楓幣，收購價見<a href="materials.html">雜物頁</a>。</p><h2>卸下裝備</h2><p>在「裝備欄」選擇部位，按「卸下目前裝備」即可把同一件裝備放回背包，浮動素質、衝卷紀錄與剩餘格完整保留；四個戒指可分別卸下。背包需有1個空格，滿包時會拒絕卸裝。卸下武器會暫停狩獵，換圖不會自動續練；穿回武器後再按「恢復狩獵」。裝備強化頁也有卸裝入口。</p><h2>裝備強化</h2><p>先穿上要強化的裝備，從道具或裝備欄按「裝備強化」，選定部位後只列出背包內適用卷軸，並標示目前職業的攻擊提升選項。背包內文與物品按鈕也會顯示部位、可用職業及等級。</p><p>安全卷軸可預覽單張、連衝3張、衝滿或失敗即停，確認前顯示張數；最多使用剩餘格數與背包張數，每次至多20張。成功、失敗都會逐張記錄，結果留在原裝備頁，可再衝1張。黑卷、純白逐張確認，不會自動換卷或補純白。</p><p>確認只適用於選定的那件裝備，5分鐘有效且只能使用一次；換裝或強化狀態改變須重新確認。黑卷失敗時50%毀損；純白成功10%，失敗時18%毀損，每張總爆裝率16.2%（文字版暫定規則）。純白只恢復失敗格，使用前務必確認目標與風險。卷軸機率與能力加成維持原設定。</p><h2>私訊通知</h2><p>可以轉職、狩獵停止或自動續練、打到裝備或卷軸、遇到野王、每升 5 級時會私訊你；可以轉職卻一直沒轉時最多每 24 小時提醒一次（按過「稍後決定」就不提醒）。每項都能在「設定」關閉。</p><h2>野王與社群</h2><p>主畫面不顯示即時野王位置，只有在野外實際遇到才會發現。群組管理員在遊戲群組傳 /community_panel 開啟後，群組會收到野王目擊、轉職、打到卷軸與擊敗野王的公告。</p><h2>150～170等邊境高地</h2><p>在地圖選擇「神木村」，可進入補給前線、符文高地與封印遺跡。遠征營地是安全區，其他6張圖的怪物等級為150、154、158、162、166、170；建議等級僅供參考，從神木村免費抵達。補給線／廢棄兵站可刷16類武器攻擊或魔力60%卷及備用武器，中段可刷披風、套服、耳環主屬性60%，後段可刷12職業核心20／30技能書。三飛閃等技能仍須先取得原有解鎖書才能學。</p><p>邊境高地的地圖、怪物、數值、掉落配置與路線均為文字版自訂。卷軸沿用既有稀有度，技能書每本0.03%，各物品獨立抽取且沒有保底；實際效率取決於裝備、命中、技能、增益與補給。可先看「推薦練功地圖」再決定掛哪裡。</p><h2>目前開放範圍</h2><p>一轉至四轉、神木村與時間神殿等練功地區、同地圖自動組隊、玩家交易與拍賣均已開放。實際地圖見<a href="maps.html">地圖頁</a>；已開放與待補功能以<a href="roadmap.html">開發路線</a>及<a href="changelog.html">更新紀錄</a>為準。</p></div>`;}
function mapsPage(world){const entries=Object.entries(world.maps),regions=world.regions||[{id:'island',name:'楓之島',districts:[]},{id:'victoria',name:'維多利亞島',districts:[]}],regionName=id=>regions.find(r=>r.id===id)?.name||id,mapName=id=>world.maps[id]?.name||id,ships=world.ships||[];
  const shipOf=(a,b)=>ships.find(s=>s.docks&&s.docks.includes(mapName(a))&&s.docks.includes(mapName(b))),routeText=route=>route.map((id,i)=>{const s=i&&shipOf(route[i-1],id);return (s?`<span class="pill">🚢 ${esc(s.name)}${s.price?` · ${s.price.toLocaleString('en-US')} 楓幣`:''}</span> → `:'')+esc(mapName(id));}).join(' → ');
  const featured=world.featuredRoute?`<div class="notice"><strong>原作路線：楓之島 → 天空之城（${world.featuredRoute.length-1} 段）</strong><br>${routeText(world.featuredRoute)}</div>`:'';
  const fares=ships.filter(s=>s.price).map(s=>`${esc(s.name)} ${s.price.toLocaleString('en-US')} 楓幣`).join('、');
  root.innerHTML=head('WORLD ATLAS','地圖','目前 Telegram 文字版遊戲的地圖。點區域可縮小範圍；名稱與怪物組成以遊戲資料為準。')+
  `<div class="notice">所有地圖可自由前往；等級只是建議。跨島不用等船、直接到達，只收船票（原作每 10 分鐘一班，票價照經典楓之谷）${fares?`：${fares}`:''}。下方「原作路線」照經典楓之谷 v83 的傳送點，從所屬城鎮的主城算起，只供參考；標示文字版自訂的邊境高地使用自訂連接路線。</div>${featured}<div class="tools"><label class="field">區域<select id="region"><option value="">全部區域</option>${regions.map(r=>`<option value="${r.id}">${esc(r.name)}</option>`).join('')}</select></label><label class="field">城鎮<select id="district"><option value="">全部城鎮</option>${regions.flatMap(r=>r.districts.map(d=>`<option value="${d.id}" data-region="${r.id}">${esc(d.name)}</option>`)).join('')}</select></label><label class="field">搜尋地圖<input id="map-query" type="search" placeholder="輸入地圖或怪物名稱"></label></div><div class="list-cards" id="map-list"></div>`;
  const render=()=>{const reg=root.querySelector('#region').value,district=root.querySelector('#district').value,q=root.querySelector('#map-query').value.trim();root.querySelector('#map-list').innerHTML=entries.filter(([,map])=>(!reg||map.region===reg)&&(!district||map.district===district)&&(!q||map.name.includes(q)||map.monsters.some(id=>world.monsters[id]?.name.includes(q)))).map(([,map])=>`<article class="list-card"><span class="pill">${esc(regionName(map.region))}</span><h3>${esc(map.name)}</h3><p>建議等級 ${esc(level(map.minLevel))} · ${map.monsters.length?map.monsters.map(id=>esc(world.monsters[id]?.name||id)).join('、'):'安全區'}${map.fieldBoss?' · 👑 '+esc(world.fieldBosses[map.fieldBoss]?.name):''}</p>${map.lootHint?`<p>🎁 ${esc(map.lootHint)}</p>`:""}${map.custom?`<p class="muted">文字版自訂區域：地圖、怪物、數值與掉落配置皆為自訂。</p>`:""}${map.shops?`<p>🏪 ${map.shops.map(n=>`${esc(n.type)}：${esc(n.name)}${n.place?`（${esc(n.place)}）`:''}`).join('、')}</p>`:''}${map.route?`<p class="muted">🧭 ${map.custom?"文字版路線":"原作路線"}：${routeText(map.route)}</p>`:''}</article>`).join('')||'<p class="muted">找不到符合的地圖。</p>';};root.querySelector('#region').onchange=()=>{root.querySelector('#district').value='';render();};root.querySelector('#district').onchange=()=>{const option=root.querySelector('#district').selectedOptions[0];if(option?.dataset.region)root.querySelector('#region').value=option.dataset.region;render();};root.querySelector('#map-query').oninput=render;render();}
function monstersPage(world){const entries=Object.entries(world.monsters).sort((a,b)=>a[1].level-b[1].level);root.innerHTML=head('BESTIARY','怪物','目前文字版遊戲已放入的普通怪物。數值含試作設定，與阿泰爾正式版不一定一致。')+
  '<div class="notice">v0.12.32：有經典 v83 魔攻資料的怪物，文字版暫定物理／魔法交替反擊（第一下物理），分別由物防／魔防減傷；威力沿用既有設定。查無資料者維持物理；邊境高地怪物則自訂為物理／魔法交替。這不是原作的施放頻率，每點防禦減傷 0.5 也是文字版暫定規則。</div>'+
  '<div class="notice">掉什麼對照玩家圖鑑；裝備、卷軸、藥水的機率照經典楓之谷 v83 參考資料（HeavenMS），阿泰爾未公開官方掉率；雜物掉率是文字版暫定值。邊境高地的怪物與掉落配置為文字版自訂，卷軸仍使用既有稀有度規則。</div><div class="tools"><label class="field">搜尋怪物<input id="monster-query" type="search" placeholder="輸入怪物或掉落名稱"></label></div><div class="data-wrap"><table><thead><tr><th>怪物</th><th>等級</th><th>HP</th><th>EXP</th><th>文字版掉落池</th></tr></thead><tbody id="monster-rows"></tbody></table></div>';
  const splitNote=(id,m)=>{const parent=splitParent(world,id);return m.split?`<br><span class="muted">打倒後分裂成 ${m.split.count} 隻${esc(world.monsters[m.split.id]?.name||'')}</span>`:parent?`<br><span class="muted">不會自己出現，由${esc(parent[1].name)}打倒後分裂（每隻 ${parent[1].split.count} 隻）</span>`:'';};
  const drops=monster=>(monster.drops||[]).map(drop=>`${world.items[drop.id]?.name||drop.id} ${percent(drop.chance)}`);
  const dropLinks=monster=>(monster.drops||[]).map(drop=>{const label=esc(`${world.items[drop.id]?.name||drop.id} ${percent(drop.chance)}`);const url=itemPage(world,drop.id);return url?`<a href="${url}">${label}</a>`:label;});
  const render=()=>{const q=root.querySelector('#monster-query').value.trim();root.querySelector('#monster-rows').innerHTML=entries.filter(([,m])=>!q||m.name.includes(q)||drops(m).some(name=>name.includes(q))).map(([id,m])=>`<tr><td><strong>${esc(m.name)}</strong>${m.custom?"<br><span class=\"muted\">文字版自訂</span>":""}${splitNote(id,m)}</td><td>${m.level}</td><td>${number(m.hp)}</td><td>${number(m.exp)}</td><td>${dropLinks(m).join('<br>')||'未列出'}</td></tr>`).join('')||'<tr><td colspan="5" class="empty">找不到怪物。</td></tr>';};root.querySelector('#monster-query').oninput=render;render();}
const bookSource=(world,skill,kind)=>{const first=(world.skills||[]).find(entry=>entry.tier===4&&entry.name===skill.name);return world.skillBooks?.sources?.[`book_${first?.id}_${kind}`];};
const textBooks=(world,skill)=>{if(world.skillBooks?.sources)return[['unlock','解鎖書'],['20','20 級書'],['30','30 級書']].filter(([kind])=>bookSource(world,skill,kind)).map(([,label])=>label);const z=world.skillBooks?.zakum;if(!z)return[];return[['unlock','解鎖書'],['20','20 級書'],['30','30 級書']].filter(([kind])=>(z[kind]||[]).includes(skill.name)).map(([,label])=>label);};
const bookText=books=>[books.unlock?`解鎖書：${books.unlock}`:'',books[20]?`20 級書：${books[20]}`:'',books[30]?`30 級書：${books[30]}`:''].filter(Boolean).map(esc).join('／');
function skillNotes(world,skill){const unavailable=skill.inert?"<br><strong>文字版尚未實作：暫停加點與使用技能書，已投入SP可在技能頁免費退回。</strong>":"";const mp=skill.kind==='support'?`<br>MP：Lv.1 ${skill.firstMp}／Lv.${skill.maxLevel} ${skill.maxMp}`:'';const prerequisites=Object.entries(skill.prerequisite||{}).map(([id,level])=>`${esc(world.skills.find(entry=>entry.id===id)?.name||id)} Lv.${level}`).join('、');const cap=skill.masterLevel===undefined||skill.masterLevel>=skill.maxLevel?'':skill.masterLevel?`<br>文字版：沒技能書最高 Lv.${skill.masterLevel}`:'<br>文字版：要解鎖書才能學';const own=textBooks(world,skill);const ownText=skill.books?(own.length?`<br>文字版拿得到：${own.join('、')}（<a href="skillbooks.html">在哪打</a>）`:'<br>文字版拿得到：這招的書還沒有來源'):'';const books=skill.books?`<br>技能書（阿泰爾）：${bookText(skill.books)}`:'';return unavailable+mp+(prerequisites?`<br>前置：${prerequisites}`:'')+cap+ownText+books;}
// 突襲王（殘暴炎魔、闇黑龍王）：固定時間出現，打倒必掉 1 本四轉技能書（數字從遊戲資料帶出來）。
// 遊戲資料沒有的說明（武器池叫什麼、不能交易的裝備）寫在這裡。
const RAID_NOTES={zakum:{pool:'炎魔武器 1 把'},horntail:{pool:'龍系列裝備或武器 1 件',note:'闇黑龍王項鍊、闇黑龍王的翅膀不能交易、不能上拍賣場。'}};
// 每隻突襲王掉哪些書：v0.12.22 起來源寫在 sources[].raids；舊資料只有炎魔清單。
const raidBooks=(world,id)=>{const sources=world.skillBooks?.sources;if(!sources)return id==='zakum'?world.skillBooks?.zakum||{}:{};const out={};for(const source of Object.values(sources))if((source.raids||[]).includes(id))(out[source.kind]||=[]).push(source.name);return out;};
const hourText=h=>h>=18?`晚上 ${h-12} 點`:h>=12?`下午 ${h===12?12:h-12} 點`:`早上 ${h} 點`;
// 有部位的突襲王（炎魔八隻手臂，遊戲 v0.12.49）：手臂血量、屬性、壞手效果、本體階段。
const ELEMENT_TEXT={F:'火',I:'冰',L:'雷',S:'毒',H:'聖',D:'暗'};
const elementText=el=>[...String(el||'').matchAll(/([A-Z])(\d)/g)].map(([,e,l])=>`${{1:'免疫',2:'抗',3:'弱'}[l]||''}${ELEMENT_TEXT[e]||e}`).join('');
function raidParts(boss){if(!boss.parts?.length)return'';const num=v=>v.toLocaleString('en-US'),pct=v=>`${Math.round(v*100)}%`,armHp=boss.parts.reduce((s,p)=>s+p.hp,0);
  const arms=boss.parts.map(p=>`${esc(p.name)} ${num(p.hp)}${p.elements?`（${elementText(p.elements)}）`:''}${p.effectText?`：<strong>${esc(p.effectText)}</strong>`:''}`).join('<br>');
  const order=(boss.partOrder||[]).map(key=>esc((boss.parts.find(p=>p.key===key)?.name||key).replace('手臂','')));
  const phases=(boss.phases||[]).map((ph,i)=>`${esc(ph.name)}（本體 ${i?`${pct(ph.from)} 以下`:'滿血起'}）${[ph.seal?`封印 ${pct(ph.seal)}`:'',ph.blackWater?`黑水（每場一定挨一下最大 HP ${pct(ph.blackWater)}）`:''].filter(Boolean).join('、')||'一般反擊'}`).join('；');
  return `<p><strong>先打八隻手臂，全倒本體才能打。</strong>手臂合計 ${num(armHp)}、本體 ${num(boss.hp)}。群攻一次可以打好幾隻手臂（最多 6 隻），自動照壞手優先打：${order.join('→')}。壞手活著時，在王房的每個人每場都會吃到效果，打掉就消失：<br>${arms}</p>`+
    `<p>本體分三階段：${phases}。封印時這場只能普通攻擊；解法依序是同地圖主教的「聖盾護鎧」（直接擋下）、「楓葉淨化」（冷卻 10 分鐘）、萬能療傷藥（商店有賣，身上不到 5 瓶時到王房會自動補到 20 瓶）。</p>`+(boss.quiz?`<p><strong>選擇題機制殺：</strong>打的時候每人每 15 分鐘會收到一題私訊（第一題在第一次打到後 1～15 分鐘內），一半是看招判斷（黑水、手臂砸地、火柱、閃電、誘惑…選對怎麼躲），一半是一般常識題。答錯或 10 分鐘沒作答就被機制殺：扣經驗、自動回到進王房前的地圖，這隻打倒前不能再進，打倒時也不分經驗和掉寶（排行標 💀）。作答前王被打倒或你離開王房，題目作廢。</p>`:'');}
function raidSection(world,id){const boss=world.fieldBosses?.[id],books=world.skillBooks;if(!boss?.bookDrop||!books)return'';const pct=v=>`${Math.round(v*100)}%`,num=v=>v.toLocaleString('en-US'),name=id=>esc(world.items?.[id]?.name||id),map=world.maps?.[boss.map],lv=map?.levelRequired||boss.level;const weekly=Number.isInteger(boss.weekday),notes=RAID_NOTES[id]||{};const list=raidBooks(world,id),total=Object.values(list).flat().length;const drops=(boss.drops||[]).map(drop=>`${name(drop.id)} ${pct(drop.chance)}`).join('、');const supplies=(boss.supplies||[]).map(s=>`${name(s.id)} ${s.min}～${s.max} 個`).join('、');
  return `<div class="prose section"><h2>${esc(boss.name)}（Lv.${boss.level}）</h2><p>${weekly?`每週${'日一二三四五六'[boss.weekday]}`:'每天'}${hourText(boss.dailyHour)}（台灣時間）在「${esc(map?.name||'')}」出現，${weekly?'一週一隻':'一天一隻'}；Lv.${lv} 以上能進，王房沒有小怪。${boss.parts?.length?`八隻手臂＋本體 HP 合計 ${num(boss.hp+boss.parts.reduce((s,p)=>s+p.hp,0))}`:`HP ${num(boss.hp)}`} 全服共用，人在王房每分鐘自動打一場；沒打倒的話，血量和傷害紀錄保留到打倒為止，打倒後等下一次出現時間。出現時會私訊 Lv.${lv} 以上的玩家，群組「野王情報」也會公告。</p>${raidParts(boss)}` +`<p>打倒時，${boss.lootShare === 0 ? '有造成傷害的玩家（不設傷害比例門檻）' : '累計傷害達 ' + pct(boss.lootShare) + ' 的人'}各自抽：<strong>必拿 1 本四轉技能書</strong>（下面 ${total} 本隨機，常會拿到別職業的書）${supplies?`、<strong>必拿</strong>${supplies}`:''}、${drops}${boss.weaponPool?.length?`、${notes.pool||'武器 1 把'} ${pct(boss.weaponChance)}（${boss.weaponPool.map(name).join('、')}）`:''}、純白卷軸 10%。${boss.mesoBag?`楓幣袋 ${num(boss.mesoBag[0])}～${num(boss.mesoBag[1])} 給傷害第一名；`:''}${boss.parts?.length?`本體經驗 ${num(boss.exp)} 打倒時照全場傷害比例分；手臂經驗合計 ${num(Math.round(boss.parts.reduce((s,p)=>s+p.hp,0)*(boss.partExpPerHp||0)))}，每隻手被打掉時照打這隻手的傷害比例分。`:`經驗 ${num(boss.exp)} 照每個人的傷害比例分。`}${notes.note?esc(notes.note):''}</p>` +`<p>${[['20','20 級書'],['30','30 級書'],['unlock','解鎖書']].filter(([kind])=>list[kind]?.length).map(([kind,label])=>`${label}：${list[kind].map(esc).join('、')}`).join('<br>')}${id==='zakum'&&books.custom?.some(n=>list.unlock?.includes(n))?`（${books.custom.map(esc).join('、')}的解鎖書阿泰爾查不到來源，文字版放在炎魔）`:''}</p></div>`;}
function raidSections(world){const books=world.skillBooks,pct=v=>`${Math.round(v*100)}%`;const html=Object.keys(world.fieldBosses||{}).map(id=>raidSection(world,id)).join('');if(!html)return'';
  return html+`<div class="prose section"><p>技能書用法：在道具「消耗」點書再按「使用技能書」。20 級書要技能 Lv.${books.needLevel[20]} 以上、成功率 ${pct(books.success[20])}；30 級書要先用過 20 級書、技能 Lv.${books.needLevel[30]} 以上、成功率 ${pct(books.success[30])}；失敗書會消耗。解鎖書必定成功（學會到 Lv.10）。解鎖書、20／30 級技能書都可以交易、上拍賣場。</p></div>`;}
function jobsPage(world){const intros=world.jobIntros||{},jobs=world.jobs,icons={beginner:'🍁',warrior:'⚔️',magician:'✨',bowman:'🏹',thief:'🗡️',pirate:'⚓',fighter:'🪓',page:'🛡️',spearman:'🔱',fire_poison:'🔥',ice_lightning:'❄️',cleric:'✝️',hunter:'🏹',crossbowman:'🎯',assassin:'🥷',bandit:'🗡️',brawler:'👊',gunslinger:'🔫'},kinds={passive:'被動',support:'增益',debuff:'減益'};
  const below=id=>[id,...Object.keys(jobs).filter(child=>jobs[child].parent===id).flatMap(below)];
  const order=['beginner',...Object.keys(jobs).filter(id=>id!=='beginner'&&!jobs[id].tier).flatMap(below)];
  const requirement=(id,job)=>id==='beginner'?'初始職業':job.tier===4?`${esc(jobs[job.parent].name)} Lv.120，交英雄五角勳章＋英雄星型墜飾`:job.tier===3?`${esc(jobs[job.parent].name)} Lv.70，消耗 1 顆黑暗水晶`:job.tier===2?`${esc(jobs[job.parent].name)} Lv.30`:id==='magician'?'Lv.8':'Lv.10';
  const bookRows=(world.skills||[]).filter(skill=>skill.books&&(skill.books.unlock||skill.masterLevel<skill.maxLevel));
  const usable=(skill,id)=>skill.jobs?skill.jobs.includes(id):skill.job===id;
  const skillText=skill=>skill.kind?`<p><strong>${esc(skill.name)}</strong> · ${kinds[skill.kind]||'輔助'} · Lv.${skill.maxLevel}<br>${esc(skill.description||'')}${skillNotes(world,skill)}</p>`:`<p><strong>${esc(skill.name)}</strong> · ${esc(skill.weapons.map(typeName).join('、'))}${skill.targets?` · 一次 ${skill.targets} 隻`:''}<br>Lv.1：${skill.hits} 段 × ${skill.firstPercent}%／MP ${skill.firstMp}${skill.firstHp?`／HP ${skill.firstHp}`:''}<br>Lv.${skill.maxLevel}：${skill.hits} 段 × ${skill.maxPercent}%／MP ${skill.maxMp}${skill.maxHp?`／HP ${skill.maxHp}`:''}${skill.description?`<br>${esc(skill.description)}`:''}${skillNotes(world,skill)}</p>`;
  root.innerHTML=head('CLASS GUIDE','職業','五種一轉、十二條二轉、三轉、四轉都已開放（Lv.30 二轉、Lv.70 三轉、Lv.120 四轉）。')+
  `<div class="notice">升級獲得 5 AP；每一轉的 SP 分開計算，之前各轉的技能與未用 SP 都會保留。三轉、四轉不送 AP。四轉的英雄五角勳章、英雄星型墜飾打野王噴火龍、格瑞芬多（傷害達 20% 必掉），或用 10 個祕密咒術書碎片＋500 萬楓幣換。多數四轉技能沒技能書最高 Lv.10，要解鎖書的招沒書學不到；技能書在殘暴炎魔、闇黑龍王、野王和神木村、時間神殿、水世界的怪身上掉，每本在哪打見<a href="skillbooks.html">技能書</a>頁。增益學會就自動維持、照持續時間重放；群攻技能一場同時打多隻。劍士、法師的二轉數值照阿泰爾資料站；弓箭手、盜賊、海盜照經典楓之谷，阿泰爾未證實。</div><div class="grid">${order.filter(id=>jobs[id]).map(id=>{const job=jobs[id];return `<article class="card"><span class="icon">${icons[id]||'⭐'}</span><h3>${esc(job.name)}</h3><p>${esc(intros[id]?.summary||'從楓之島出發的初心者。')}<br>轉職需求：${requirement(id,job)}<br>可用武器：${esc(job.weapon.map(typeName).join('、'))}</p>${(world.skills||[]).filter(skill=>usable(skill,id)).map(skillText).join('')}${job.tier>=2?`<p>之前各轉的技能也可繼續使用。</p>`:''}</article>`;}).join('')}</div>${raidSections(world)}<div class="prose section"><h2>四轉技能書（阿泰爾）</h2><p>阿泰爾的四轉技能沒有書最高 10 級，20、30 級要對應的技能書，有 7 招要解鎖書才能學。下面列出阿泰爾的來源（巴哈玩家整理，掉率阿泰爾未公開）；「文字版」欄是文字版現在拿得到的書，在哪打見<a href="skillbooks.html">技能書</a>頁。</p></div><div class="data-wrap"><table><thead><tr><th>技能</th><th>職業</th><th>解鎖書</th><th>20 級書</th><th>30 級書</th><th>文字版</th></tr></thead><tbody>${bookRows.map(skill=>`<tr><td>${esc(skill.name)}</td><td>${esc((skill.jobs||[skill.job]).map(id=>jobs[id]?.name||id).join('、'))}</td><td>${esc(skill.books.unlock||'—')}</td><td>${esc(skill.books[20]||'—')}</td><td>${esc(skill.books[30]||'—')}</td><td>${textBooks(world,skill).length?textBooks(world,skill).join('、'):'還沒有'}</td></tr>`).join('')}</tbody></table></div><p class="source-note">技能名稱參考 Artale 玩家資料；本網站數值取自目前 Telegram 文字版程式。打手、槍手的中文技能名對應是推定的。</p>`;}
function roadmapPage(plan){root.innerHTML=head('DEVELOPMENT ROADMAP','開發路線','依目前文字版程式區分已開放、部分完成與待開發功能；一轉至四轉均已開放。')+
  `<div class="notice"><strong>發布狀態：</strong>${esc(plan.status)}<br>本站的「第一代」指此文字版的一轉完整體驗；Artale 官方已有四轉，本頁不代表官方排程。</div>
  <section class="section"><div class="section-head"><div><div class="eyebrow">NOW</div><h2>目前做到哪裡</h2></div></div><ul class="roadmap-list">${plan.current.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></section>
  <section class="section"><div class="section-head"><div><div class="eyebrow">RULES</div><h2>開發原則</h2></div></div><ul class="roadmap-list">${plan.principles.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></section>
  <div class="section-head"><div><div class="eyebrow">MILESTONES</div><h2>功能階段與待辦</h2></div><p>階段編號不是遊戲版本號；未完成內容另行標示，不代表已排定發布日期。</p></div>
  <div class="roadmap-phases">${plan.phases.map(phase=>`<article class="roadmap-phase" id="v${esc(phase.id.replace('.','-'))}"><div class="roadmap-phase-head"><span class="roadmap-version">${esc(phase.id)}</span><div><span class="pill">${esc(phase.state)}</span><h2>${esc(phase.name)}</h2><p>${esc(phase.goal)}</p></div></div><h3>已完成與待補項目</h3><ul>${phase.features.map(x=>`<li>${esc(x)}</li>`).join('')}</ul><h3>驗證重點</h3><ul>${phase.acceptance.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></article>`).join('')}</div>
  <section class="section"><div class="section-head"><div><div class="eyebrow">RELEASE NOTES</div><h2>每次更新怎麼公告</h2></div></div><ul class="roadmap-list">${plan.releasePolicy.map(x=>`<li>${esc(x)}</li>`).join('')}</ul><p><a href="changelog.html">查看已發布的更新紀錄 →</a></p></section>
  <p class="source-note">本路線於 ${esc(plan.updated)} 同步，依目前遊戲程式與 ${plan.sources.map(source=>`<a href="${esc(source.url)}" target="_blank" rel="noopener noreferrer">${esc(source.name)}</a>`).join('、')}整理。尚未查核的數值不視為官方數值。</p>`;}
function gameChangelog(versions){
  const icons={'新增':'🆕','調整':'🔧','Bug 修正':'🐞','體驗優化':'✨'};
  return `<section class="section"><div class="section-head"><div><div class="eyebrow">GAME RELEASES</div><h2>遊戲版本</h2></div><p>Telegram 文字版的改版內容，遊戲「說明」頁標示目前版本。</p></div><div class="timeline">${versions.map(version=>`<article id="v${esc(version.version.replace(/\./g,'-'))}"><time>v${esc(version.version)} · ${esc(version.date)}</time><h2>${esc(version.title)}</h2>${Object.entries(version.sections).filter(([,lines])=>lines.length).map(([name,lines])=>`<h3>${icons[name]||''} ${esc(name)}</h3><ul>${lines.map(line=>`<li>${esc(line)}</li>`).join('')}</ul>`).join('')}</article>`).join('')}</div></section><div class="section-head"><div><div class="eyebrow">SITE HISTORY</div><h2>資料站紀錄</h2></div></div>`;
}
// 技能書：照四轉職業列出每本書在文字版哪裡打（來源、掉率從遊戲資料帶出來）。
function skillbooksPage(world){const jobs=world.jobs,sb=world.skillBooks||{},pct=v=>`${+(v*100).toFixed(2)}%`,kindName={unlock:'解鎖書','20':'20 級書','30':'30 級書'};
  const below=id=>[id,...Object.keys(jobs).filter(child=>jobs[child].parent===id).flatMap(below)];
  const fourth=Object.keys(jobs).filter(id=>id!=='beginner'&&!jobs[id].tier).flatMap(below).filter(id=>jobs[id].tier===4);
  const mapsOf=ids=>[...new Set(Object.values(world.maps||{}).filter(map=>ids.some(id=>map.monsters?.includes(id))).map(map=>map.name))];
  const raidsOf=source=>source.raids||(source.zakum?['zakum']:[]);
  const raidLine=id=>{const boss=world.fieldBosses?.[id];if(!boss)return null;const when=Number.isInteger(boss.weekday)?`每週${'日一二三四五六'[boss.weekday]}`:'每天';return `<strong>${esc(boss.name)}</strong>（${esc(world.maps?.[boss.map]?.name||'')}，${when}${hourText(boss.dailyHour)}出現，必掉 1 本、${Object.values(raidBooks(world,id)).flat().length} 本隨機）`;};
  const where=source=>[...raidsOf(source).map(raidLine).filter(Boolean),
    ...source.bosses.map(id=>{const boss=world.fieldBosses[id];return `野王 <strong>${esc(boss.name)}</strong>（${esc(world.maps?.[boss.map]?.name||'')}）每本 ${pct(sb.bossRate)}`;}),
    ...[...new Set(source.monsters.map(id=>world.monsters[id]?.name).filter(Boolean))].map(name=>{const ids=source.monsters.filter(id=>world.monsters[id]?.name===name),level=world.monsters[ids[0]].level;return `<strong>${esc(name)}</strong> Lv.${level}（${mapsOf(ids).map(esc).join('、')||'地圖未列'}）每本 ${pct(sb.mobRate)}`;})].join('<br>');
  const kindsOf=skill=>['unlock','20','30'].filter(kind=>skill.books[kind]&&!/^無/.test(skill.books[kind])&&(kind!=='unlock'||skill.masterLevel===0));
  const sections=fourth.map(jobId=>{const list=(world.skills||[]).filter(skill=>skill.tier===4&&skill.books&&(skill.jobs||[skill.job]).includes(jobId));
    const rows=list.flatMap(skill=>kindsOf(skill).map(kind=>{const source=bookSource(world,skill,kind);return `<tr><td>${esc(skill.name)}${skill.inert?"<br><strong>尚未實作：暫停用書，可保留或交易</strong>":""}</td><td>${kindName[kind]}</td><td>${source?where(source):`<span class="muted">還沒開放</span>（原作：${esc(skill.books[kind])}）`}</td></tr>`;}));
    return rows.length?`<div class="prose section"><h2>${esc(jobs[jobId].name)}</h2></div><div class="data-wrap"><table><thead><tr><th>技能</th><th>書</th><th>文字版在哪打</th></tr></thead><tbody>${rows.join('')}</tbody></table></div>`:'';}).join('');
  const opened=Object.keys(sb.sources||{}).length;
  root.innerHTML=head('SKILL BOOKS','技能書','四轉技能書在哪裡打、哪隻怪會掉，照職業排。')+
  `<div class="notice">四轉技能沒有書最高 Lv.10，20、30 級要對應的技能書，有 7 招要解鎖書才能學。掉書來源照阿泰爾（巴哈玩家整理）；掉率阿泰爾沒有公開，文字版用經典楓之谷的標準值：一般怪每本 ${pct(sb.mobRate||0)}、野王傷害達門檻（20%）的人每本各抽 ${pct(sb.bossRate||0)}，殘暴炎魔、闇黑龍王有造成傷害的玩家，在擊敗時必拿 1 本，不設傷害比例門檻。原作來源是拉圖斯、海怒斯或任務的書，遊戲裡還沒有這些來源，先標「還沒開放」（目前開放 ${opened} 本）。</div>`+
  `<div class="prose section"><p>用法：在道具「消耗」點書再按「使用技能書」。20 級書要技能 Lv.${sb.needLevel?.[20]??5} 以上、成功率 ${pct(sb.success?.[20]??0.7)}；30 級書要先用過 20 級書、技能 Lv.${sb.needLevel?.[30]??15} 以上、成功率 ${pct(sb.success?.[30]??0.5)}；失敗書會消耗。解鎖書必定成功（學會到 Lv.10）。解鎖書、20／30 級技能書都可以交易、上拍賣場。飛毒殺、挑釁這類兩個職業都有的招，同一本書兩邊都能用。</p></div>`+sections+
  `<p class="source-note">來源與掉率從目前 Telegram 文字版程式同步。拿到別職業的 20／30 級書可以賣或交易。</p>`;}
function changelog(versions=[]){root.innerHTML=head('VERSION HISTORY','更新紀錄','遊戲改版與資料站的改動記錄。每次新增來源或修正資料，都會標明範圍與時間。')+(versions.length?gameChangelog(versions):'')+
  `<div class="timeline"><article><time>2026-11-04 · 畢業裝備</time><h2>新增畢業裝備頁</h2><p>新增<a href="endgame.html">畢業裝備</a>頁：12 個四轉職業 Lv.170 打王用的畢業裝，每個部位穿什麼、衝什麼卷、去哪裡拿，套服和上衣＋下衣哪種好也一起比。資料由遊戲程式模擬算出，每次改版重算；遊戲裡有但拿不到的裝備另外列一區。</p></article></div>`+
  `<div class="timeline"><article><time>2026-11-02 · 突襲王</time><h2>補上闇黑龍王與技能書來源</h2><p><a href="jobs.html">職業</a>頁新增闇黑龍王一段（每週六晚上 8 點出現、HP、掉落、龍系列裝備與 13 本技能書），殘暴炎魔一段補上必拿的超級／特殊藥水與楓幣袋金額。修正<a href="skillbooks.html">技能書</a>頁自遊戲 v0.12.22 起沒顯示殘暴炎魔、闇黑龍王掉書來源的問題（只有王會掉的 25 本原本是空白）。</p></article></div>`+
  `<div class="timeline"><article><time>2026-10-28 · 技能書</time><h2>新增技能書頁</h2><p>新增<a href="skillbooks.html">技能書</a>頁，照四轉職業列出每本技能書在文字版哪裡打：哪隻怪、在哪張地圖、哪隻野王、掉率多少；還沒開放的書標出原作來源。職業頁的技能書欄位也改成連到這頁。</p></article></div>`+
  `<div class="timeline"><article><time>2026-10-24 · 玩家群組</time><h2>加入弓箭手村</h2><p>首頁與每頁頁尾加上玩家群組「弓箭手村」的 Telegram 邀請連結，可以聊天、問問題、回報 Bug，也會看到大家的轉職與野王公告。</p></article></div>`+
  `<div class="timeline"><article><time>2026-10-23 · 開發路線改版</time><h2>對照阿泰爾台服重排版本順序</h2><p>依阿泰爾台服 2026-10-20 版逐項對照能力值、傷害與命中公式、一轉與全部二轉技能、卷軸規則、裝備欄與社交系統，<a href="roadmap.html">開發路線</a>改為 0.3～4.0 共 15 個版本：先做能力值與戰鬥公式，再補一轉、裝備卷軸、介面與世界，之後依序開放各職系二轉。查不到阿泰爾數值時標示「經典楓之谷，阿泰爾未證實」。這次只更新規劃，沒有變更遊戲功能。</p></article><article><time>2026-10-23 · 遊戲 v0.2.0 同步</time><h2>雜物頁、掉落來源與遊戲版本紀錄</h2><p>新增<a href="materials.html">雜物頁</a>，列出 NPC 收購價（經典楓之谷 v83 參考價）與哪些怪會掉。裝備與卷軸詳情加入文字版掉落怪物、掉率、出現地圖，以及文字版商店售價與收購價；怪物頁的掉落可直接點進物品。更新紀錄頁改為先列遊戲版本。網站資料改為遊戲改版後自動同步。</p></article><article><time>2026-10-23 · 劍士一轉技能補強</time><h2>回血、最大 HP 與防禦技能接入掛機</h2><p>劍士新增生命淨化、生命擴展、生命恢復、自身強化與劍氣縱橫，配點、前置、MP／HP 消耗和掛機效果均已接入；自動配點先學魔天一擊，再學生命淨化與生命擴展。角色頁也能按「下次升級預覽」，在不花點數的情況下查看下一級 AP／SP、能力與技能變化。劍氣縱橫目前仍是單怪回合攻擊，群攻目標尚未實作。技能名稱與類型參照 <a href="https://www.artalemaplestory.com/en/characters/hero" target="_blank" rel="noopener noreferrer">Artale 玩家圖鑑</a>，數值為文字版換算，並非官方公式。其餘一轉職業仍待補齊，1.0 尚未完成。</p></article><article><time>2026-10-23 · 練功地圖推薦</time><h2>按角色現況挑選較快的練功點</h2><p>主面板與世界地圖新增「推薦練功地圖」按鈕，依現有武器、已學技能、怪物經驗與血量及補給估算每小時經驗，排除預估反擊致命或補給花費超過怪物楓幣與雜物收入的地圖。推薦清單可直接按鈕前往；估算基於每隻怪＝找怪 12 秒＋出手次數×每下時間（依武器攻速）的規則，實際結果會隨升級與隨機事件變動，不包含野王及掉落收益。</p></article><article><time>2026-10-23 · 地圖按鈕改版</time><h2>自由前往地圖，依城鎮逐層挑選</h2><p>應玩家要求取消所有地圖入場等級限制，等級僅保留為建議；地圖頁先選楓之島或維多利亞島，再選維多利亞港、弓箭手村、魔法森林、勇士之村、墮落城市等地區與詳細地圖。世界地圖也可直接按城鎮。日常遊戲使用按鈕，不需要輸入指令；原作的傳送點與隱藏入口仍待還原。</p></article><article><time>2026-10-23 · 地圖門檻修正</time><h2>混合等級地圖按最高普通怪設定入場</h2><p>石人寺院等地圖同時有低等與高等怪，先前只看最低等怪會讓角色過早進入。文字版現在以最高普通怪等級減五作為暫定門檻，野王不計入；安全區保持開放。此暫定入場限制已在後續地圖按鈕改版取消。</p></article><article><time>2026-10-23 · 地圖搜尋</time><h2>可依地圖與怪物名稱找練功地點</h2><p>此版曾加入文字搜尋，顯示地圖、怪物與前往按鈕；後續改為不需輸入指令的大區與城鎮按鈕選單。</p></article><article><time>2026-10-23 · 維多利亞島地圖擴充</time><h2>收錄社群圖鑑的 140 張維多利亞島地圖</h2><p>遊戲現有楓之島 21 張、維多利亞島 147 張地圖；後者包含圖鑑 140 張和保留的既有試作地圖。新增 32 種普通怪、110 種材料及可追溯的裝備卷軸掉落。地圖出沒名單、怪物 HP／EXP／楓幣來自玩家社群圖鑑；攻擊、入場等級、售價和掉率是文字版暫定。傳送路線、隱藏入口、NPC、更多野王和長時間經濟測試仍未完成；1.0 尚未正式發布。</p></article><article><time>2026-10-23 · 地圖與商店</time><h2>新增維多利亞島練功地圖，整合單一商店</h2><p>維多利亞島由 4 張擴為 29 張，包含五座城市與周邊練功地圖；新怪加入材料及裝備掉落。Telegram 商店改為單一入口，可按品類、職業篩選及翻頁；1,840 件圖鑑裝備與 274 張卷軸均可購買，商品頁顯示能力、穿戴需求及價格來源。沒有 NPC 售價的商品採文字版暫定價格。地圖尚未補齊社群圖鑑全部 140 張，部分特殊裝備屬性也尚未套用戰鬥公式。</p></article><article><time>2026-10-23 · 初心者培養方向</time><h2>初心者不再預設加 STR</h2><p>確認創角後可先選預定一轉與二轉培養方向；未選之前累積 AP 會保留。選定後才依方向自動配點，一轉時再次確認二轉方向。舊版初心者若存檔數值完整吻合每級固定加 3 STR 的紀錄，會退還為可用 AP；不符合的舊存檔不自動改動。</p></article><article><time>2026-10-23 · 重骰能力顯示</time><h2>重骰前後顯示角色總能力</h2><p>使用初始能力重設券時，預覽會同時列出目前總能力與套用後總能力；確認後明列每項能力的前後數值。重設券只替換初始能力，不重置已分配的升級 AP；選擇培養方向後，自動配點可能另外改變總能力。</p></article><article><time>2026-10-23 · 玩家資料保護</time><h2>啟動前保留玩家資料，避免多開覆寫</h2><p>機器人每次啟動前會在本機保留玩家資料與 Telegram 更新序號的備份；同一份資料檔只允許一個機器人執行，避免兩個程序交錯存檔。備份不會公開到網站。自動還原、異機遷移與完整回滾演練仍未完成。</p></article><article><time>2026-10-23 · 遠程彈藥修正</time><h2>飛鏢、箭矢與子彈改為持有後持續使用</h2><p>依<a href="https://artale.live/tw/news/nwsd3a3482b9a2e0c8ccc76cc69e05" target="_blank" rel="noopener noreferrer">Artale 官方特色說明</a>，遠程彈藥在背包持有一件即可持續使用，不再每次攻擊扣數量。文字版已修正雙飛斬、弓與手槍攻擊及自動購買，新增三件基礎彈藥商店品項；售價仍屬文字版試作。</p></article><article><time>2026-10-23 · 穩定性修正</time><h2>避免重新處理同一筆指令</h2><p>角色變更與 Telegram 更新序號現在一起寫入存檔；若機器人在回覆前重啟，已處理的購買、配點等指令不會再次入帳。若沒有收到回覆，可按「更新」查看實際結果。後續已加入單一程序保護；完整還原流程仍待驗收。</p></article><article><time>2026-10-23 · 第一代測試版</time><h2>自動練功與初期裝備掉落</h2><p>主畫面改為進入野外自動狩獵，新增預設開啟的 AP／SP 自動配點與選招設定、一轉後的二轉培養方向，以及武器提醒。舊角色若尚未選方向，面板會顯示原因與選擇按鈕，未使用點數會保留。10 種普通怪加入多項掉落池：材料、與玩家圖鑑來源相符的 9 件裝備及 9 張卷軸；相關機率為文字版暫定。野王即時情報按鈕移除，社群管理員可開啟目擊通報。完整一轉技能與地區尚在路線圖中。</p></article></div>`+
  `<div class="timeline"><article><time>2026-10-23 · 規劃公告</time><h2>第一代至四轉的開發路線</h2><p>新增<a href="roadmap.html">開發路線頁</a>，明列目前未完成項目、0.1～1.0 第一代整修、二轉、三轉、四轉的功能與驗收條件。這次只發布規劃，沒有變更 Telegram 遊戲功能或掉落。</p></article></div>`+
  `<div class="timeline"><article><time>2026-10-23 · GitHub 公開版</time><h2>資料站發布與技能資訊修整</h2><p>資料站已改由 GitHub Pages 公開發布，訪客無需登入。職業頁顯示刺客與俠盜技能的中文武器名稱、輔助技能 MP 與技能前置條件。</p></article><article><time>2026-10-22 · 盜賊二轉</time><h2>刺客與俠盜技能開放</h2><p>盜賊 Lv.30 可選刺客或俠盜，新增各分支四項技能與共用兩項技能。二轉 SP 獨立、一轉技能保留；掛機與野王戰鬥加入二轉攻擊、被動及輔助效果。傷害、MP、前置和妙手術額外楓幣皆為文字版換算。</p></article><article><time>2026-10-22 · 盜賊技能</time><h2>補齊盜賊一轉六項技能</h2><p>新增幻化術、鷹之眼、詛咒術、隱身術、雙飛斬；劈空斬保留。被動、輔助與攻擊分別作用於戰鬥，雙飛斬使用拳套和飛鏢。文字版倍率、MP、飛鏢補貨與效果並非正式阿泰爾公式。</p></article><article><time>2026-10-22 · 創角與補償</time><h2>加入創角骰點與舊角色重設券</h2><p>新角色可反覆骰四項初始能力，總計 25 點、每項至少 4 點，確認後開始遊戲。更新前已建立的角色各獲得一張初始能力重設券，可預覽、重骰與取消；確認才消耗券，只替換初始能力，升級後已分配的 AP 保留。</p></article><article><time>2026-10-22 · 角色成長</time><h2>加入能力值與首批實戰技能</h2><p>新增 AP／SP 配點、MP、藍水和五種一轉職業的首批攻擊技能；掛機與野王會依選用技能計算傷害與 MP 消耗。舊角色已自動加過的主能力值保留，只補可用點數。技能倍率、MP 與藍水價格為文字版試作值，非正式版阿泰爾公式。</p></article><article><time>2026-10-22 · 網站首版</time><h2>冒險資料站建立</h2><p>參考文字 RO 資料站的分類瀏覽方式，新增首頁、新手指南、裝備、卷軸、NPC 商店、地圖、怪物與職業頁。網站資料與 Telegram 角色存檔分離，不顯示個人帳號資料。</p></article>
  <article><time>2026-10-22 · 圖鑑快照</time><h2>匯入裝備、卷軸和商店</h2><p>從 <a href="https://www.artalemaplestory.com/zh/equipment" target="_blank" rel="noopener noreferrer">ArtaleMapleStory.com 裝備圖鑑</a>與<a href="https://www.artalemaplestory.com/zh/scrolls" target="_blank" rel="noopener noreferrer">卷軸圖鑑</a>的公開資料模組擷取 1,840 件裝備、274 張卷軸、47 間有明列售價的 NPC 商店。來源網頁列表顯示 1,733 件裝備，與資料模組筆數不同；尚未逐筆確認額外項目是否在台灣服開放。掉率未匯入，也沒有把圖鑑商品誤標為本遊戲可購買。</p></article>
  <article><time>2026-10-22 · 遊戲資料</time><h2>加入現行文字版世界資訊</h2><p>地圖 25 張、普通怪物 10 種、初心者與五種一轉職業，取自本機文字版遊戲程式。怪物攻擊、掉率與部分經濟數值為試作值，會隨遊戲更新再校準。</p></article></div>`;}
// 畢業裝備（endgame.json，遊戲 scripts/endgame-gear.mjs 產生）：Lv.170 標準角色、打王 DPS 為準、每件用衝滿卷的期望值比較。
function endgamePage(plan){const pct=v=>`${Math.round(v*1000)/10}%`,list=x=>x?.length?x.map(esc).join('<br>'):'<span class="muted">—</span>';
  const item=p=>`<strong>${esc(p.name)}</strong> <span class="muted">Lv.${p.level}</span>${p.attackSpeed?`<br><span class="muted">攻速 ${p.attackSpeed}</span>`:''}${p.untradeable?'<br><span class="pill">不能交易</span>':''}`;
  const scroll=p=>p.scroll?`<strong>${esc(p.scroll.name)}</strong> 衝 ${p.slots} 格<br><span class="muted">${list(p.scroll.sources)}</span>`:`<span class="muted">${p.slots?'衝卷對打王沒幫助':'不能衝卷'}</span>`;
  const notes=(p,beyond)=>[p?.gain?`打王 +${pct(p.gain)}`:'',p?.training?`練功時改穿：${esc(p.training)}`:'',beyond?.length?`拿不到但更強：${beyond.map(b=>esc(b.name)).join('、')}`:''].filter(Boolean).join('<br>')||'<span class="muted">—</span>';
  const row=(slot,p,beyond)=>p?`<tr><td><strong>${esc(slot)}</strong></td><td>${item(p)}</td><td>${scroll(p)}</td><td>${list(p.sources)}</td><td>${notes(p,beyond)}</td></tr>`:`<tr><td><strong>${esc(slot)}</strong></td><td colspan="3" class="muted">目前沒有拿得到、又能加打王傷害的裝備</td><td>${notes(null,beyond)}</td></tr>`;
  const body=b=>{const chosen=b.useOverall?[['套服',b.overall]]:[['上衣',b.top],['下衣',b.bottom]];const gap=Math.abs(b.diff);
    const verdict=b.useOverall?`套服比「上衣＋下衣」強 ${pct(gap)}`:`「上衣＋下衣」比套服強 ${pct(gap)}`;
    const other=b.useOverall?`上衣 ${esc(b.top?.name||'—')}＋下衣 ${esc(b.bottom?.name||'—')}`:`套服 ${esc(b.overall?.name||'—')}`;
    return chosen.map(([slot,p],i)=>p?`<tr><td><strong>${slot}</strong>${i?'':`<br><span class="pill">${b.useOverall?'穿套服':'上下分開'}</span>`}</td><td>${item(p)}</td><td>${scroll(p)}</td><td>${list(p.sources)}</td><td>${i?'<span class="muted">—</span>':`${verdict}（另一種：${other}，一樣衝滿比）${b.beyond?.length?`<br>拿不到但更強：${b.beyond.map(x=>esc(x.name)).join('、')}`:''}`}</td></tr>`:'').join('');};
  const ammo=j=>j.ammo?`<tr><td><strong>彈藥</strong></td><td><strong>${esc(j.ammo.name)}</strong><br><span class="muted">攻擊 +${j.ammo.attack}，放背包就生效</span></td><td><span class="muted">—</span></td><td>${list(j.ammo.sources)}</td><td><span class="muted">—</span></td></tr>`:'';
  const table=j=>`<div class="prose section"><h2>${esc(j.name)}</h2><p>打王 DPS（同等級木樁）約 ${number(j.bossDps)}${j.trainingMap?`；「練功時改穿」以推薦練功地圖「${esc(j.trainingMap)}」比較`:''}。</p></div>
    <div class="data-wrap"><table><thead><tr><th>部位</th><th>畢業裝備</th><th>要衝的卷軸</th><th>去哪拿</th><th>備註</th></tr></thead><tbody>${j.slots.slice(0,1).map(s=>row(s.slotName,s.pick,s.beyond)).join('')}${ammo(j)}${body(j.body)}${j.slots.slice(1).map(s=>row(s.slotName,s.pick,s.beyond)).join('')}</tbody></table></div>`;
  // 拿不到的裝備：照部位彙整哪些職業穿了會更強。
  const missing={};for(const j of plan.jobs)for(const [slot,beyond] of [...j.slots.map(s=>[s.slotName,s.beyond]),['套服／上衣／下衣',j.body.beyond]])for(const b of beyond||[])((missing[slot]||={})[b.name]||=new Set()).add(j.name);
  const missingRows=Object.entries(missing).flatMap(([slot,names])=>Object.entries(names).map(([name,jobs])=>`<tr><td>${esc(slot)}</td><td><strong>${esc(name)}</strong></td><td>${jobs.size===plan.jobs.length?'全部職業':[...jobs].map(esc).join('、')}</td></tr>`)).join('');
  root.innerHTML=head('ENDGAME GEAR','畢業裝備',`各四轉職業 Lv.${plan.level} 打王用的畢業裝：每個部位穿什麼、衝什麼卷、去哪裡拿。資料由遊戲 v${plan.version} 程式模擬算出。`)+
    `<div class="notice"><strong>怎麼算的：</strong>用 Lv.${plan.level}、四轉技能書都學到 30 級的標準角色，逐件試穿、比「打王 DPS」（打同等級木樁）。每件裝備都用「衝滿卷的平均結果」比，例如 7 格 60% 攻擊卷算平均成功 4.2 次；只用不會爆裝的卷軸，不算純白卷。套服和「上衣＋下衣」兩種穿法都算出來比。雙手武器也可以拿盾牌。只列遊戲裡拿得到的裝備（怪掉、王掉、戒指寶箱、NPC 商店），拿不到的另外列在最下面。掉率是文字版設定。</div>
    <div class="tools"><label class="field">職業<select id="endgame-job">${plan.jobs.map(j=>`<option value="${esc(j.job)}">${esc(j.name)}</option>`).join('')}</select></label></div><div id="endgame-table"></div>
    <div class="prose section"><h2>遊戲裡有、但目前拿不到的裝備</h2><p>這些裝備在資料裡比上面的畢業裝更強，但目前沒有怪、王或商店會給，先不用找。</p></div>
    <div class="data-wrap"><table><thead><tr><th>部位</th><th>裝備</th><th>哪些職業穿了會更強</th></tr></thead><tbody>${missingRows||'<tr><td colspan="3" class="empty">沒有。</td></tr>'}</tbody></table></div>
    <p class="source-note">「打王 +%」是這一格空著和穿上衝滿的差距（武器不列）。「練功時改穿」只在推薦練功地圖算出來的最佳選擇不同時才寫。每次遊戲改版會重新計算。</p>`;
  const select=root.querySelector('#endgame-job'),show=()=>{const j=plan.jobs.find(x=>x.job===select.value)||plan.jobs[0];root.querySelector('#endgame-table').innerHTML=table(j);history.replaceState(null,'',`?job=${encodeURIComponent(j.job)}`);};
  const wanted=new URLSearchParams(location.search).get('job');if(plan.jobs.some(j=>j.job===wanted))select.value=wanted;select.onchange=show;show();}

(async()=>{try{if(page==='index')home(await data('world.json').catch(()=>null));else if(page==='guide')guide();else if(page==='changelog')changelog(await data('game-changelog.json').catch(()=>[]));else if(page==='roadmap')roadmapPage(await data('roadmap.json'));else if(page==='endgame')endgamePage(await data('endgame.json'));else if(page==='equipment'||page==='scrolls'||page==='shops'){const [catalog,world]=await Promise.all([data('catalog.json'),data('world.json').catch(()=>null)]);gameWorld=world;if(page==='shops')shopsPage(catalog);else itemCatalog(catalog,page);}else if(page==='maps'||page==='monsters'||page==='jobs'||page==='materials'||page==='skillbooks'){const world=await data('world.json');gameWorld=world;({maps:mapsPage,monsters:monstersPage,jobs:jobsPage,materials:materialsPage,skillbooks:skillbooksPage})[page](world);}else error('找不到這個頁面。');}catch(err){console.error(err);error('資料載入失敗，請重新整理或稍後再試。');}})();
