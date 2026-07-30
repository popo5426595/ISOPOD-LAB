const VERSION = "v0.2";
const KAKAO_URL = "https://open.kakao.com/o/gpw7XjGi";
const SAVE_KEY = "isopodLabSave";
const AUTO_INTERVAL_MS = 10000;
const OFFLINE_MAX_MS = 12 * 60 * 60 * 1000;

const RARITIES = [
  {name:"노말", weight:45, mult:1},
  {name:"레어", weight:30, mult:1.15},
  {name:"에픽", weight:15, mult:1.35},
  {name:"유니크", weight:8, mult:1.6},
  {name:"레전더리", weight:2, mult:2}
];
const STAR_POWER = [0,10,20,35,55,80];
const SLOT_NAMES = {hat:"모자", weapon:"도구", necklace:"목걸이", aura:"오라"};
const REGIONS = [
  {id:"meadow", name:"초원", icon:"🌿", need:0, mult:1, base:900, desc:"처음 시작하는 온화한 지역"},
  {id:"forest", name:"숲", icon:"🌲", need:80, mult:1.35, base:1250, desc:"낙엽 아래 보상이 풍부한 지역"},
  {id:"cave", name:"동굴", icon:"🪨", need:180, mult:1.8, base:1700, desc:"희귀한 흔적이 발견되는 어두운 지역"},
  {id:"desert", name:"사막", icon:"🏜️", need:330, mult:2.45, base:2350, desc:"고난도 탐험과 큰 보상이 기다리는 지역"},
  {id:"volcano", name:"화산", icon:"🌋", need:520, mult:3.25, base:3200, desc:"최상급 연구원을 위한 위험 지역"}
];

let speciesDB = [];
let equipmentDB = {};
let state = loadState();
let currentView = "home";
let autoTimer = null;
let selectedPhoto = null;

async function boot(){
  try{
    [speciesDB, equipmentDB] = await Promise.all([
      fetch("data/species.json").then(r=>{if(!r.ok) throw new Error("species"); return r.json()}),
      fetch("data/equipment.json").then(r=>{if(!r.ok) throw new Error("equipment"); return r.json()})
    ]);
  }catch(error){
    document.getElementById("panel").innerHTML='<div class="card danger"><h3>데이터를 불러오지 못했습니다.</h3><p>GitHub/Vercel 또는 로컬 서버에서 실행해 주세요.</p></div>';
    return;
  }
  normalizeState();
  bindUI();
  document.getElementById("versionText").textContent=VERSION;
  processOfflineReward();
  setupAutoExplore();
  render();
}

function defaultState(){
  return {
    gold:50000,
    discovered:{},
    ownedSpecies:{},
    inventory:[],
    equipped:{hat:null,weapon:null,necklace:null,aura:null},
    exploreCount:0,
    selectedRegion:"meadow",
    autoExplore:false,
    autoEarned:0,
    lastSeen:Date.now(),
    settings:{sound:true,lowFps:false},
    codexNotes:{},
    favorites:[],
    devMode:false
  };
}
function loadState(){
  try{return {...defaultState(), ...JSON.parse(localStorage.getItem(SAVE_KEY)||"{}")}}
  catch{return defaultState()}
}
function normalizeState(){
  state.equipped={...defaultState().equipped,...(state.equipped||{})};
  state.settings={...defaultState().settings,...(state.settings||{})};
  state.discovered=state.discovered||{};
  state.ownedSpecies=state.ownedSpecies||{};
  state.inventory=Array.isArray(state.inventory)?state.inventory:[];
  state.favorites=Array.isArray(state.favorites)?state.favorites:[];
  state.codexNotes=state.codexNotes||{};
  if(!REGIONS.some(r=>r.id===state.selectedRegion)) state.selectedRegion="meadow";
}
function save(){
  state.lastSeen=Date.now();
  localStorage.setItem(SAVE_KEY,JSON.stringify(state));
}
function fmt(n){return Math.floor(Number(n)||0).toLocaleString("ko-KR")}
function rand(arr){return arr[Math.floor(Math.random()*arr.length)]}
function escapeHTML(value=""){return String(value).replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]))}
function weightedRarity(){
  const x=Math.random()*100; let sum=0;
  for(const r of RARITIES){sum+=r.weight;if(x<sum)return r}
  return RARITIES[0];
}
function rollStars(){
  const x=Math.random()*100;
  if(x<45)return 1;if(x<72)return 2;if(x<88)return 3;if(x<97)return 4;return 5;
}
function currentRegion(){return REGIONS.find(r=>r.id===state.selectedRegion)||REGIONS[0]}
function regionUnlocked(region){return totalPower()>=region.need}

