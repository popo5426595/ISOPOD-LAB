
const RARITIES = [
  {name:"노말", weight:45, mult:1},
  {name:"레어", weight:30, mult:1.15},
  {name:"에픽", weight:15, mult:1.35},
  {name:"유니크", weight:8, mult:1.6},
  {name:"레전더리", weight:2, mult:2}
];
const STAR_POWER = [0,10,20,35,55,80];
const SLOT_NAMES = {hat:"모자", weapon:"도구", necklace:"목걸이", aura:"오라"};

let speciesDB = [];
let equipmentDB = {};
let state = loadState();
let currentView = "home";

async function boot(){
  speciesDB = await fetch("data/species.json").then(r=>r.json());
  equipmentDB = await fetch("data/equipment.json").then(r=>r.json());
  bindUI();
  render();
}
function defaultState(){
  return {
    gold:50000,
    discovered:{},
    ownedSpecies:{},
    inventory:[],
    equipped:{hat:null,weapon:null,necklace:null,aura:null},
    exploreCount:0
  };
}
function loadState(){
  try{return {...defaultState(), ...JSON.parse(localStorage.getItem("isopodLabSave")||"{}")}}
  catch{return defaultState()}
}
function save(){localStorage.setItem("isopodLabSave",JSON.stringify(state))}
function fmt(n){return n.toLocaleString("ko-KR")}
function rand(arr){return arr[Math.floor(Math.random()*arr.length)]}
function weightedRarity(){
  const x=Math.random()*100; let sum=0;
  for(const r of RARITIES){sum+=r.weight;if(x<sum)return r}
  return RARITIES[0];
}
function rollStars(){
  const x=Math.random()*100;
  if(x<45)return 1;if(x<72)return 2;if(x<88)return 3;if(x<97)return 4;return 5;
}
function bindUI(){
  document.querySelectorAll(".tabs button").forEach(btn=>{
    btn.addEventListener("click",()=>{
      currentView=btn.dataset.view;
      document.querySelectorAll(".tabs button").forEach(b=>b.classList.toggle("active",b===btn));
      renderPanel();
    });
  });
  document.getElementById("modalClose").onclick=()=>document.getElementById("modal").classList.add("hidden");
}
function render(){
  document.getElementById("goldValue").textContent=fmt(state.gold);
  renderTerrarium();
  renderPanel();
  save();
}
function renderTerrarium(){
  const stage=document.getElementById("isopodStage");
  stage.innerHTML="";
  const owned=Object.values(state.ownedSpecies).slice(0,6);
  if(!owned.length){
    stage.innerHTML='<div style="position:absolute;inset:0;display:grid;place-items:center;color:#d9e4d5">캡슐에서 첫 등각류를 만나보세요</div>';
    return;
  }
  owned.forEach((pod,i)=>{
    const el=document.createElement("div");
    el.className="pod";
    el.style.left=(8+(i*14)%75)+"%";
    el.style.top=(115+(i%3)*30)+"px";
    el.style.animationDelay=(-i*1.2)+"s";
    el.style.setProperty("--scale",(0.78+pod.stars*0.06).toFixed(2));
    el.innerHTML='<span class="eye"></span>';
    el.title=pod.name;
    stage.appendChild(el);
  });
}
function renderPanel(){
  const panel=document.getElementById("panel");
  if(currentView==="home") panel.innerHTML=homeView();
  if(currentView==="explore") panel.innerHTML=exploreView();
  if(currentView==="capsule") panel.innerHTML=capsuleView();
  if(currentView==="codex") panel.innerHTML=codexView();
  if(currentView==="equipment") panel.innerHTML=equipmentView();
  document.getElementById("goldValue").textContent=fmt(state.gold);
}
function totalPower(){
  const best=Object.values(state.ownedSpecies).reduce((m,p)=>Math.max(m,p.power||0),0);
  const gear=Object.values(state.equipped).filter(Boolean).reduce((s,g)=>s+g.power,0);
  return best+gear;
}
function homeView(){
  const count=Object.keys(state.discovered).length;
  return `
    <div class="grid">
      <div class="card"><div class="muted">도감</div><div class="stat">${count} / 59</div></div>
      <div class="card"><div class="muted">최고 탐험력</div><div class="stat">${fmt(totalPower())}</div></div>
      <div class="card"><div class="muted">탐험 횟수</div><div class="stat">${fmt(state.exploreCount)}</div></div>
    </div>
    <div class="card" style="margin-top:12px">
      <h3>연구 목표</h3>
      <div class="progress"><div style="width:${count/59*100}%"></div></div>
      <p class="muted">골드를 모아 캡슐을 열고, 59종과 ★★★★★ 개체를 수집하세요.</p>
    </div>`;
}
function exploreView(){
  const power=totalPower();
  const reward=1000+Math.floor(power*0.35);
  return `
    <div class="card">
      <h3>🌿 초원 탐험</h3>
      <p class="muted">탐험 보상은 골드만 지급됩니다.</p>
      <div class="grid">
        <div><div class="muted">현재 탐험력</div><div class="stat">${fmt(power)}</div></div>
        <div><div class="muted">예상 골드</div><div class="stat">${fmt(reward)} G</div></div>
      </div>
      <div class="actions"><button class="primary" onclick="startExplore()">탐험 시작</button></div>
    </div>`;
}
function startExplore(){
  const reward=1000+Math.floor(totalPower()*0.35)+Math.floor(Math.random()*501);
  state.gold+=reward; state.exploreCount++;
  save(); render();
  showModal(`<div style="font-size:48px">🧭</div><h2>탐험 완료</h2><div class="result-name">+${fmt(reward)} G</div>`);
}
function capsuleView(){
  return `
  <div class="grid">
    <div class="card">
      <h3>🪲 등각류 캡슐</h3>
      <p class="muted">신규 종 또는 더 높은 별의 개체를 획득합니다.</p>
      <div class="actions">
        <button class="primary" onclick="pullSpecies(1)">1회 · 5,000 G</button>
        <button class="secondary" onclick="pullSpecies(10)">10회 · 45,000 G</button>
      </div>
    </div>
    <div class="card">
      <h3>🎒 장비 캡슐</h3>
      <p class="muted">모자, 도구, 목걸이, 오라를 획득합니다.</p>
      <div class="actions">
        <button class="primary" onclick="pullEquipment()">1회 · 5,000 G</button>
      </div>
    </div>
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
    if(!old || stars>old.stars || (stars===old.stars && power>old.power)){
      state.ownedSpecies[s.id]={...s,stars,power};
    }
    results.push({...s,stars,power,isNew,upgraded:!!old && (!old || stars>old.stars || power>old.power)});
  }
  save();render();
  if(times===1){
    const r=results[0];
    showModal(`<div class="rarity-${r.rarity}">${r.rarity}</div>
      <div class="result-name">${r.name}</div>
      <div class="stars">${"★".repeat(r.stars)}${"☆".repeat(5-r.stars)}</div>
      <p>${r.isNew?"NEW · 도감 등록":"중복 · 최고 개체 비교 완료"}</p>
      <p class="muted">탐험력 ${fmt(r.power)}</p>`);
  }else{
    showModal(`<h2>10회 결과</h2>${results.map(r=>`<div>${r.isNew?"NEW ":""}<span class="rarity-${r.rarity}">${r.rarity}</span> ${r.name} · ${"★".repeat(r.stars)}</div>`).join("")}`);
  }
}
function pullEquipment(){
  if(!pay(5000))return;
  const slot=rand(Object.keys(equipmentDB));
  const base=rand(equipmentDB[slot]);
  const rarity=weightedRarity(), stars=rollStars();
  const power=Math.round((base.basePower+STAR_POWER[stars])*rarity.mult);
  const item={uid:crypto.randomUUID(),slot,...base,rarity:rarity.name,stars,power};
  state.inventory.push(item);
  const old=state.equipped[slot];
  if(!old || item.power>old.power) state.equipped[slot]=item;
  save();render();
  showModal(`<div class="rarity-${item.rarity}">${item.rarity}</div>
    <div class="result-name">${item.name}</div>
    <div class="stars">${"★".repeat(item.stars)}${"☆".repeat(5-item.stars)}</div>
    <p>${old && old.power>=item.power?"보관함에 저장":"자동 장착 완료"}</p>
    <p class="muted">탐험력 +${fmt(item.power)}</p>`);
}
function codexView(){
  const count=Object.keys(state.discovered).length;
  return `<h2>도감 ${count} / 59</h2><div class="codex">${
    speciesDB.map(s=>{
      const owned=state.ownedSpecies[s.id], found=!!state.discovered[s.id];
      return `<div class="entry ${found?"":"locked"}">
        <strong>${found?s.name:"???"}</strong>
        <div class="rarity-${s.rarity}">${found?s.rarity:"미발견"}</div>
        <div>${owned?"★".repeat(owned.stars)+"☆".repeat(5-owned.stars):"☆☆☆☆☆"}</div>
      </div>`
    }).join("")
  }</div>`;
}
function equipmentView(){
  return `<h2>장비</h2><div class="grid">${
    Object.keys(SLOT_NAMES).map(slot=>{
      const g=state.equipped[slot];
      return `<div class="card slot"><div><div class="muted">${SLOT_NAMES[slot]}</div>
      <strong>${g?g.name:"미착용"}</strong>
      <div>${g?`<span class="rarity-${g.rarity}">${g.rarity}</span> · ${"★".repeat(g.stars)}`:""}</div></div>
      <div class="stat">${g?"+"+g.power:"-"}</div></div>`
    }).join("")
  }</div><p class="muted">장비 캡슐에서 더 강한 장비를 획득하면 자동으로 교체됩니다.</p>`;
}
function showModal(html){
  document.getElementById("modalBody").innerHTML=html;
  document.getElementById("modal").classList.remove("hidden");
}
boot();