function bindUI(){
  document.querySelectorAll(".tabs button").forEach(btn=>{
    btn.addEventListener("click",()=>{
      currentView=btn.dataset.view;
      document.querySelectorAll(".tabs button").forEach(b=>b.classList.toggle("active",b===btn));
      renderPanel();
    });
  });
  document.getElementById("modalClose").onclick=closeModal;
  document.getElementById("modal").addEventListener("click",e=>{if(e.target.id==="modal")closeModal()});
  document.getElementById("settingsButton").onclick=openSettings;
  document.getElementById("settingsClose").onclick=closeSettings;
  document.getElementById("drawerBackdrop").onclick=closeSettings;
  window.addEventListener("beforeunload",save);
  document.addEventListener("visibilitychange",()=>{
    if(document.hidden) save();
    else { processOfflineReward(); setupAutoExplore(); render(); }
  });
}

function processOfflineReward(){
  const now=Date.now();
  const previous=Number(state.lastSeen)||now;
  const elapsed=Math.min(Math.max(0,now-previous),OFFLINE_MAX_MS);
  if(state.autoExplore && elapsed>=60000){
    const cycles=Math.floor(elapsed/AUTO_INTERVAL_MS);
    const reward=cycles*autoRewardPerCycle();
    if(reward>0){
      state.gold+=reward;
      state.autoEarned=(state.autoEarned||0)+reward;
      state.exploreCount+=cycles;
      setTimeout(()=>showModal(`<div class="modal-icon">🌙</div><h2>오프라인 탐험 완료</h2><div class="result-name">+${fmt(reward)} G</div><p class="muted">${formatDuration(elapsed)} 동안 ${fmt(cycles)}회 탐험했습니다.<br>최대 12시간까지 보상됩니다.</p>`),250);
    }
  }
  state.lastSeen=now;
  save();
}
function formatDuration(ms){
  const minutes=Math.floor(ms/60000), hours=Math.floor(minutes/60);
  return hours?`${hours}시간 ${minutes%60}분`:`${minutes}분`;
}
function autoRewardPerCycle(){
  const r=currentRegion();
  return Math.floor((r.base*0.12 + totalPower()*0.12)*r.mult);
}
function setupAutoExplore(){
  clearInterval(autoTimer);
  autoTimer=null;
  document.getElementById("autoBadge")?.classList.toggle("hidden",!state.autoExplore);
  if(!state.autoExplore)return;
  autoTimer=setInterval(()=>{
    if(document.hidden)return;
    const reward=autoRewardPerCycle();
    state.gold+=reward;
    state.autoEarned=(state.autoEarned||0)+reward;
    state.exploreCount++;
    save();
    document.getElementById("goldValue").textContent=fmt(state.gold);
    const live=document.getElementById("autoLive");
    if(live) live.textContent=`+${fmt(reward)} G 획득`;
  },AUTO_INTERVAL_MS);
}

function render(){
  document.getElementById("goldValue").textContent=fmt(state.gold);
  document.getElementById("autoBadge").classList.toggle("hidden",!state.autoExplore);
  renderTerrarium();
  renderPanel();
  save();
}
function renderTerrarium(){
  const stage=document.getElementById("isopodStage");
  stage.innerHTML="";
  const owned=Object.values(state.ownedSpecies).sort((a,b)=>(b.power||0)-(a.power||0)).slice(0,8);
  if(!owned.length){
    stage.innerHTML='<div class="empty-stage">캡슐에서 첫 등각류를 만나보세요</div>';
    return;
  }
  owned.forEach((pod,i)=>{
    const el=document.createElement("div");
    el.className="pod";
    el.style.left=(5+(i*12)%80)+"%";
    el.style.top=(108+(i%3)*35)+"px";
    el.style.animationDelay=(-i*1.2)+"s";
    el.style.setProperty("--scale",(0.72+pod.stars*0.065).toFixed(2));
    el.innerHTML='<span class="eye"></span>';
    el.title=pod.name;
    stage.appendChild(el);
  });
}
function renderPanel(){
  const panel=document.getElementById("panel");
  const views={home:homeView,explore:exploreView,capsule:capsuleView,codex:codexView,equipment:equipmentView};
  panel.innerHTML=(views[currentView]||homeView)();
  document.getElementById("goldValue").textContent=fmt(state.gold);
}
function totalPower(){
  const best=Object.values(state.ownedSpecies).reduce((m,p)=>Math.max(m,p.power||0),0);
  const gear=Object.values(state.equipped).filter(Boolean).reduce((s,g)=>s+(g.power||0),0);
  return best+gear;
}
function homeView(){
  const count=Object.keys(state.discovered).length;
  const r=currentRegion();
  return `
    <div class="hero-card">
      <div><div class="eyebrow">CURRENT MISSION</div><h2>${r.icon} ${r.name} 연구</h2><p>${r.desc}</p></div>
      <div class="power-orb"><span>탐험력</span><strong>${fmt(totalPower())}</strong></div>
    </div>
    <div class="grid stats-grid">
      <div class="card"><div class="muted">도감</div><div class="stat">${count} / ${speciesDB.length}</div></div>
      <div class="card"><div class="muted">탐험 횟수</div><div class="stat">${fmt(state.exploreCount)}</div></div>
      <div class="card"><div class="muted">자동 탐험 누적</div><div class="stat">${fmt(state.autoEarned||0)} G</div></div>
    </div>
    <div class="card goal-card">
      <div class="row-between"><h3>연구 진행도</h3><span>${Math.floor(count/speciesDB.length*100)||0}%</span></div>
      <div class="progress"><div style="width:${count/speciesDB.length*100}%"></div></div>
      <p class="muted">59종과 ★★★★★ 개체를 수집하고 모든 지역을 해금하세요.</p>
    </div>`;
}
function exploreView(){
  const power=totalPower(), selected=currentRegion();
  return `
    <div class="section-title"><div><div class="eyebrow">EXPEDITION</div><h2>탐험 지역</h2></div><div class="power-chip">⚡ ${fmt(power)}</div></div>
    <div class="region-grid">${REGIONS.map(r=>{
      const unlocked=regionUnlocked(r), active=r.id===selected.id;
      return `<button class="region-card ${active?"selected":""} ${unlocked?"":"locked"}" onclick="selectRegion('${r.id}')" ${unlocked?"":"disabled"}>
        <span class="region-icon">${r.icon}</span><strong>${r.name}</strong><small>${r.desc}</small>
        <span class="region-meta">${unlocked?`보상 ×${r.mult}`:`탐험력 ${fmt(r.need)} 필요`}</span>
      </button>`
    }).join("")}</div>
    <div class="card expedition-card">
      <div class="row-between"><div><h3>${selected.icon} ${selected.name} 탐험</h3><p class="muted">현재 예상 보상 ${fmt(manualRewardBase())} G 이상</p></div><span class="status-dot ${state.autoExplore?"on":""}">${state.autoExplore?"AUTO ON":"AUTO OFF"}</span></div>
      <div class="actions">
        <button class="primary grow" onclick="startExplore()">🧭 즉시 탐험</button>
        <button class="${state.autoExplore?"danger-button":"secondary"} grow" onclick="toggleAutoExplore()">${state.autoExplore?"자동 탐험 끄기":"자동 탐험 켜기"}</button>
      </div>
      <p id="autoLive" class="live-text">자동 탐험은 10초마다 진행되며, 오프라인 보상은 최대 12시간입니다.</p>
    </div>`;
}
function manualRewardBase(){
  const r=currentRegion();
  return Math.floor((r.base+totalPower()*0.45)*r.mult);
}
function selectRegion(id){
  const r=REGIONS.find(x=>x.id===id);
  if(!r||!regionUnlocked(r))return;
  state.selectedRegion=id; save(); renderPanel();
}
function startExplore(){
  const r=currentRegion();
  const reward=manualRewardBase()+Math.floor(Math.random()*(r.base*0.55+1));
  state.gold+=reward; state.exploreCount++;
  let bonus="";
  if(Math.random()<Math.min(.28,.06+r.mult*.035)){
    const extra=Math.floor(reward*(.25+Math.random()*.35)); state.gold+=extra;
    bonus=`<p class="bonus">✨ 희귀 흔적 발견 +${fmt(extra)} G</p>`;
  }
  save(); render();
  showModal(`<div class="modal-icon">${r.icon}</div><h2>${r.name} 탐험 완료</h2><div class="result-name">+${fmt(reward)} G</div>${bonus}`);
}
function toggleAutoExplore(){
  state.autoExplore=!state.autoExplore; save(); setupAutoExplore(); render();
  showToast(state.autoExplore?"자동 탐험을 시작했습니다.":"자동 탐험을 중지했습니다.");
}
function capsuleView(){
  return `<div class="section-title"><div><div class="eyebrow">CAPSULE</div><h2>연구 캡슐</h2></div></div>
  <div class="grid">
    <div class="card capsule-card"><div class="capsule-icon">🪲</div><h3>등각류 캡슐</h3><p class="muted">신규 종 또는 더 높은 별의 개체를 획득합니다.</p><div class="actions"><button class="primary" onclick="pullSpecies(1)">1회 · 5,000 G</button><button class="secondary" onclick="pullSpecies(10)">10회 · 45,000 G</button></div></div>
    <div class="card capsule-card"><div class="capsule-icon">🎒</div><h3>장비 캡슐</h3><p class="muted">모자, 도구, 목걸이, 오라를 획득합니다.</p><div class="actions"><button class="primary" onclick="pullEquipment()">1회 · 5,000 G</button></div></div>
  </div>`;
}
function pay(cost){
  if(state.gold<cost){showModal("<h2>골드 부족</h2><p>탐험에서 골드를 모아주세요.</p>");return false}
  state.gold-=cost;return true;
}
function pullSpecies(times){
  const cost=times===10?45000:5000;
  if(!pay(cost))return;
  const results=[];
  for(let i=0;i<times;i++){
    const rarity=weightedRarity();
    let pool=speciesDB.filter(s=>s.rarity===rarity.name);
    if(!pool.length) pool=speciesDB;
    const s=rand(pool), stars=rollStars();
    const power=Math.round((s.basePower+STAR_POWER[stars])*rarity.mult);
    const old=state.ownedSpecies[s.id];
    const isNew=!state.discovered[s.id];
    state.discovered[s.id]=true;
    const upgraded=!old || stars>old.stars || (stars===old.stars && power>old.power);
    if(upgraded) state.ownedSpecies[s.id]={...s,stars,power,acquiredAt:old?.acquiredAt||Date.now()};
    results.push({...s,stars,power,isNew,upgraded:!!old&&upgraded});
  }
  save();render();
  if(times===1){
    const r=results[0];
    showModal(`<div class="rarity-${r.rarity}">${r.rarity}</div><div class="result-name">${r.name}</div><div class="stars">${"★".repeat(r.stars)}${"☆".repeat(5-r.stars)}</div><p>${r.isNew?"NEW · 도감 등록":r.upgraded?"최고 개체 갱신":"중복 개체"}</p><p class="muted">탐험력 ${fmt(r.power)}</p>`);
  }else showModal(`<h2>10회 결과</h2><div class="pull-list">${results.map(r=>`<div>${r.isNew?"<b>NEW</b> ":""}<span class="rarity-${r.rarity}">${r.rarity}</span> ${r.name} · ${"★".repeat(r.stars)}</div>`).join("")}</div>`);
}
function pullEquipment(){
  if(!pay(5000))return;
  const slot=rand(Object.keys(equipmentDB)), base=rand(equipmentDB[slot]);
  const rarity=weightedRarity(), stars=rollStars();
  const power=Math.round((base.basePower+STAR_POWER[stars])*rarity.mult);
  const uid=globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random()}`;
  const item={uid,slot,...base,rarity:rarity.name,stars,power};
  state.inventory.push(item);
  const old=state.equipped[slot];
  if(!old || item.power>old.power) state.equipped[slot]=item;
  save();render();
  showModal(`<div class="rarity-${item.rarity}">${item.rarity}</div><div class="result-name">${item.name}</div><div class="stars">${"★".repeat(item.stars)}${"☆".repeat(5-item.stars)}</div><p>${old&&old.power>=item.power?"보관함에 저장":"자동 장착 완료"}</p><p class="muted">탐험력 +${fmt(item.power)}</p>`);
}
function codexView(){
  const count=Object.keys(state.discovered).length;
  return `<div class="section-title"><div><div class="eyebrow">ENCYCLOPEDIA</div><h2>도감 ${count} / ${speciesDB.length}</h2></div><button class="secondary compact" onclick="openPhotoSender()">📸 사진 보내기</button></div>
  <div class="codex">${speciesDB.map(s=>{
    const owned=state.ownedSpecies[s.id], found=!!state.discovered[s.id], favorite=state.favorites.includes(s.id);
    return `<button class="entry ${found?"":"locked"}" onclick="${found?`openCodexEntry('${s.id}')`:"void(0)"}">
      <span class="fav">${favorite?"★":""}</span><span class="entry-icon">${found?"🪲":"?"}</span><strong>${found?s.name:"???"}</strong>
      <span class="rarity-${s.rarity}">${found?s.rarity:"미발견"}</span><span>${owned?"★".repeat(owned.stars)+"☆".repeat(5-owned.stars):"☆☆☆☆☆"}</span>
    </button>`
  }).join("")}</div>`;
}
function openCodexEntry(id){
  const s=speciesDB.find(x=>x.id===id), owned=state.ownedSpecies[id]; if(!s||!owned)return;
  const favorite=state.favorites.includes(id), note=state.codexNotes[id]||"";
  showModal(`<div class="modal-icon">🪲</div><div class="rarity-${s.rarity}">${s.rarity}</div><div class="result-name">${escapeHTML(s.name)}</div><div class="stars">${"★".repeat(owned.stars)}${"☆".repeat(5-owned.stars)}</div><p>탐험력 ${fmt(owned.power)}</p><label class="field-label">연구 메모<textarea id="codexNoteInput" rows="3" placeholder="개체 특징이나 성장 기록을 적어주세요.">${escapeHTML(note)}</textarea></label><div class="actions center"><button class="secondary" onclick="toggleFavorite('${id}')">${favorite?"★ 즐겨찾기 해제":"☆ 즐겨찾기"}</button><button class="primary" onclick="saveCodexNote('${id}')">메모 저장</button></div>`);
}
function toggleFavorite(id){
  state.favorites=state.favorites.includes(id)?state.favorites.filter(x=>x!==id):[...state.favorites,id]; save(); closeModal(); renderPanel();
}
function saveCodexNote(id){
  state.codexNotes[id]=document.getElementById("codexNoteInput")?.value.trim()||""; save(); closeModal(); showToast("도감 메모를 저장했습니다.");
}
function equipmentView(){
  return `<div class="section-title"><div><div class="eyebrow">EQUIPMENT</div><h2>장비</h2></div><div class="power-chip">총 ${fmt(totalPower())}</div></div><div class="grid">${Object.keys(SLOT_NAMES).map(slot=>{
    const g=state.equipped[slot];
    return `<div class="card slot"><div><div class="muted">${SLOT_NAMES[slot]}</div><strong>${g?g.name:"미착용"}</strong><div>${g?`<span class="rarity-${g.rarity}">${g.rarity}</span> · ${"★".repeat(g.stars)}`:""}</div></div><div class="stat">${g?"+"+g.power:"-"}</div></div>`
  }).join("")}</div><p class="muted">더 강한 장비를 획득하면 자동으로 교체됩니다. 보관함 ${state.inventory.length}개</p>`;
}

function openSettings(){
  renderSettings();
  document.getElementById("settingsDrawer").classList.add("open");
  document.getElementById("settingsDrawer").setAttribute("aria-hidden","false");
  document.getElementById("drawerBackdrop").classList.remove("hidden");
}
function closeSettings(){
  document.getElementById("settingsDrawer").classList.remove("open");
  document.getElementById("settingsDrawer").setAttribute("aria-hidden","true");
  document.getElementById("drawerBackdrop").classList.add("hidden");
}
function renderSettings(){
  document.getElementById("settingsBody").innerHTML=`
    <section class="settings-section"><h3>게임 설정</h3>
      <label class="setting-row"><span><strong>효과음</strong><small>버튼 및 획득 효과음</small></span><input type="checkbox" ${state.settings.sound?"checked":""} onchange="updateSetting('sound',this.checked)"></label>
      <label class="setting-row"><span><strong>저사양 모드</strong><small>움직임을 줄여 배터리를 절약합니다.</small></span><input type="checkbox" ${state.settings.lowFps?"checked":""} onchange="updateSetting('lowFps',this.checked)"></label>
    </section>
    <section class="settings-section"><h3>도감 제보</h3><p class="muted">실물 등각류 사진과 종 정보를 개발자에게 보냅니다.</p><button class="primary full" onclick="openPhotoSender()">📸 도감 사진 보내기</button></section>
    <section class="settings-section"><h3>고객 지원</h3><a class="kakao-button" href="${KAKAO_URL}" target="_blank" rel="noopener">💬 개발자 카카오톡 문의</a></section>
    <section class="settings-section"><h3>데이터</h3><div class="stack-actions"><button class="secondary full" onclick="exportSave()">저장 데이터 내보내기</button><button class="secondary full" onclick="document.getElementById('importSaveInput').click()">저장 데이터 불러오기</button><input id="importSaveInput" type="file" accept="application/json" hidden onchange="importSave(event)"><button class="danger-button full" onclick="resetSave()">게임 데이터 초기화</button></div></section>
    <div class="version-card"><span>ISOPOD LAB</span><strong>${VERSION}</strong></div>`;
}
function updateSetting(key,value){
  state.settings[key]=value; document.body.classList.toggle("low-motion",state.settings.lowFps); save();
}

function openPhotoSender(){
  closeSettings(); selectedPhoto=null;
  const options=speciesDB.map(s=>`<option value="${escapeHTML(s.name)}">${escapeHTML(s.name)} (${s.rarity})</option>`).join("");
  showModal(`<div class="modal-icon">📸</div><h2>도감 사진 보내기</h2><p class="muted">종과 사진을 선택한 뒤 발송하세요.</p>
    <div class="form-stack"><label class="field-label">도감 종<select id="photoSpecies"><option value="미확인 종">미확인 종</option>${options}</select></label>
    <label class="field-label">사진<input id="photoFile" type="file" accept="image/*" capture="environment" onchange="previewPhoto(event)"></label>
    <div id="photoPreview" class="photo-preview">사진 미선택</div>
    <label class="field-label">메모<textarea id="photoMemo" rows="3" placeholder="크기, 산지, 특징 등을 적어주세요."></textarea></label></div>
    <div class="actions center"><button class="secondary" onclick="openKakaoSupport()">카톡만 열기</button><button class="primary" onclick="sendCodexPhoto()">사진 발송</button></div>
    <p class="tiny muted">휴대폰의 공유 기능이 지원되면 사진과 내용을 함께 공유합니다. 미지원 브라우저에서는 내용 복사 후 카카오톡이 열립니다.</p>`);
}
function previewPhoto(event){
  selectedPhoto=event.target.files?.[0]||null;
  const box=document.getElementById("photoPreview");
  if(!selectedPhoto){box.textContent="사진 미선택";return}
  const url=URL.createObjectURL(selectedPhoto);
  box.innerHTML=`<img src="${url}" alt="선택한 사진 미리보기"><span>${escapeHTML(selectedPhoto.name)}</span>`;
}
async function sendCodexPhoto(){
  const species=document.getElementById("photoSpecies")?.value||"미확인 종";
  const memo=document.getElementById("photoMemo")?.value.trim()||"메모 없음";
  const text=`[ISOPOD LAB 도감 사진 제보]\n종: ${species}\n메모: ${memo}`;
  try{
    if(selectedPhoto && navigator.share){
      const data={title:"ISOPOD LAB 도감 제보",text,files:[selectedPhoto]};
      if(!navigator.canShare || navigator.canShare({files:[selectedPhoto]})){
        await navigator.share(data); closeModal(); showToast("공유 화면을 열었습니다."); return;
      }
    }
    await copyText(text);
    window.open(KAKAO_URL,"_blank","noopener");
    showToast(selectedPhoto?"제보 내용을 복사했습니다. 카카오톡에서 사진을 직접 첨부해 주세요.":"제보 내용을 복사하고 카카오톡을 열었습니다.");
  }catch(error){
    if(error?.name!=="AbortError") showToast("공유를 열지 못했습니다. 카카오톡 문의를 이용해 주세요.");
  }
}
function openKakaoSupport(){window.open(KAKAO_URL,"_blank","noopener")}
async function copyText(text){
  if(navigator.clipboard?.writeText)return navigator.clipboard.writeText(text);
  const ta=document.createElement("textarea");ta.value=text;document.body.appendChild(ta);ta.select();document.execCommand("copy");ta.remove();
}
function exportSave(){
  const blob=new Blob([JSON.stringify(state,null,2)],{type:"application/json"});
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`ISOPOD_LAB_save_${Date.now()}.json`;a.click();URL.revokeObjectURL(a.href);
}
function importSave(event){
  const file=event.target.files?.[0]; if(!file)return;
  const reader=new FileReader();
  reader.onload=()=>{try{state={...defaultState(),...JSON.parse(reader.result)};normalizeState();save();closeSettings();render();showToast("저장 데이터를 불러왔습니다.")}catch{showToast("올바른 저장 파일이 아닙니다.")}};
  reader.readAsText(file);
}
function resetSave(){
  if(!confirm("모든 진행 상황을 초기화할까요? 이 작업은 되돌릴 수 없습니다."))return;
  localStorage.removeItem(SAVE_KEY); state=defaultState(); normalizeState(); setupAutoExplore(); closeSettings(); render(); showToast("게임 데이터를 초기화했습니다.");
}

function showModal(html){
  document.getElementById("modalBody").innerHTML=html;
  document.getElementById("modal").classList.remove("hidden");
}
function closeModal(){document.getElementById("modal").classList.add("hidden")}
function showToast(message){
  const old=document.querySelector(".toast"); if(old)old.remove();
  const el=document.createElement("div");el.className="toast";el.textContent=message;document.body.appendChild(el);
  requestAnimationFrame(()=>el.classList.add("show"));setTimeout(()=>{el.classList.remove("show");setTimeout(()=>el.remove(),250)},2400);
}

boot();
