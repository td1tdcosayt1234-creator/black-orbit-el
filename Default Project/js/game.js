// ================= PLAYGAMA BRIDGE CORE (v2.2) =================
// Boot order per Playgama required steps: bridge.initialize() waits before the game restores state.
const BOOT={bridgeReady:false,storageLoaded:false,language:'en',audioEnabled:true,forcedPause:false,rewardedOk:false,rewardedCb:null,gameReadySent:false};
const K_SAVE='black_orbit_save_v22';
const LOCAL_SAVE='black_orbit_save_v22';

function saveDefault(){ return {coins:0,skins:['classic'],abs:[],skin:'classic',best:0,level:1,lb:[],daily:null,missions:null,achv:[],sound:true,totalEaten:0,gamesPlayed:0,aiKills:0}; }
let saveState=saveDefault();

function lsRead(){ try{ const v=localStorage.getItem(LOCAL_SAVE); return v?JSON.parse(v):null; }catch(e){ return null; } }
function lsWrite(s){ try{ localStorage.setItem(LOCAL_SAVE,JSON.stringify(s)); }catch(e){} }
function importLegacy(){
 try{
  const c=localStorage.getItem('blackorbit_coins_v4'); if(c==null) return null;
  return {coins:parseInt(c)||0,skins:JSON.parse(localStorage.getItem('blackorbit_skins_v4')||'["classic"]'),abs:JSON.parse(localStorage.getItem('blackorbit_abs_v4')||'[]'),skin:localStorage.getItem('blackorbit_skin_v4')||'classic',best:parseInt(localStorage.getItem('blackorbit_best_v2')||'0')||0,level:parseInt(localStorage.getItem('blackorbit_level_v2')||'1')||1,lb:JSON.parse(localStorage.getItem('blackorbit_lb_v2')||'[]')};
 }catch(e){ return null; }
}
// Required step 4: one storage.get([...]) at boot; write only on meaningful changes (small debounce groups bursts).
function loadSave(){
 return new Promise(res=>{
  const fallback=()=>{ let s=lsRead()||importLegacy(); saveState=Object.assign(saveDefault(), s||{}); res(); };
  if(typeof bridge!=='undefined'&&bridge&&bridge.storage){
   try{
    let to=setTimeout(fallback,5000);
    bridge.storage.get([K_SAVE]).then(d=>{
     clearTimeout(to);
     let raw=null;
     if(Array.isArray(d)) raw=d[0];
     else if(d&&typeof d==='object') raw=(d.data&&d.data[0])||d[0]||null;
     let parsed=null; try{ parsed=raw?JSON.parse(raw):null; }catch(e){ parsed=null; }
     if(!parsed) parsed=importLegacy();
     saveState=Object.assign(saveDefault(), parsed||{});
     saveState.totalEaten=+saveState.totalEaten||0; saveState.gamesPlayed=+saveState.gamesPlayed||0;
     res();
    }).catch(()=>{ clearTimeout(to); fallback(); });
   }catch(e){ fallback(); }
  } else fallback();
 });
}
let persistTimer=null;
function persist(){
 clearTimeout(persistTimer);
 persistTimer=setTimeout(()=>{ lsWrite(saveState); if(typeof bridge!=='undefined'&&bridge&&bridge.storage){ try{ bridge.storage.set([K_SAVE],[JSON.stringify(saveState)]).catch(()=>{}); }catch(e){} } },400);
}
// storage API (same surface the rest of the game already uses)
const storage={
 get coins(){return +saveState.coins||0}, set coins(v){if(saveState){saveState.coins=Math.max(0,Math.floor(v||0));persist();}},
 get skins(){return saveState.skins||['classic']}, set skins(v){if(saveState){saveState.skins=v||['classic'];persist();}},
 get abs(){return saveState.abs||[]}, set abs(v){if(saveState){saveState.abs=v||[];persist();}},
 get skin(){return saveState.skin||'classic'}, set skin(v){if(saveState){saveState.skin=v;persist();}},
 get best(){return +saveState.best||0}, set best(v){if(saveState){saveState.best=Math.max(0,Math.floor(v||0));persist();}},
 get level(){return +saveState.level||1}, set level(v){if(saveState){saveState.level=Math.max(1,Math.floor(v||0));persist();}},
 get lb(){return saveState.lb||[]}, set lb(v){if(saveState){saveState.lb=v.slice(0,20);persist();}},
 get daily(){return saveState.daily||null}, set daily(v){if(saveState){saveState.daily=v;persist();}},
 get missions(){return saveState.missions||null}, set missions(v){if(saveState){saveState.missions=v;persist();}},
 get achv(){return saveState.achv||[]}, set achv(v){if(saveState){saveState.achv=v||[];persist();}},
 get sound(){return saveState.sound!==false}, set sound(v){if(saveState){saveState.sound=!!v;persist();}},
 get totalEaten(){return +saveState.totalEaten||0}, set totalEaten(v){if(saveState){saveState.totalEaten=Math.max(0,Math.floor(v||0));persist();}},
 get gamesPlayed(){return +saveState.gamesPlayed||0}, set gamesPlayed(v){if(saveState){saveState.gamesPlayed=Math.max(0,Math.floor(v||0));persist();}},
 get aiKills(){return +saveState.aiKills||0}, set aiKills(v){if(saveState){saveState.aiKills=Math.max(0,Math.floor(v||0));persist();}},
};
// ---- platform events: required step 5 (pause & audio) ----
function wirePlatformEvents(){
 if(typeof bridge==='undefined'||!bridge) return;
 try{ bridge.platform.on(bridge.EVENT_NAME.PAUSE_STATE_CHANGED,isPaused=>{ BOOT.forcedPause=!!isPaused; }); }catch(e){}
 try{ bridge.platform.on(bridge.EVENT_NAME.AUDIO_STATE_CHANGED,v=>{ BOOT.audioEnabled=v!==false; }); }catch(e){}
 try{ if(bridge.platform.isAudioEnabled===false) BOOT.audioEnabled=false; }catch(e){}
 try{ if(bridge.advertisement&&bridge.advertisement.interstitialState==='opened'){ BOOT.audioEnabled=false; BOOT.forcedPause=true; } }catch(e){}
}
function platformMsg(msg,extra){ if(typeof bridge==='undefined'||!bridge) return; try{ bridge.platform.sendMessage(msg,extra); }catch(e){} }
function platformCustom(msg){ if(typeof bridge==='undefined'||!bridge) return; try{ bridge.platform.sendCustomMessage(msg); }catch(e){} }
// ---- ads (required steps 7/8: interstitial at natural pauses, rewarded granted only on 'rewarded') ----
function adAvailable(kind){ if(typeof bridge==='undefined'||!bridge||!bridge.advertisement) return false; try{ return kind==='interstitial'?bridge.advertisement.isInterstitialSupported===true:bridge.advertisement.isRewardedSupported===true; }catch(e){ return false; } }
function showInterstitial(placement){ if(!adAvailable('interstitial')) return; try{ bridge.advertisement.showInterstitial(placement); }catch(e){} }
function showRewarded(placement,cb){
 if(!adAvailable('rewarded')){ cb&&cb(false); return; }
 BOOT.rewardedOk=false; BOOT.rewardedCb=cb;
 try{ bridge.advertisement.showRewarded(placement); setTimeout(()=>{ if(BOOT.rewardedCb===cb){ BOOT.rewardedCb=null; // BUG FIX: if the player already earned the reward but no 'closed' event arrived, keep it
   const ok=BOOT.rewardedOk; BOOT.rewardedOk=false; cb&&cb(ok); } },45000); }
 catch(e){ BOOT.rewardedCb=null; cb&&cb(false); }
}
function wireAdEvents(){
 if(typeof bridge==='undefined'||!bridge||!bridge.advertisement) return;
 try{
  bridge.advertisement.on(bridge.EVENT_NAME.REWARDED_STATE_CHANGED,state=>{
   if(state==='rewarded') BOOT.rewardedOk=true;
   if(state==='closed'||state==='failed'){ const ok=BOOT.rewardedOk; BOOT.rewardedOk=false; const cb=BOOT.rewardedCb; BOOT.rewardedCb=null; if(cb) cb(ok); }
  });
 }catch(e){}
}
// ---- sound engine (WebAudio synth, no asset files) ----
let actx=null; const sfxLast={};
function audioCtx(){ if(!actx){ try{ actx=new (window.AudioContext||window.webkitAudioContext)(); }catch(e){} } if(actx&&actx.state==='suspended'){ try{ actx.resume(); }catch(e){} } return actx; }
function mutedNow(){ return !storage.sound||!BOOT.audioEnabled||BOOT.forcedPause; }
function tone(f0,f1,dur,type,vol,when){
 const ac=audioCtx(); if(!ac) return;
 try{
  const o=ac.createOscillator(), g=ac.createGain();
  o.type=type||'sine'; o.frequency.setValueAtTime(f0,when);
  if(f1&&f1!==f0) o.frequency.exponentialRampToValueAtTime(Math.max(20,f1),when+dur);
  g.gain.setValueAtTime(0.0001,when);
  g.gain.exponentialRampToValueAtTime(vol,when+0.012);
  g.gain.exponentialRampToValueAtTime(0.0001,when+dur);
  o.connect(g); g.connect(ac.destination);
  o.start(when); o.stop(when+dur+0.02);
 }catch(e){}
}
function sfx(kind){
 if(mutedNow()||!audioCtx()) return;
 const now=performance.now();
 const gap=(kind==='coin'||kind==='eat')?70:40;
 if(sfxLast[kind]&&now-sfxLast[kind]<gap) return; sfxLast[kind]=now;
 const t=actx.currentTime;
 switch(kind){
  case 'click': tone(660,520,0.06,'square',0.05,t); break;
  case 'eat': tone(340+Math.random()*140,150,0.08,'sine',0.06,t); break;
  case 'coin': tone(880,1320,0.05,'sine',0.05,t); tone(1320,1760,0.07,'sine',0.04,t+0.05); break;
  case 'boost': tone(220,720,0.25,'sawtooth',0.05,t); break;
  case 'vac': tone(520,70,0.4,'triangle',0.09,t); break;
  case 'big': tone(160,60,0.22,'sine',0.14,t); break;
  case 'kill': tone(210,70,0.28,'sawtooth',0.1,t); tone(707,120,0.2,'sine',0.05,t+0.03); break;
  case 'levelup': tone(523,523,0.09,'square',0.05,t); tone(659,659,0.09,'square',0.05,t+0.09); tone(784,1046,0.16,'square',0.06,t+0.18); break;
  case 'unlock': tone(660,660,0.1,'sine',0.07,t); tone(990,990,0.18,'sine',0.07,t+0.1); break;
  case 'fail': tone(240,70,0.5,'sawtooth',0.08,t); break;
  case 'boss': tone(90,38,0.6,'sine',0.18,t); tone(160,55,0.5,'sawtooth',0.08,t); break;
  case 'warn': tone(440,300,0.12,'square',0.05,t); break;
 }
}
document.addEventListener('pointerdown',e=>{ if(e.target&&e.target.closest&&e.target.closest('.btn,.ab,.tab,#exitBtn')) sfx('click'); },{capture:true});
// ---- toast ----
function toast(msg,sub){ const el=document.getElementById('toast'); if(!el) return; el.innerHTML=msg+(sub?'<small>'+sub+'</small>':''); el.classList.add('show'); clearTimeout(toast._t); toast._t=setTimeout(()=>el.classList.remove('show'),2600); }

const canvas=document.getElementById('c'); const ctx=canvas.getContext('2d');
const miniCanvas=document.getElementById('minimap'); const miniCtx=miniCanvas.getContext('2d');
let W,H,DPR; function resize(){DPR=window.devicePixelRatio||1; W=canvas.width=innerWidth*DPR; H=canvas.height=innerHeight*DPR; canvas.style.width=innerWidth+'px'; canvas.style.height=innerHeight+'px';} resize(); addEventListener('resize',()=>{resize();});

const SKINS=[
{id:'classic',name:'Classic Black',price:0,rim:['#000','#1e1b4b','#8b5cf6'],inner:'#000',particle:'#8b5cf6'},
{id:'galaxy',name:'Galaxy Swirl',price:100,rim:['#3b0764','#7c3aed','#06b6d4'],inner:'#2e1065',particle:'#a78bfa'},
{id:'supernova',name:'Supernova',price:250,rim:['#7f1d1d','#f97316','#facc15'],inner:'#431407',particle:'#fb923c'},
{id:'neon',name:'Neon Void',price:400,rim:['#042f2e','#06b6d4','#22d3ee'],inner:'#083344',particle:'#22d3ee'},
{id:'rainbow',name:'Rainbow Singularity',price:600,rim:['#ff0080','#7928ca','#00dfd8'],inner:'#000',particle:'#fff',rainbow:true},
{id:'golden',name:'Golden Abyss',price:1000,rim:['#422006','#facc15','#fde68a'],inner:'#422006',particle:'#facc15'},
{id:'planet',name:'Planet Eater',price:1500,rim:['#0f172a','#22c55e','#06b6d4'],inner:'#052e16',particle:'#22c55e'}
];
const ABILITIES=[
{id:'magnet',name:'Magnetic Pull',desc:'+50% suction range',price:150,icon:'🧲'},
{id:'speed',name:'Speed Boost',desc:'SPACE 40% speed 15s',price:200,icon:'⚡'},
{id:'double',name:'Double Coins',desc:'2x coins next game',price:300,icon:'💰'},
{id:'time',name:'+30s Time',desc:'Extra 30 seconds',price:250,icon:'⏳'},
{id:'growth',name:'Growth Boost',desc:'Start 20% bigger',price:400,icon:'🌱'},
{id:'vacuum',name:'Vacuum Blast',desc:'Q instant suck',price:500,icon:'🌪️'}
];

// storage now lives in the Playgama Bridge Core block at the top (storage getter/setter over saveState)
function skinData(id){return SKINS.find(s=>s.id===id)||SKINS[0]}

// GAME STATE - FIXED WITH ZOOM
let game={
 running:false,isBoss:false,
 hole:{x:0,y:0,r:28,targetR:28,vx:0,vy:0,pulse:0},
 mouse:{x:0,y:0,down:false},
 keys:{},objs:[],particles:[],coins:[],floatTexts:[],rings:[],ai:[],boss:null,
 score:0,coinsEarned:0,eaten:0,aiEaten:0,time:120,maxTime:120,
 magnet:1,speedBoost:0,speedMult:1,vacuumTimer:0,vacuumCd:0,selectedSkin:'classic',hasDouble:false,shake:0,beingEaten:0,
 zoom:1,targetZoom:1
};
let cam={x:0,y:0};
let lastTime=0;
let rafId=null;
let spawnTimer=0; // for continuous spawning

function createWorld(isBoss){
 game.objs=[];
 const types=[{t:'person',s:10,c:1},{t:'hydrant',s:14,c:1},{t:'bench',s:18,c:1},{t:'tree',s:24,c:2},{t:'car',s:34,c:3},{t:'building',s:56,c:10}];
 const mapSize=isBoss?5000:4600;
 const count=isBoss?180:160;
 for(let i=0;i<count;i++){
   const pick=i<count*0.32?types[0]:i<count*0.47?types[1]:i<count*0.6?types[2]:i<count*0.76?types[3]:i<count*0.92?types[4]:types[5];
   let tries=0,x,y;
   do{
     x=(Math.random()-0.5)*mapSize;
     y=(Math.random()-0.5)*mapSize;
     tries++;
     if(tries>30) break;
   }while(game.objs.some(o=>Math.hypot(o.x-x,o.y-y)<46));
   game.objs.push({x,y,baseR:pick.s+Math.random()*6,r:pick.s,type:pick.t,coinVal:pick.c,rot:Math.random()*6.28,wobble:Math.random()*10,beingSucked:false,suckT:0,scale:1,alive:true});
 }
 game.objs.forEach(o=>o.r=o.baseR);
 if(isBoss){
   game.boss={x:0,y:-800,r:92,targetR:92,maxR:92,vx:0,vy:0,alive:true,scale:1,hp:1,phase:0,attackCd:2,suckT:0};
   game.ai=[
     {x:-520,y:-420,r:24,targetR:24,vx:0,vy:0,color:'#ef4444',alive:true,scale:1,suckT:0,respawn:0,name:'Red Hole',score:0},
     {x:520,y:420,r:28,targetR:28,vx:0,vy:0,color:'#22c55e',alive:true,scale:1,suckT:0,respawn:0,name:'Green Hole',score:0}
   ];
 } else {
   game.ai=[
     {x:-420,y:-320,r:22,targetR:22,vx:0,vy:0,color:'#ef4444',alive:true,scale:1,suckT:0,respawn:0,name:'Red Hole',score:0},
     {x:520,y:320,r:26,targetR:26,vx:0,vy:0,color:'#22c55e',alive:true,scale:1,suckT:0,respawn:0,name:'Green Hole',score:0},
     {x:80,y:620,r:20,targetR:20,vx:0,vy:0,color:'#eab308',alive:true,scale:1,suckT:0,respawn:0,name:'Yellow Hole',score:0}
   ];
   game.boss=null;
 }
}

function startGame(){ initGame(false); }
function startBoss(){ initGame(true); }
function initGame(isBoss){
 if(rafId){ cancelAnimationFrame(rafId); rafId=null; }
 const sel=storage.skin;
 let extraTime=storage.abs.includes('time')?30:0;
 let isGrowth=storage.abs.includes('growth');
 let isMagnet=storage.abs.includes('magnet');
 let isDouble=storage.abs.includes('double');
 let baseTime=isBoss?180:120;
 // RESET ALL STATE - BUG FIX: clear arrays
 game={
   running:true,isBoss:isBoss,
   hole:{x:0,y:0,r:isGrowth?34:28,targetR:isGrowth?34:28,vx:0,vy:0,pulse:0},
   level:1, levelProgress:0, levelTarget:10, totalEatenForLevel:0,
   mouse:{x:innerWidth/2,y:innerHeight/2,down:false},
   keys:{},objs:[],particles:[],coins:[],floatTexts:[],rings:[],ai:[],boss:null,
   score:0,coinsEarned:0,eaten:0,aiEaten:0,time:baseTime+extraTime,maxTime:baseTime+extraTime,
   magnet:isMagnet?1.5:1,speedBoost:0,speedMult:1,vacuumTimer:0,vacuumCd:0,selectedSkin:sel,hasDouble:isDouble,shake:0,beingEaten:0,
   zoom:1.0,targetZoom:1.0,hasRevived:false,reviveTitle:''
 };
 let abs=storage.abs.filter(a=>a!=='double'&&a!=='time');
 storage.abs=abs;
 createWorld(isBoss);
 cam={x:0,y:0};
 lastTime=0;
 spawnTimer=0;
 document.getElementById('startOverlay').style.display='none';
 document.getElementById('endOverlay').style.display='none';
 document.getElementById('shopOverlay').style.display='none';
 document.getElementById('reviveOverlay').style.display='none';
 document.getElementById('bossBar').style.display=isBoss?'block':'none';
 document.getElementById('exitBtn').style.display='block';
 document.getElementById('bossHp').style.width='100%';
 document.getElementById('bossPct').textContent='100%';
 // BUG FIX: 'boss' mission must count on DEFEAT, not on starting the boss run
 platformMsg('level_started',{world:isBoss?'boss_hunt':'planet_city',level:'1'});
 buildAbilities();
 rafId=requestAnimationFrame(loop);
}

function buildAbilities(){
 const cont=document.getElementById('abilities'); cont.innerHTML='';
 let hasSpeed=storage.abs.includes('speed'),hasVac=storage.abs.includes('vacuum');
 let d=document.createElement('div'); d.className='ab'+(hasSpeed?'':' locked'); d.innerHTML='⚡<div class="key">SPACE</div>';
 d.addEventListener('click',()=>activateSpeed());
 d.addEventListener('touchstart',(e)=>{e.preventDefault(); activateSpeed();});
 cont.appendChild(d);
 let d2=document.createElement('div'); d2.className='ab'+(hasVac?'':' locked'); d2.innerHTML='🌪️<div class="key">Q</div><div class="cd" id="vacCd" style="display:none">0</div>';
 d2.addEventListener('click',()=>triggerVacuum());
 d2.addEventListener('touchstart',(e)=>{e.preventDefault(); triggerVacuum();});
 cont.appendChild(d2);
}
function activateSpeed(){
 if(!game.running||game.speedBoost>0) return;
 if(storage.abs.includes('speed')){ game.speedBoost=15; game.speedMult=1.45; }
 else{ game.speedBoost=5; game.speedMult=1.25; }
 spawnFloat(game.hole.x,game.hole.y,'SPEED!', '#22d3ee'); game.hole.pulse=1;
 sfx('boost');
}
function triggerVacuum(){
 if(!game.running||game.vacuumCd>0.1) return;
 let owned=storage.abs.includes('vacuum');
 let radius=owned?360:200;
 game.vacuumCd=owned?20:8; game.shake=owned?14:6; game.vacuumTimer=owned?1.4:0.8;
 sfx('vac');
 let rc=owned?'#8b5cf6':'#64748b'; let gap=owned?90:55;
 for(let k=0;k<3;k++) game.rings.push({x:game.hole.x,y:game.hole.y,r:10,life:1,maxR:radius+k*gap,color:rc});
 game.ai.forEach(ai=>{ if(ai.alive&&Math.hypot(ai.x-game.hole.x,ai.y-game.hole.y)<radius*1.1&&game.hole.r>ai.r*1.1) ai.suckT=0.2; });
 if(game.boss&&game.boss.alive&&owned&&Math.hypot(game.boss.x-game.hole.x,game.boss.y-game.hole.y)<radius) game.boss.suckT=0.1;
 for(let i=0;i<(owned?50:18);i++) game.particles.push({x:game.hole.x,y:game.hole.y,vx:(Math.random()-0.5)*600,vy:(Math.random()-0.5)*600,life:1,color:rc,size:3+Math.random()*5});
}
function spawnCoin(x,y,val){ for(let i=0;i<val;i++) game.coins.push({x:x+(Math.random()-0.5)*16,y:y+(Math.random()-0.5)*16,vx:(Math.random()-0.5)*240,vy:(Math.random()-0.5)*240-70,life:1,t:0,ay:340}); }
function spawnFloat(x,y,txt,color,small=false){ if(small){ game.floatTexts.push({x,y,txt,color,life:0.7,vy:-8,scale:1,small:true}); } else { game.floatTexts.push({x,y,txt,color,life:1,vy:-55,scale:1,small:false}); } }
// FIXED: worldToScreen now uses zoom
function worldToScreen(wx,wy){ return {x:(wx-cam.x)*game.zoom*DPR+W/2, y:(wy-cam.y)*game.zoom*DPR+H/2, scale:game.zoom}; }

function loop(ts){
 if(BOOT.forcedPause){ lastTime=ts; rafId=requestAnimationFrame(loop); return; } // platform pause (ad/tab): freeze gameplay
 if(!game.running){ rafId=null; return; }
 if(!lastTime) lastTime=ts;
 let dt=Math.min((ts-lastTime)/1000,0.033);
 lastTime=ts;
 if(dt<=0||isNaN(dt)) dt=0.016;
 update(dt);
 if(!game.running){ rafId=null; return; } // endGame may have fired inside update
 draw(dt);
 updateLeaderboard();
 drawMinimap();
 rafId=requestAnimationFrame(loop);
}

function update(dt){
 // BUG FIX: Clamp dt, prevent NaN
 if(isNaN(dt)||dt>0.05) dt=0.016;

  // ULTRA FAST STABLE ZOOM + 150 LVL (BUG FIX: 3x faster zoom transitions)
  let currentLevel = game.level;
  let tZoom;
  // More steps, smaller drops
  if(currentLevel <= 2) tZoom = 1.0;
  else if(currentLevel <= 3) tZoom = 0.92;
  else if(currentLevel <= 4) tZoom = 0.85;
  else if(currentLevel <= 5) tZoom = 0.78;
  else if(currentLevel <= 6) tZoom = 0.70;
  else if(currentLevel <= 8) tZoom = 0.62;
  else if(currentLevel <= 10) tZoom = 0.54;
  else tZoom = 0.48;
  if(game.isBoss) tZoom = Math.min(tZoom, 0.60);
  game.targetZoom = tZoom;
  // BUG FIX: 3x faster zoom lerp for smoother gameplay (0.003 -> 0.009)
  let zoomDiff = game.targetZoom - game.zoom;
  let maxChange = 0.009; // 3x faster zoom transitions
  if(zoomDiff < -maxChange) zoomDiff = -maxChange;
  if(zoomDiff > maxChange) zoomDiff = maxChange;
  game.zoom += zoomDiff * 0.35; // faster interpolation (0.18 -> 0.35)
  game.zoom = Math.max(0.48, Math.min(1.0, game.zoom));

 // FIXED: Mouse control with zoom compensation
  let mx=(game.mouse.x-innerWidth/2)/DPR/game.zoom+cam.x;
  let my=(game.mouse.y-innerHeight/2)/DPR/game.zoom+cam.y;
  let ix=0,iy=0;
  if(game.keys['w']||game.keys['ArrowUp']) iy=-1;
  if(game.keys['s']||game.keys['ArrowDown']) iy=1;
  if(game.keys['a']||game.keys['ArrowLeft']) ix=-1;
  if(game.keys['d']||game.keys['ArrowRight']) ix=1;
  if(ix||iy){ let l=Math.hypot(ix,iy)||1; ix/=l; iy/=l; mx=game.hole.x+ix*260; my=game.hole.y+iy*260; }
  let dx=mx-game.hole.x, dy=my-game.hole.y, dist=Math.hypot(dx,dy);
  let speed=1100*(game.speedBoost>0?(game.speedMult||1.25):1); // BUG FIX: 2.5x faster movement (440->1100)
  if(dist>5){ game.hole.vx+=dx/dist*speed*dt*8.5; game.hole.vy+=dy/dist*speed*dt*8.5; } // BUG FIX: 2x faster acceleration (4.2->8.5)
  game.hole.vx*=0.92; game.hole.vy*=0.92; // BUG FIX: less friction for smoother movement (0.88->0.92)
 game.hole.x+=game.hole.vx*dt; game.hole.y+=game.hole.vy*dt;
 const mapClamp=game.isBoss?2400:2300;
 game.hole.x=Math.max(-mapClamp,Math.min(mapClamp,game.hole.x));
 game.hole.y=Math.max(-mapClamp,Math.min(mapClamp,game.hole.y));
 if(game.speedBoost>0) game.speedBoost=Math.max(0,game.speedBoost-dt);
 if(game.vacuumTimer>0) game.vacuumTimer=Math.max(0,game.vacuumTimer-dt);
 if(game.vacuumCd>0){
   game.vacuumCd=Math.max(0,game.vacuumCd-dt);
   let el=document.getElementById('vacCd');
   if(el){ el.style.display=game.vacuumCd>0.05?'flex':'none'; if(game.vacuumCd>0) el.textContent=Math.ceil(game.vacuumCd).toString(); }
 }
  game.hole.r+=(game.hole.targetR-game.hole.r)*0.18; // BUG FIX: Faster size growth (0.13->0.18)
  if(game.hole.r>140) game.hole.r=140;
  if(game.hole.targetR>140) game.hole.targetR=140;
  if(game.hole.pulse>0) game.hole.pulse=Math.max(0,game.hole.pulse-dt*3);
  cam.x+=(game.hole.x-cam.x)*0.22; // BUG FIX: Faster camera follow (0.13->0.22)
  cam.y+=(game.hole.y-cam.y)*0.22;
  if(game.shake>0) game.shake=Math.max(0,game.shake-dt*22);

  // PLANET SPAWN RATE: spawn new planets faster for more dynamic gameplay
  spawnTimer+=dt;
  if(spawnTimer>2.4){ // BUG FIX: Faster spawn rate (3.2->2.4 seconds)
    spawnTimer=0;
    let aliveCount=game.objs.filter(o=>o.alive).length;
    if(aliveCount<120){
      const types=[{t:'person',s:10,c:1},{t:'hydrant',s:14,c:1},{t:'bench',s:18,c:1},{t:'tree',s:24,c:2},{t:'car',s:34,c:3},{t:'building',s:56,c:10}];
      let toSpawn=aliveCount<60?3:aliveCount<90?2:1;
      for(let s=0;s<toSpawn;s++){
        let pick=types[Math.floor(Math.random()*types.length)];
        let ang=Math.random()*6.28; let dist=800+Math.random()*400;
        let x=game.hole.x+Math.cos(ang)*dist; let y=game.hole.y+Math.sin(ang)*dist;
        x=Math.max(-mapClamp,Math.min(mapClamp,x)); y=Math.max(-mapClamp,Math.min(mapClamp,y));
        if(game.objs.some(o=>o.alive&&Math.hypot(o.x-x,o.y-y)<50)) continue;
        game.objs.push({x,y,baseR:pick.s+Math.random()*6,r:pick.s,type:pick.t,coinVal:pick.c,rot:Math.random()*6.28,wobble:Math.random()*10,beingSucked:false,suckT:0,scale:0.2,alive:true});
      }
    }
  }

  // OBJECTS (em: magnet x2.6 pull during vacuum blast; suckR increased for better gameplay)
  let em=game.magnet*(game.vacuumTimer>0?2.6:1);
  let suckR=Math.min(720,game.hole.r*3.2*em); // BUG FIX: Increased suction range (620->720, 2.9->3.2)
  for(let o of game.objs){
    if(!o.alive) continue;
    let d=Math.hypot(o.x-game.hole.x,o.y-game.hole.y);
    let canEat=o.baseR<=game.hole.r*1.12;
    if(d<suckR){
      if(canEat){
        o.beingSucked=true; o.suckT+=dt*4.5; // BUG FIX: Faster eating (3.8->4.5)
        o.x+=(game.hole.x-o.x)*dt*6.2; o.y+=(game.hole.y-o.y)*dt*6.2; // BUG FIX: Faster pull (5.2->6.2)
        o.scale=Math.max(0,1-o.suckT); o.wobble+=dt*26;
        if(o.suckT>0.65){ // BUG FIX: Faster eat threshold (0.7->0.65)
         o.alive=false; game.score+=Math.floor(o.baseR*2); game.eaten++;
         trackMission('eaten',1); storage.totalEaten=storage.totalEaten+1;
         sfx(o.baseR>40?'big':'eat');
         let mult=game.hasDouble?2:1; let cv=o.coinVal*mult;
         spawnCoin(o.x,o.y,cv); game.coinsEarned+=cv;
          game.hole.targetR=Math.min(140, game.hole.targetR+o.baseR*0.125); // BUG FIX: Faster growth (0.105->0.125)
          game.hole.pulse=1;
          if(o.baseR>40){
            game.shake=Math.max(game.shake,o.baseR*0.22);
            game.rings.push({x:game.hole.x,y:game.hole.y,r:game.hole.r,life:1,maxR:game.hole.r+70,color:'#ffffff'});
            spawnFloat(o.x,o.y,'+'+Math.floor(o.baseR*2).toLocaleString('en-US'), '#ffffff');
          }
          for(let i=0;i<8;i++) game.particles.push({x:o.x,y:o.y,vx:(Math.random()-0.5)*360,vy:(Math.random()-0.5)*360,life:1,color:skinData(game.selectedSkin).particle,size:3+Math.random()*4});
          if(game.particles.length>200) game.particles.splice(0,game.particles.length-200);
          let fill=document.getElementById('sizeFill');
          if(fill){ fill.classList.remove('pulse'); void fill.offsetWidth; fill.classList.add('pulse'); }
          // LEVEL SYSTEM (fix: progress now actually counts + levels up faster)
          game.totalEatenForLevel++;
          if(game.totalEatenForLevel>=game.levelTarget){
            game.totalEatenForLevel=0; game.level++;
            game.levelTarget=Math.min(55,Math.round(game.levelTarget*1.35)+2); // BUG FIX: Slightly easier progression (60->55, 1.4->1.35)
            game.hole.targetR=Math.min(140,game.hole.targetR+10); // BUG FIX: Bigger level-up bonus (8->10)
            game.rings.push({x:game.hole.x,y:game.hole.y,r:game.hole.r,life:1,maxR:game.hole.r+160,color:'#22d3ee'});
            spawnFloat(game.hole.x,game.hole.y-34,'LEVEL UP • Lv '+game.level,'#22d3ee');
            game.shake=Math.max(game.shake,10);
            sfx('levelup'); trackMission('level',game.level);
          }
       }
     } else {
       let ang=Math.atan2(o.y-game.hole.y,o.x-game.hole.x);
       o.x+=Math.cos(ang)*30*dt; o.y+=Math.sin(ang)*30*dt;
     }
   } else {
     o.beingSucked=false; o.suckT=Math.max(0,o.suckT-dt*2.2); o.scale=Math.min(1,o.scale+dt*6);
   }
 }

  // BOSS - BUG FIX: Faster boss movement (120->180)
  if(game.boss && game.boss.alive){
    let b=game.boss;
    b.attackCd-=dt;
    let dToPlayer=Math.hypot(b.x-game.hole.x,b.y-game.hole.y);
    if(dToPlayer>80){ let ang=Math.atan2(game.hole.y-b.y,game.hole.x-b.x); b.vx+=Math.cos(ang)*180*dt; b.vy+=Math.sin(ang)*180*dt; } // 50% faster
    b.vx*=0.92; b.vy*=0.92; b.x+=b.vx*dt; b.y+=b.vy*dt;
   b.x=Math.max(-mapClamp,Math.min(mapClamp,b.x)); b.y=Math.max(-mapClamp,Math.min(mapClamp,b.y));
   for(let o of game.objs){ if(!o.alive) continue; if(Math.hypot(o.x-b.x,o.y-b.y)<b.r*1.1 && o.baseR<=b.r*1.1){ o.alive=false; b.targetR=Math.min(145,b.targetR+o.baseR*0.04); } } // BUG FIX: cap boss growth so the fight stays winnable
   b.r+=(b.targetR-b.r)*0.08;
   if(b.attackCd<=0){ b.attackCd=4+Math.random()*2; game.rings.push({x:b.x,y:b.y,r:20,life:1,maxR:360,color:'#ef4444'}); }
   if(game.hole.r>b.r*0.85 && dToPlayer<b.r*1.6){
     b.suckT+=dt*0.9; b.x+=(game.hole.x-b.x)*dt*1.2; b.y+=(game.hole.y-b.y)*dt*1.2;
     b.scale=Math.max(0.4,1-b.suckT*0.15); b.hp=Math.max(0,1-b.suckT*0.22);
     let hpEl=document.getElementById('bossHp'); let pctEl=document.getElementById('bossPct');
     if(hpEl) hpEl.style.width=(b.hp*100)+'%';
     if(pctEl) pctEl.textContent=Math.floor(b.hp*100).toLocaleString('en-US')+'%';
     game.hole.targetR=Math.min(140, game.hole.targetR+0.04);
     if(b.hp<=0){
       b.alive=false; game.score+=1000; game.coinsEarned+=100*(game.hasDouble?2:1); game.shake=28;
       trackMission('boss',1); // BUG FIX: count boss mission on actual defeat
       for(let i=0;i<80;i++) game.particles.push({x:b.x,y:b.y,vx:(Math.random()-0.5)*700,vy:(Math.random()-0.5)*700,life:1,color:'#ef4444',size:6});
       spawnFloat(b.x,b.y,'BOSS DEFEATED! +1000', '#ef4444');
       storage.level=Math.max(storage.level,2);
       sfx('boss'); platformMsg('player_got_achievement'); platformCustom('boss_defeated');
       endGame('BOSS DEFEATED!'); return;
     }
   }
   if(b.r>game.hole.r*1.6 && dToPlayer<b.r*0.85){
     game.beingEaten+=dt;
     if(game.beingEaten>1.4){ if(!game.hasRevived) offerRevive('EATEN BY BOSS!'); else endGame('EATEN BY BOSS!'); return; }
   } else { game.beingEaten=Math.max(0,game.beingEaten-dt); }
 }

 // AI
 for(let ai of game.ai){
   if(!ai.alive){
     ai.respawn-=dt;
     if(ai.respawn<=0){
       let ang=Math.random()*6.28; let dist=900+Math.random()*300;
       ai.x=Math.cos(ang)*dist; ai.y=Math.sin(ang)*dist;
       ai.r=18+Math.random()*10; ai.targetR=ai.r; ai.alive=true; ai.scale=0; ai.suckT=0; ai.score=0;
       ai.huntTimer=0; ai.state='hunt';
     } else continue;
   }
   if(ai.scale<1) ai.scale=Math.min(1,ai.scale+dt*2.2);
   // ULTRA SMART AI + BORDER
   ai.huntTimer=(ai.huntTimer||0)+dt;
   let mapLimit=game.isBoss?2500:2300;
   if(ai.x < -mapLimit+200) ai.vx+=350*dt;
   if(ai.x > mapLimit-200) ai.vx-=350*dt;
   if(ai.y < -mapLimit+200) ai.vy+=350*dt;
   if(ai.y > mapLimit-200) ai.vy-=350*dt;

   let isBiggerThanPlayer = ai.r > game.hole.r * 1.15;
   let dToPlayer = Math.hypot(game.hole.x-ai.x, game.hole.y-ai.y);
   
    // If bigger than player, become predator - hunt player aggressively
    if(isBiggerThanPlayer && dToPlayer < 600){
      ai.state='predator';
      // BUG FIX: Faster AI chase speed (580->820)
      let predX=game.hole.x+game.hole.vx*0.5; let predY=game.hole.y+game.hole.vy*0.5;
      let ang=Math.atan2(predY-ai.y, predX-ai.x);
      let predatorSpeed = 820 + (ai.r - game.hole.r)*12; // faster if much bigger
      ai.vx+=Math.cos(ang)*predatorSpeed*dt;
      ai.vy+=Math.sin(ang)*predatorSpeed*dt;
   } else {
     // Normal hunting: find best food, avoid bigger holes
     ai.state='hunt';
     let best=null,bd=1e9;
     for(let o of game.objs){
       if(!o.alive) continue;
       if(o.baseR>ai.r*1.1) continue;
       // Avoid food near bigger holes
       let nearBiggerHole=false;
       for(let other of game.ai){
         if(other===ai||!other.alive) continue;
         if(other.r>ai.r*1.3 && Math.hypot(o.x-other.x,o.y-other.y)<other.r*2) { nearBiggerHole=true; break; }
       }
       if(game.hole.r>ai.r*1.3 && Math.hypot(o.x-game.hole.x,o.y-game.hole.y)<game.hole.r*2) nearBiggerHole=true;
       if(nearBiggerHole) continue;
       let d=Math.hypot(o.x-ai.x,o.y-ai.y);
       // Prefer bigger food that is still eatable
       let score = d - o.baseR*2;
       if(score<bd){bd=score; best=o;}
     }
     // If can eat smaller AI, hunt it
     for(let other of game.ai){
       if(other===ai||!other.alive) continue;
       if(ai.r>other.r*1.25){
         let d=Math.hypot(other.x-ai.x, other.y-ai.y);
         if(d<bd){ bd=d; best=other; }
       }
     }
     // Opportunistic: if player is smaller and close, hunt player
     if(ai.r>game.hole.r*1.1 && dToPlayer<300){
       if(dToPlayer<bd){ best={x:game.hole.x,y:game.hole.y, isPlayer:true}; bd=dToPlayer; }
     }
      if(best){
        let ang=Math.atan2(best.y-ai.y,best.x-ai.x);
        let speed = 520 + (ai.r*2); // BUG FIX: Faster AI hunting (380->520, multiplier 1.5->2)
        ai.vx+=Math.cos(ang)*speed*dt;
        ai.vy+=Math.sin(ang)*speed*dt;
     } else {
       // Wander if no target
       if(ai.huntTimer>2){
         ai.huntTimer=0;
         let ang=Math.random()*6.28;
         ai.vx+=Math.cos(ang)*200*dt;
         ai.vy+=Math.sin(ang)*200*dt;
       }
     }
   }

   ai.vx*=0.9; ai.vy*=0.9; ai.x+=ai.vx*dt; ai.y+=ai.vy*dt;
   ai.x=Math.max(-mapClamp,Math.min(mapClamp,ai.x)); ai.y=Math.max(-mapClamp,Math.min(mapClamp,ai.y));
   ai.r+=(ai.targetR-ai.r)*0.11;
   for(let o of game.objs){ if(!o.alive) continue; if(Math.hypot(o.x-ai.x,o.y-ai.y)<ai.r*1.15 && o.baseR<=ai.r*1.1){ o.alive=false; ai.targetR=Math.min(130,ai.targetR+o.baseR*0.11); ai.score=(ai.score||0)+Math.floor(o.baseR*2); } }
   for(let other of game.ai){
     if(other===ai||!other.alive||!ai.alive) continue;
     if(ai.r>other.r*1.2 && Math.hypot(ai.x-other.x,ai.y-other.y)<ai.r*1.1){
       other.suckT+=dt*2.2; other.x+=(ai.x-other.x)*dt*3.2; other.y+=(ai.y-other.y)*dt*3.2;
       other.scale=Math.max(0,1-other.suckT);
       if(other.suckT>1){ other.alive=false; other.respawn=5; ai.targetR=Math.min(130,ai.targetR+other.r*0.26); ai.score=(ai.score||0)+Math.floor(other.r*5); }
     }
   }
   // dToPlayer already calculated above
   if(ai.alive&&game.hole.r>ai.r*1.2 && dToPlayer<game.hole.r*1.55){
     ai.suckT+=dt*2.6; ai.x+=(game.hole.x-ai.x)*dt*4.2; ai.y+=(game.hole.y-ai.y)*dt*4.2; ai.scale=Math.max(0,1-ai.suckT*0.85);
     if(dToPlayer<24 || ai.suckT>1.25){
       ai.alive=false; ai.respawn=5; game.score+=Math.floor(ai.r*5); game.aiEaten++;
       sfx('kill'); trackMission('aiEaten',1);
       storage.aiKills=(+storage.aiKills||0)+1;
       let cv=20*(game.hasDouble?2:1); spawnCoin(ai.x,ai.y,cv); game.coinsEarned+=cv;
       game.hole.targetR=Math.min(140,game.hole.targetR+ai.r*0.32); game.shake=20; game.hole.pulse=1;
       for(let i=0;i<32;i++) game.particles.push({x:ai.x,y:ai.y,vx:(Math.random()-0.5)*440,vy:(Math.random()-0.5)*440,life:1,color:ai.color,size:5});
       game.rings.push({x:game.hole.x,y:game.hole.y,r:game.hole.r,life:1,maxR:game.hole.r+130,color:'#ffffff'});
       spawnFloat(ai.x,ai.y,'HOLE EATEN! +'+Math.floor(ai.r*5).toLocaleString('en-US'), '#8b5cf6');
     }
   }
   if(ai.alive&&ai.r>game.hole.r*1.5 && dToPlayer<ai.r*0.9){
     game.beingEaten+=dt;
     if(game.beingEaten>1.5){ if(!game.hasRevived) offerRevive('EATEN BY RIVAL!'); else endGame('EATEN BY RIVAL!'); return; }
   } else { if(dToPlayer>ai.r*1.5) game.beingEaten=Math.max(0,game.beingEaten-dt); }
 }

  // COINS - FIXED MAGNET + MEMORY LEAK PROTECTION
  for(let i=game.coins.length-1;i>=0;i--){
    let c=game.coins[i];
    if(!c||isNaN(c.x)||isNaN(c.y)) { game.coins.splice(i,1); continue; } // BUG FIX: Check both x and y
    c.t+=dt; c.vy+=c.ay*dt; c.x+=c.vx*dt; c.y+=c.vy*dt; c.vx*=0.97;
    if(c.t>0.35){
      let ddx=game.hole.x-c.x, ddy=game.hole.y-c.y;
      let dl=Math.hypot(ddx,ddy)||1;
      c.vx+=ddx/dl*720*dt; c.vy+=ddy/dl*720*dt;
      if(dl<game.hole.r*1.15){
        game.coins.splice(i,1);
        spawnFloat(game.hole.x,game.hole.y+18,'+1','#facc15', true); // small number
        sfx('coin');
        for(let k=0;k<3;k++) game.particles.push({x:game.hole.x,y:game.hole.y,vx:(Math.random()-0.5)*200,vy:(Math.random()-0.5)*200,life:1,color:'#facc15',size:3});
      }
    }
    if(c.t>8) game.coins.splice(i,1);
  }
  // BUG FIX: Aggressive memory leak prevention - cap arrays
  if(game.coins.length>300) game.coins.splice(0, game.coins.length-300);
  
  // PARTICLES - FIXED LEAK + NaN PROTECTION
  for(let i=game.particles.length-1;i>=0;i--){
    let p=game.particles[i];
    if(!p||isNaN(p.x)||isNaN(p.y)||isNaN(p.vx)||isNaN(p.vy)) { game.particles.splice(i,1); continue; } // BUG FIX: Full NaN check
    p.life-=dt*1.4; p.x+=p.vx*dt; p.y+=p.vy*dt; p.vx*=0.97; p.vy*=0.97;
    if(p.life<=0) game.particles.splice(i,1);
  }
  // BUG FIX: Hard cap particles to prevent memory explosion
  if(game.particles.length>400) game.particles.splice(0, game.particles.length-400);
  
  for(let i=game.floatTexts.length-1;i>=0;i--){
    let f=game.floatTexts[i]; 
    if(!f||isNaN(f.x)||isNaN(f.y)) { game.floatTexts.splice(i,1); continue; } // BUG FIX: NaN check
    f.life-=dt;
    if(!f.small){ f.y+=f.vy*dt; f.scale=f.life; } else { f.y+=f.vy*dt*0.2; f.scale=1; } // +1 no animation, stays small
    if(f.life<=0) game.floatTexts.splice(i,1);
  }
  // BUG FIX: Cap float texts
  if(game.floatTexts.length>50) game.floatTexts.splice(0, game.floatTexts.length-50);
  
  for(let i=game.rings.length-1;i>=0;i--){
    let r=game.rings[i]; 
    if(!r||isNaN(r.x)||isNaN(r.y)||isNaN(r.r)) { game.rings.splice(i,1); continue; } // BUG FIX: NaN check
    r.life-=dt*1.25; r.r+=(r.maxR-r.r)*dt*3.2;
    if(r.life<=0) game.rings.splice(i,1);
  }

 game.time-=dt;
 if(game.time<=0){ game.time=0; endGame(game.isBoss?'BOSS ESCAPED!':"TIME'S UP!"); return; }

 // UI UPDATE - BUG FIX: Check elements exist
 let scoreEl=document.getElementById('score'); if(scoreEl) scoreEl.textContent=game.score.toLocaleString('en-US');
 let timerEl=document.getElementById('timer'); if(timerEl){ let pill=timerEl.closest('.pill'); if(pill) pill.style.color=game.time<15?'#ef4444':'#fff'; timerEl.textContent=String(Math.floor(game.time/60)).padStart(2,'0')+':'+String(Math.floor(game.time%60)).padStart(2,'0'); }
 let coinsEl=document.getElementById('coins'); if(coinsEl) coinsEl.textContent=game.coinsEarned.toLocaleString('en-US');
 let levelEl=document.getElementById('level'); if(levelEl) levelEl.textContent=String(game.level);
 let sizeFill=document.getElementById('sizeFill'); if(sizeFill){ let prog=game.levelTarget>0?(game.totalEatenForLevel/game.levelTarget)*100:0; sizeFill.style.width=Math.min(100,prog)+'%'; }
 let sizeTxt=document.getElementById('sizeTxt'); if(sizeTxt) sizeTxt.textContent='Lv '+game.level;
 let zoomTxt=document.getElementById('zoomTxt'); if(zoomTxt) zoomTxt.textContent=Math.floor(game.zoom*100).toLocaleString('en-US')+'%';
 let zoomStable=document.getElementById('zoomStable'); if(zoomStable) zoomStable.textContent=Math.floor(game.zoom*100).toLocaleString('en-US')+'%';
 let nextLv=document.getElementById('nextLv'); if(nextLv){ let need=Math.max(0, game.levelTarget-game.totalEatenForLevel); nextLv.textContent=need.toLocaleString('en-US')+' / '+game.levelTarget.toLocaleString('en-US')+' to Lv '+(game.level+1); }
}

function updateLeaderboard(){
 const lbList=document.getElementById('lbList');
 if(!lbList) return;
 let entries=[];
 entries.push({name:'YOU',score:game.score,color:skinData(game.selectedSkin).rim[2],me:true});
 game.ai.forEach(ai=>{ if(ai.alive) entries.push({name:ai.name||'Rival',score:ai.score||0,color:ai.color,me:false}); });
 if(game.boss&&game.boss.alive) entries.push({name:'BOSS',score:Math.floor((1-game.boss.hp)*800),color:'#ef4444',boss:true});
 entries.sort((a,b)=>b.score-a.score);
 lbList.innerHTML=entries.slice(0,5).map((e,i)=>{
   let rank=['🥇','🥈','🥉','4.','5.'][i]||i+1;
   return `<div class="lb-row ${e.me?'me':''} ${e.boss?'boss':''}"><div class="lb-name"><span>${rank}</span><span class="lb-dot" style="background:${e.color}"></span><span>${e.name}</span></div><div class="lb-score">${(e.score||0).toLocaleString('en-US')}</div></div>`;
 }).join('');
}

function drawMinimap(){
 const size=140; const mapSize=game.isBoss?4800:4600; // BUG FIX: was half the real map width, shifting every blip off-center
 miniCtx.clearRect(0,0,size,size);
 miniCtx.fillStyle='#0f172a'; miniCtx.fillRect(0,0,size,size);
 miniCtx.strokeStyle='rgba(255,255,255,0.06)'; miniCtx.lineWidth=0.5;
 for(let i=0;i<=4;i++){ miniCtx.beginPath(); miniCtx.moveTo(i*size/4,0); miniCtx.lineTo(i*size/4,size); miniCtx.stroke(); miniCtx.beginPath(); miniCtx.moveTo(0,i*size/4); miniCtx.lineTo(size,i*size/4); miniCtx.stroke(); }
 miniCtx.fillStyle='rgba(255,255,255,0.22)';
 game.objs.forEach(o=>{ if(!o.alive) return; let x=(o.x/mapSize+0.5)*size; let y=(o.y/mapSize+0.5)*size; if(x<0||x>size||y<0||y>size) return; miniCtx.beginPath(); miniCtx.arc(x,y,o.type==='building'?2.2:1.1,0,6.28); miniCtx.fill(); });
 game.ai.forEach(ai=>{ if(!ai.alive) return; let x=(ai.x/mapSize+0.5)*size; let y=(ai.y/mapSize+0.5)*size; miniCtx.fillStyle=ai.color; miniCtx.beginPath(); miniCtx.arc(x,y,3.5,0,6.28); miniCtx.fill(); });
 if(game.boss&&game.boss.alive){ let x=(game.boss.x/mapSize+0.5)*size; let y=(game.boss.y/mapSize+0.5)*size; miniCtx.fillStyle='#ef4444'; miniCtx.shadowColor='#ef4444'; miniCtx.shadowBlur=6; miniCtx.beginPath(); miniCtx.arc(x,y,6,0,6.28); miniCtx.fill(); miniCtx.shadowBlur=0; }
 let px=(game.hole.x/mapSize+0.5)*size; let py=(game.hole.y/mapSize+0.5)*size;
 miniCtx.fillStyle='#fff'; miniCtx.strokeStyle='#8b5cf6'; miniCtx.lineWidth=2; miniCtx.beginPath(); miniCtx.arc(Math.max(5,Math.min(size-5,px)),Math.max(5,Math.min(size-5,py)),5,0,6.28); miniCtx.fill(); miniCtx.stroke();
 let camX=(cam.x/mapSize+0.5)*size; let camY=(cam.y/mapSize+0.5)*size;
 miniCtx.strokeStyle='rgba(139,92,246,0.35)'; miniCtx.lineWidth=1; miniCtx.strokeRect(camX-18,camY-14,36,28);
}

// Planet texture cache: one canvas per type+size (fix: no canvas allocation every frame)
const texCache=new Map();
const MAX_CACHE_SIZE=150; // BUG FIX: Limit cache size to prevent memory leak
function getPlanetTex(type,r){
  const key=type+'_'+r;
  let tex=texCache.get(key);
  if(!tex){
    tex=document.createElement('canvas'); tex.width=r*2+2; tex.height=r*2+2;
    let oc=tex.getContext('2d'); oc.translate(r+1,r+1);
    planetTexture(type,r,oc);
    texCache.set(key,tex);
    // BUG FIX: Clear oldest entries when cache grows too large
    if(texCache.size>MAX_CACHE_SIZE){
      const firstKey=texCache.keys().next().value;
      texCache.delete(firstKey);
    }
  }
  return tex;
}
function planetTexture(type,size,c){
 let g=c.createRadialGradient(-size*0.22,-size*0.22,size*0.2,0,0,size);
 if(type==='person'){ g.addColorStop(0,'#a7f3d0'); g.addColorStop(0.3,'#34d399'); g.addColorStop(1,'#065f46'); }
 else if(type==='car'){ g.addColorStop(0,'#e2e8f0'); g.addColorStop(0.28,'#f59e0b'); g.addColorStop(1,'#92400e'); }
 else if(type==='tree'){ g.addColorStop(0,'#bbf7d0'); g.addColorStop(0.4,'#22c55e'); g.addColorStop(1,'#14532d'); }
 else if(type==='building'){ g.addColorStop(0,'#93c5fd'); g.addColorStop(0.25,'#3b82f6'); g.addColorStop(0.6,'#1e40af'); g.addColorStop(1,'#1e1b4b'); }
 else if(type==='bench'){ g.addColorStop(0,'#fde68a'); g.addColorStop(1,'#92400e'); }
 else{ g.addColorStop(0,'#ffffff'); g.addColorStop(0.2,'#eab308'); g.addColorStop(1,'#a16207'); }
 c.fillStyle=g; c.beginPath(); c.arc(0,0,size,0,Math.PI*2); c.fill();
 c.fillStyle='rgba(0,0,0,0.18)'; for(let i=0;i<3;i++){ c.beginPath(); c.arc((Math.random()-0.5)*size*0.6,(Math.random()-0.5)*size*0.6,size*0.12*Math.random()+2,0,Math.PI*2); c.fill(); }
 c.fillStyle='rgba(255,255,255,0.28)'; c.beginPath(); c.arc(-size*0.32,-size*0.32,size*0.22,0,Math.PI*2); c.fill();
 if(type==='building'&&Math.random()>0.55){ c.strokeStyle='rgba(255,255,255,0.35)'; c.lineWidth=1.5; c.beginPath(); c.ellipse(0,0,size*1.38,size*0.42,0.5,0,Math.PI*2); c.stroke(); }
}

function draw(dt){
 ctx.save();
 let shakeX=0,shakeY=0; if(game.shake>0){ shakeX=(Math.random()-0.5)*game.shake; shakeY=(Math.random()-0.5)*game.shake; }
 ctx.scale(DPR,DPR);
 const cw=innerWidth,ch=innerHeight;
 ctx.translate(shakeX,shakeY);
 let bg=ctx.createLinearGradient(0,0,0,ch); bg.addColorStop(0,'#0f172a'); bg.addColorStop(1,'#1e1b4b'); ctx.fillStyle=bg; ctx.fillRect(-shakeX,-shakeY,cw+20,ch+20);
 ctx.save();
 ctx.translate(cw/2,ch/2);
 ctx.scale(game.zoom,game.zoom);
 ctx.translate(-cw/2,-ch/2);
 // translate world by cam with zoom
 let camOffX = (cam.x)*game.zoom;
 let camOffY = (cam.y)*game.zoom;
 // grid
 ctx.strokeStyle='rgba(255,255,255,0.05)'; ctx.lineWidth=1/game.zoom;
 for(let i=-3000;i<3000;i+=120){
   let sx=(i-cam.x)*game.zoom+cw/2;
   if(sx>-200&&sx<cw+200){ ctx.beginPath(); ctx.moveTo(sx,( -3000-cam.y)*game.zoom+ch/2); ctx.lineTo(sx,(3000-cam.y)*game.zoom+ch/2); ctx.stroke(); }
 }
 for(let j=-3000;j<3000;j+=120){
   let sy=(j-cam.y)*game.zoom+ch/2;
   if(sy>-200&&sy<ch+200){ ctx.beginPath(); ctx.moveTo((-3000-cam.x)*game.zoom+cw/2,sy); ctx.lineTo((3000-cam.x)*game.zoom+cw/2,sy); ctx.stroke(); }
 }
 // objects
 for(let o of game.objs){
   if(!o.alive) continue;
   let sx=(o.x-cam.x)*game.zoom+cw/2;
   let sy=(o.y-cam.y)*game.zoom+ch/2;
   if(sx<-150||sx>cw+150||sy<-150||sy>ch+150) continue;
   let rad=o.r*o.scale*game.zoom;
   if(rad<0.5) continue;
   ctx.fillStyle='rgba(0,0,0,0.32)'; ctx.beginPath(); ctx.ellipse(sx+4*game.zoom,sy+4*game.zoom,rad,rad*0.5,0,0,Math.PI*2); ctx.fill();
   let tex=getPlanetTex(o.type,Math.round(o.r));
   ctx.save(); ctx.translate(sx,sy); ctx.rotate(o.rot+o.wobble*0.015); ctx.scale(o.scale*game.zoom,o.scale*game.zoom);
   ctx.beginPath(); ctx.arc(0,0,o.r,0,Math.PI*2); ctx.clip();
   ctx.drawImage(tex,-o.r-1,-o.r-1,o.r*2+2,o.r*2+2);
   ctx.restore();
   if(o.baseR<=game.hole.r*1.12){
     ctx.strokeStyle='rgba(34,211,238,0.45)'; ctx.lineWidth=2*game.zoom; ctx.beginPath(); ctx.arc(sx,sy,rad+4*game.zoom,0,Math.PI*2); ctx.stroke();
   }
 }
 for(let ai of game.ai){
   if(!ai.alive) continue;
   let sx=(ai.x-cam.x)*game.zoom+cw/2; let sy=(ai.y-cam.y)*game.zoom+ch/2;
   drawHole(sx,sy,ai.r*ai.scale*game.zoom,skinData('classic'),false,ai.color);
 }
 if(game.boss&&game.boss.alive){
   let sx=(game.boss.x-cam.x)*game.zoom+cw/2; let sy=(game.boss.y-cam.y)*game.zoom+ch/2;
   drawBoss(sx,sy,game.boss.r*game.boss.scale*game.zoom);
 }
 let hsx=(game.hole.x-cam.x)*game.zoom+cw/2; let hsy=(game.hole.y-cam.y)*game.zoom+ch/2;
 drawHole(hsx,hsy,game.hole.r*(1+game.hole.pulse*0.15)*game.zoom,skinData(game.selectedSkin),true,null);

 for(let r of game.rings){
   let sx=(r.x-cam.x)*game.zoom+cw/2; let sy=(r.y-cam.y)*game.zoom+ch/2;
   ctx.globalAlpha=r.life*0.5; ctx.strokeStyle=r.color; ctx.lineWidth=3*game.zoom; ctx.beginPath(); ctx.arc(sx,sy,r.r*game.zoom,0,Math.PI*2); ctx.stroke(); ctx.globalAlpha=1;
 }
 for(let c of game.coins){
   let sx=(c.x-cam.x)*game.zoom+cw/2; let sy=(c.y-cam.y)*game.zoom+ch/2;
   ctx.fillStyle='#facc15'; ctx.beginPath(); ctx.arc(sx,sy,6*game.zoom,0,Math.PI*2); ctx.fill();
   ctx.fillStyle='#fef08a'; ctx.beginPath(); ctx.arc(sx-1*game.zoom,sy-1*game.zoom,2.5*game.zoom,0,Math.PI*2); ctx.fill();
 }
 for(let p of game.particles){
   let sx=(p.x-cam.x)*game.zoom+cw/2; let sy=(p.y-cam.y)*game.zoom+ch/2;
   ctx.globalAlpha=p.life; ctx.fillStyle=p.color; ctx.beginPath(); ctx.arc(sx,sy,p.size*p.life*game.zoom,0,Math.PI*2); ctx.fill(); ctx.globalAlpha=1;
 }
 ctx.textAlign='center';
 for(let f of game.floatTexts){
   let sx=(f.x-cam.x)*game.zoom+cw/2; let sy=(f.y-cam.y)*game.zoom+ch/2;
   ctx.globalAlpha=f.life; ctx.save(); ctx.translate(sx,sy); ctx.scale(f.scale*game.zoom,f.scale*game.zoom);
   ctx.fillStyle=f.color.trim();
   if(f.small){ ctx.font=`9px Fredoka`; ctx.globalAlpha=f.life*0.6; } else { ctx.font=`700 18px Fredoka`; }
   ctx.fillText(f.txt,0,0); ctx.restore(); ctx.globalAlpha=1;
 }
 ctx.restore();
 if(game.beingEaten>0){ ctx.fillStyle=`rgba(239,68,68,${game.beingEaten*0.28})`; ctx.fillRect(0,0,cw,ch); ctx.fillStyle='#fff'; ctx.font='800 20px Orbitron'; ctx.textAlign='center'; ctx.fillText('WARNING! BIGGER HOLE NEARBY!', cw/2, 88); }
 ctx.restore();
}
function drawHole(sx,sy,r,skin,isPlayer,overrideColor){
 if(r<1) return;
 let grd=ctx.createRadialGradient(sx,sy,r*0.7,sx,sy,r*1.6);
 if(skin.rainbow){ let hue=(Date.now()/18)%360; grd.addColorStop(0,`hsl(${hue},100%,65%)`); grd.addColorStop(1,'rgba(0,0,0,0)'); }
 else { grd.addColorStop(0,skin.rim[1]); grd.addColorStop(0.5,skin.rim[2]); grd.addColorStop(1,'rgba(0,0,0,0)'); }
 ctx.fillStyle=grd; ctx.beginPath(); ctx.arc(sx,sy,r*1.55,0,Math.PI*2); ctx.fill();
 ctx.fillStyle=skin.inner; ctx.beginPath(); ctx.arc(sx,sy,r,0,Math.PI*2); ctx.fill();
 ctx.save(); ctx.beginPath(); ctx.arc(sx,sy,r,0,Math.PI*2); ctx.clip();
 for(let i=0;i<28;i++){ let ang=(i/28)*Math.PI*2+Date.now()*0.001*(isPlayer?1:0.25); let rr=r*0.65*(0.25+Math.random()*0.75); ctx.fillStyle=`rgba(255,255,255,${0.07+Math.random()*0.13})`; ctx.beginPath(); ctx.arc(sx+Math.cos(ang)*rr,sy+Math.sin(ang)*rr,1.6,0,Math.PI*2); ctx.fill(); }
 ctx.strokeStyle=skin.rim[2]; ctx.lineWidth=2; ctx.globalAlpha=0.55; ctx.beginPath(); ctx.ellipse(sx,sy,r*0.82,r*0.34,Math.PI/8,0,Math.PI*2); ctx.stroke(); ctx.globalAlpha=1; ctx.restore();
 ctx.strokeStyle=overrideColor||skin.rim[2]; ctx.lineWidth=isPlayer?4:3; ctx.beginPath(); ctx.arc(sx,sy,r,0,Math.PI*2); ctx.stroke();
}
function drawBoss(sx,sy,r){
 let grd=ctx.createRadialGradient(sx,sy,r*0.5,sx,sy,r*1.8);
 grd.addColorStop(0,'#7f1d1d'); grd.addColorStop(0.4,'#ef4444'); grd.addColorStop(1,'rgba(0,0,0,0)');
 ctx.fillStyle=grd; ctx.beginPath(); ctx.arc(sx,sy,r*1.8,0,Math.PI*2); ctx.fill();
 ctx.fillStyle='#1f0a0a'; ctx.beginPath(); ctx.arc(sx,sy,r,0,Math.PI*2); ctx.fill();
 ctx.save(); ctx.beginPath(); ctx.arc(sx,sy,r,0,Math.PI*2); ctx.clip();
 ctx.fillStyle='rgba(239,68,68,0.3)'; for(let i=0;i<40;i++){ let ang=(i/40)*Math.PI*2+Date.now()*0.0008; let rr=r*0.7*Math.random(); ctx.beginPath(); ctx.arc(sx+Math.cos(ang)*rr,sy+Math.sin(ang)*rr,2,0,Math.PI*2); ctx.fill(); }
 ctx.restore();
 ctx.strokeStyle='#ef4444'; ctx.lineWidth=5; ctx.shadowColor='#ef4444'; ctx.shadowBlur=20; ctx.beginPath(); ctx.arc(sx,sy,r,0,Math.PI*2); ctx.stroke(); ctx.shadowBlur=0;
 ctx.fillStyle='#fff'; ctx.font='800 14px Orbitron'; ctx.textAlign='center'; ctx.fillText('BOSS',sx,sy+5);
}
function refreshMenuUI(){
 try{
  let mc=document.getElementById('menuCoins'); if(mc) mc.textContent=storage.coins.toLocaleString('en-US');
  let bs=document.getElementById('bestScore'); if(bs) bs.textContent=storage.best.toLocaleString('en-US');
  let ml=document.getElementById('menuLevel'); if(ml) ml.textContent=storage.level.toLocaleString('en-US');
  let gl=document.getElementById('globalLB'); if(gl) gl.innerHTML=renderGlobalLB(false);
  let ms=document.getElementById('menuSkin'); if(ms) ms.textContent=skinData(storage.skin).name;
  renderMissions(); updateDailyBtn(); updateSoundBtn();
  let ac=document.getElementById('achvCount'); if(ac) ac.textContent=(saveState.achv?saveState.achv.length:0)+'/'+ACHV.length;
  let ds=document.getElementById('dailyStreak'); if(ds) ds.textContent=String((saveState.daily?+saveState.daily.streak||0:0));
  let mv=document.getElementById('metaLevel'); if(mv) mv.textContent=storage.level;
 }catch(e){}
}
function showMenu(){
 game.running=false; lastTime=0; spawnTimer=0;
 if(rafId){ try{ cancelAnimationFrame(rafId); }catch(e){} rafId=null; }
 game.beingEaten=0; game.shake=0;
 let bossHp=document.getElementById('bossHp'); if(bossHp) bossHp.style.width='100%';
 let bossPct=document.getElementById('bossPct'); if(bossPct) bossPct.textContent='100%';
 ['bossBar','exitBtn','endOverlay','shopOverlay'].forEach(id=>{ let el=document.getElementById(id); if(el) el.style.display='none'; });
 let startOver=document.getElementById('startOverlay');
 if(startOver){ startOver.style.display='flex'; startOver.scrollTop=0; }
 refreshMenuUI();
 applyLOC();
 sendGameReadyOnce();
}
function exitToMenu(){
 if(rafId){ try{ cancelAnimationFrame(rafId); }catch(e){} rafId=null; }
 game.running=false;
 lastTime=0;
 spawnTimer=0;
 game.objs=[];
 game.particles=[];
 game.coins=[];
 game.floatTexts=[];
 game.rings=[];
 game.ai=[];
 game.boss=null;
 game.hole.r=28;
 game.hole.targetR=28;
 game.zoom=1.0;
 game.targetZoom=1.0;
 try{
  // BUG FIX: only bank rewards if this run never reached endGame (early quit); otherwise they were already added
  if(!game.coinsBanked){
   storage.coins=storage.coins+(game.coinsEarned||0);
   if(game.score>storage.best) storage.best=game.score;
   game.coinsBanked=true;
  }
 }catch(e){}
 platformMsg('level_paused');
 showMenu();
}

function endGame(title){
 if(!game.running) return;
 game.running=false;
 sfx(title&&title.indexOf('EATEN')>-1?'fail':'unlock');
 platformMsg(title&&title.indexOf('DEFEATED')>-1?'level_completed':(title&&title.indexOf('EATEN')>-1||title&&title.indexOf('ESCAPED')>-1?'level_failed':'level_completed'),{world:game.isBoss?'boss_hunt':'planet_city',level:String(game.level||1)});
 if(game.score>storage.best) storage.best=game.score;
 storage.coins=storage.coins+game.coinsEarned;
 game.coinsBanked=true; // BUG FIX: mark coins as banked so exitToMenu can't double-add them
 let lb=storage.lb;
 lb.push({score:game.score,date:new Date().toLocaleDateString('en-US'),coins:game.coinsEarned,ai:game.aiEaten,boss:game.boss&&!game.boss.alive?1:0});
 lb.sort((a,b)=>b.score-a.score);
 storage.lb=lb;
 // retention: missions + lifetime stats + achievements
 trackMission('score',game.score); trackMission('coins',game.coinsEarned);
 storage.gamesPlayed=storage.gamesPlayed+1;
 checkAchievements();
 document.getElementById('endTitle').textContent=title||"TIME'S UP!";
 document.getElementById('endScore').textContent=game.score.toLocaleString('en-US');
 document.getElementById('endCount').textContent=game.eaten.toLocaleString('en-US');
 document.getElementById('endCoins').textContent=game.coinsEarned.toLocaleString('en-US');
 document.getElementById('endAI').textContent=game.aiEaten.toLocaleString('en-US');
 document.getElementById('endBossText').textContent=game.isBoss&&game.boss&&!game.boss.alive?' • BOSS DEFEATED!':'';
 let bossBtn2=document.getElementById('bossBtn2'); if(bossBtn2) bossBtn2.style.display=game.isBoss?'none':'block';
 try{ storage.level=Math.max(storage.level,game.level||1); }catch(e){}
 document.getElementById('endLb').innerHTML=renderGlobalLB(true);
 document.getElementById('endOverlay').style.display='flex';
 document.getElementById('exitBtn').style.display='none';
 document.getElementById('bestScore').textContent=storage.best.toLocaleString('en-US');
 // rewarded double-coins offer (hidden when the platform has no rewarded support)
 let bd=document.getElementById('btnDouble');
 if(bd){ bd.style.display=(adAvailable('rewarded')&&!adDoubleUsed)?'inline-block':'none'; }
 adDoubleUsed=false;
 // Required step 7: interstitial at the natural pause (Bridge decides if/when it actually shows)
 showInterstitial('game_over');
 if(rafId){ cancelAnimationFrame(rafId); rafId=null; }
 lastTime=0;
}
function renderGlobalLB(isEnd){
 let lb=storage.lb.slice(0,5);
 if(lb.length===0) return isEnd?'<div style="color:#64748b;font-size:11px;text-align:center">No scores yet - be first!</div>':'<div style="color:#64748b;font-size:10px;text-align:center">No high scores yet</div>';
 let title=isEnd?'🏆 YOUR BEST SCORES':'🌍 LEADERBOARD (LOCAL)';
 let html=`<h4>${title}</h4>`;
 lb.forEach((e,i)=>{
   // BUG FIX: coerce legacy saves safely (score/coins may come back malformed)
   const sc=(+e.score||0).toLocaleString('en-US'); let rank=['🥇','🥈','🥉','4.','5.'][i];
   html+=`<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:12px;border-bottom:1px solid rgba(255,255,255,0.05)"><span>${rank} ${sc} pts • ${+e.coins||0} coins</span><span style="color:#64748b;font-size:10px">${e.date||''}</span></div>`;
 });
 return html;
}


// ================= v2.2 ENGAGEMENT: i18n, daily gift, missions, achievements, revive, rewarded =================
let adDoubleUsed=false;

// ---- tiny i18n for the key buttons (BOOT.language set from Playgama platform) ----
const LOC={
 en:{play:'▶ PLAY',shop:'🛒 SHOP',boss:'👹 BOSS',daily:'🎒 DAILY GIFT',sound:'🔊 SOUND',mute:'🔇 MUTED',gift:'🎁 WATCH • +150 🪙',double:'🎁 WATCH AD • 2x COINS',revive:'🎮 CONTINUE • WATCH'},
 ru:{play:'▶ ИГРАТЬ',shop:'🛒 МАГАЗИН',boss:'👹 БОСС',daily:'🎒 ПОДАРОК',sound:'🔊 ЗВУК',mute:'🔇 БЕЗ ЗВУКА',gift:'🎁 СМОТРЕТЬ • +150 🪙',double:'🎁 РЕКЛАМА • 2x МОНЕТ',revive:'🎮 ПРОДОЛЖИТЬ • РЕКЛАМА'},
 es:{play:'▶ JUGAR',shop:'🛒 TIENDA',boss:'👹 JEFE',daily:'🎒 REGALO',sound:'🔊 SONIDO',mute:'🔇 SILENCIO',gift:'🎁 VER • +150 🪙',double:'🎁 VER ANUNCIO • 2x 🪙',revive:'🎮 CONTINUAR • VER'},
 pt:{play:'▶ JOGAR',shop:'🛒 LOJA',boss:'👹 CHEFE',daily:'🎒 PRESENTE',sound:'🔊 SOM',mute:'🔇 MUDO',gift:'🎁 ASSISTIR • +150 🪙',double:'🎁 VER ANÚNCIO • 2x 🪙',revive:'🎮 CONTINUAR • ASSISTIR'},
 tr:{play:'▶ OYNA',shop:'🛒 MAĞAZA',boss:'👹 PATRON',daily:'🎒 GÜNLÜK HEDİYE',sound:'🔊 SES',mute:'🔇 SESSİZ',gift:'🎁 İZLE • +150 🪙',double:'🎁 REKLAM İZLE • 2x 🪙',revive:'🎮 DEVAM ET • İZLE'}
};
let uiLang='en';
function T(key){ const pack=LOC[uiLang]||LOC.en; return pack[key]||LOC.en[key]||key; }
function applyLOC(){
 [['btnPlay','play'],['btnShop','shop'],['btnBoss','boss'],['btnGift','gift'],['btnDouble','double'],['btnRevive','revive']].forEach(pair=>{
  const el=document.getElementById(pair[0]); if(el) el.textContent=T(pair[1]);
 });
 updateSoundBtn(); updateDailyBtn();
}

// ---- daily gift / streak ----
const DAILY_REWARDS=[50,100,150,200,300,500];
// BUG FIX: use the same local-calendar date everywhere (old mix of UTC + timezone-shifted UTC broke streaks)
function dayString(){ try{ const d=new Date(); const p=n=>String(n).padStart(2,'0'); return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate()); }catch(e){ return ''; } }
function isYesterday(str){
 try{ if(!str) return false; const y=new Date(); y.setDate(y.getDate()-1); const p=n=>String(n).padStart(2,'0'); return String(str)===(y.getFullYear()+'-'+p(y.getMonth()+1)+'-'+p(y.getDate())); }catch(e){ return false; }
}
function updateDailyBtn(){
 const el=document.getElementById('btnDaily'); if(!el) return;
 const d=saveState.daily||null;
 const claimed=!!(d&&d.last===dayString());
 el.textContent=claimed?('✅ DAY '+Math.max(1,+d.streak||1)+' CLAIMED'):T('daily');
 el.disabled=claimed; el.style.opacity=claimed?'.55':'1';
}
function claimDaily(){
 const d=saveState.daily||null;
 if(d&&d.last===dayString()){ toast('✔ Today\'s gift already claimed','Come back tomorrow!'); return; }
 const streak=(d&&isYesterday(d.last))?(+d.streak||0)+1:1;
 const amount=DAILY_REWARDS[Math.min(streak,DAILY_REWARDS.length)-1];
 storage.daily={last:dayString(),streak:streak};
 storage.coins=storage.coins+amount;
 sfx('unlock');
 toast('🎒 +'+amount+' 🪙 DAILY GIFT!','Streak day '+Math.min(streak,DAILY_REWARDS.length)+' • next reward '+DAILY_REWARDS[Math.min(streak+1,DAILY_REWARDS.length)-1]+' 🪙');
 checkAchievements();
 refreshMenuUI();
}

// ---- daily missions (seeded by date, deterministic for everyone) ----
const MISSION_DEFS={
 m_eat:{icon:'🪐',name:'EAT 60 OBJECTS',stat:'eaten',goal:60,reward:100},
 m_score:{icon:'⭐',name:'SCORE 2,500 IN ONE RUN',stat:'score',goal:2500,reward:120},
 m_coins:{icon:'🪙',name:'BANK 120 COINS',stat:'coins',goal:120,reward:100},
 m_level:{icon:'🚀',name:'REACH LEVEL 4',stat:'level',goal:4,reward:150},
 m_ai:{icon:'⚔️',name:'EAT 4 RIVAL HOLES',stat:'aiEaten',goal:4,reward:150},
 m_boss:{icon:'👹',name:'DEFEAT 1 BOSS',stat:'boss',goal:1,reward:300}
};
function dateSeed(){ const s=dayString(); let h=7; for(let i=0;i<s.length;i++) h=(h*31+s.charCodeAt(i))>>>0; return h; }
function ensureMissions(){
 let ms=saveState.missions;
 if(ms&&ms.date===dayString()&&Array.isArray(ms.list)&&ms.list.length===3&&ms.list.every(m=>missionDef(m.id))) return;
 const pool=['m_eat','m_score','m_coins','m_level','m_ai','m_boss'];
 let seed=dateSeed(); const used={}; const picked=[];
 while(picked.length<3){
  seed=(seed*1103515245+12345)>>>0;
  const idx=seed%pool.length;
  if(!used[idx]){ used[idx]=true; picked.push({id:pool[idx],prog:0,claimed:false}); }
 }
 saveState.missions={date:dayString(),list:picked};
 persist();
}
function missionDef(id){ return MISSION_DEFS[id]||null; }
function trackMission(stat,val){
 try{
  ensureMissions();
  let changed=false;
  saveState.missions.list.forEach(m=>{
   const def=missionDef(m.id); if(!def||def.stat!==stat||m.claimed||(+m.prog||0)>=def.goal) return;
   // BUG FIX: 'coins' should accumulate across runs (banking is cumulative); level/score use best-so-far
   if(stat==='level'||stat==='score') m.prog=Math.max(+m.prog||0,+val||0);
   else m.prog=(+m.prog||0)+(+val||0);
   if(m.prog>=def.goal){ m.prog=def.goal; toast('🎯 MISSION READY!','Claim your '+def.reward+' 🪙 in the menu'); sfx('unlock'); }
   changed=true;
  });
  if(changed){ persist(); renderMissions(); }
 }catch(e){}
}
function claimMission(id){
 try{
  ensureMissions();
  const m=saveState.missions.list.find(x=>x.id===id); const def=missionDef(id);
  if(!m||!def||m.claimed||(+m.prog||0)<def.goal) return;
  m.claimed=true; storage.coins=storage.coins+def.reward;
  sfx('coin'); toast('✅ +'+def.reward+' 🪙 MISSION REWARD','New missions tomorrow!');
  persist(); renderMissions(); refreshMenuUI();
 }catch(e){}
}
function renderMissions(){
 const box=document.getElementById('missionsBox'); if(!box) return;
 ensureMissions();
 let html='<div style="font-weight:700;font-size:10px;letter-spacing:2px;color:#a78bfa;margin:2px 0 6px">🎯 DAILY MISSIONS</div>';
 saveState.missions.list.forEach(m=>{
  const def=missionDef(m.id); if(!def) return;
  const pct=Math.max(0,Math.min(100,Math.round((+m.prog||0)/def.goal*100)));
  const done=(+m.prog||0)>=def.goal;
  html+='<div class="mission'+(done?' done':'')+'">'
   +'<div class="mi">'+def.icon+'</div>'
   +'<div class="mt"><b>'+def.name+'</b><div class="mp"><div class="mpf" style="width:'+pct+'%"></div></div></div>'
   +(done?(m.claimed?'<div class="mr" style="color:#22c55e">✅ CLAIMED</div>':'<button class="mr" style="background:none;border:1px solid #facc15;color:#facc15;border-radius:99px;padding:3px 10px;cursor:pointer;font-weight:700;font-size:10px" onclick="claimMission(\''+m.id+'\')">CLAIM '+def.reward+' 🪙</button>'):'<div class="mr">'+def.reward+' 🪙</div>')
   +'</div>';
 });
 box.innerHTML=html;
}

// ---- achievements ----
const ACHV=[
 {id:'first',icon:'🥇',name:'FIRST ORBIT'},
 {id:'feed50',icon:'🪐',name:'PLANET EATER'},
 {id:'snova',icon:'⭐',name:'SUPERNOVA'},
 {id:'hunter',icon:'⚔️',name:'RIVAL HUNTER'},
 {id:'slayer',icon:'👹',name:'BOSS SLAYER'},
 {id:'rich',icon:'💎',name:'FILTHY RICH'}
];
function unlockAchv(id){
 try{
  const have=saveState.achv||[];
  if(have.includes(id)) return;
  have.push(id); saveState.achv=have; persist();
  const a=ACHV.find(x=>x.id===id);
  toast('🏆 UNLOCKED: '+(a?a.name:'ACHIEVEMENT'),a?a.icon+' in the menu trophies chip':'');
  sfx('unlock');
 }catch(e){}
}
function checkAchievements(){
 try{
  if((+saveState.gamesPlayed||0)>=1) unlockAchv('first');
  if(game&&game.eaten>=50) unlockAchv('feed50');
  if(game&&game.score>=5000) unlockAchv('snova');
  if((+saveState.aiKills||0)>=10) unlockAchv('hunter');
  if(game&&game.boss&&!game.boss.alive) unlockAchv('slayer');
  if((+saveState.coins||0)>=2000) unlockAchv('rich');
 }catch(e){}
}

// ---- revive: one continue per run via rewarded ad ----
function offerRevive(title){
 if(BOOT.forcedPause) return;
 game.reviveTitle=title||'EATEN!';
 sfx('fail'); // BUG FIX: play the sound before freezing (mutedNow() blocks sound while forcedPause)
 BOOT.forcedPause=true; // freeze world while the offer is up
 let rs=document.getElementById('reviveScore'); if(rs) rs.textContent=(game.score||0).toLocaleString('en-US');
 let br=document.getElementById('btnRevive'); if(br) br.textContent=T('revive');
 let rv=document.getElementById('reviveOverlay'); if(rv) rv.style.display='flex';
}
function reviveNow(){
 try{
  game.hasRevived=true;
  game.time=Math.min(game.maxTime+30,game.time+10);
  let bestX=0,bestY=0,bestScore=-1;
  for(let i=0;i<60;i++){
   const x=(Math.random()-0.5)*1800,y=(Math.random()-0.5)*1800;
   let danger=Infinity;
   game.ai.forEach(a=>{ if(a.alive) danger=Math.min(danger,Math.hypot(a.x-x,a.y-y)-a.r); });
   if(game.boss&&game.boss.alive) danger=Math.min(danger,Math.hypot(game.boss.x-x,game.boss.y-y)-game.boss.r);
   (game.objs||[]).forEach(o=>{ if(o.alive&&o.baseR>game.hole.r*0.9) danger=Math.min(danger,Math.hypot(o.x-x,o.y-y)-o.baseR); });
   if(danger>bestScore){ bestScore=danger; bestX=x; bestY=y; }
  }
  game.hole.x=bestX; game.hole.y=bestY; game.hole.vx=0; game.hole.vy=0;
  cam.x=bestX; cam.y=bestY;
  game.beingEaten=0; game.shake=8;
  game.rings.push({x:bestX,y:bestY,r:10,life:1,maxR:220,color:'#22c55e'});
  spawnFloat(bestX,bestY-40,'REVIVED! +10s','#22c55e');
 }catch(e){}
 BOOT.forcedPause=false;
 const rv=document.getElementById('reviveOverlay'); if(rv) rv.style.display='none';
 sfx('levelup'); toast('✨ REVIVED!','+10 seconds • your run continues');
}
function watchRevive(){
 if(BOOT.reviveWaiting) return;
 BOOT.reviveWaiting=true;
 showRewarded('revive',ok=>{
  BOOT.reviveWaiting=false;
  if(ok) reviveNow();
  else{ toast('❌ Revive unavailable','Ad not finished'); declineRevive(); }
 });
}
function declineRevive(){
 const rv=document.getElementById('reviveOverlay'); if(rv) rv.style.display='none';
 BOOT.forcedPause=false;
 endGame(game.reviveTitle);
}

// ---- rewarded: menu gift (+150) & 2x coins on the end screen ----
function watchGift(){
 if(BOOT.giftBusy) return;
 BOOT.giftBusy=true;
 showRewarded('gift',ok=>{
  BOOT.giftBusy=false;
  if(ok){ storage.coins=storage.coins+150; sfx('coin'); toast('🎁 +150 COINS!','Thanks for watching'); checkAchievements(); refreshMenuUI(); }
  else toast('❌ No reward','Ad not finished');
 });
}
function watchDouble(){
 if(adDoubleUsed||BOOT.giftBusy) return;
 BOOT.giftBusy=true;
 showRewarded('double_coins',ok=>{
  BOOT.giftBusy=false;
  adDoubleUsed=true;
  const bd=document.getElementById('btnDouble'); if(bd) bd.style.display='none';
  if(ok){
   const bonus=+game.coinsEarned||0;
   storage.coins=storage.coins+bonus;
   const ec=document.getElementById('endCoins'); if(ec) ec.textContent=((+game.coinsEarned||0)*2).toLocaleString('en-US');
   sfx('coin'); toast('💰 2x COINS!','+'+bonus.toLocaleString('en-US')+' bonus');
  } else toast('❌ No bonus','Ad not finished');
 });
}

// ---- sound toggle ----
function toggleSound(){ storage.sound=!storage.sound; sfx('click'); updateSoundBtn(); toast(storage.sound?'🔊 SOUND ON':'🔇 SOUND OFF'); }
function updateSoundBtn(){ const el=document.getElementById('btnSound'); if(el) el.textContent=storage.sound?T('sound'):T('mute'); }

// ---- bridge boot (required step 3: initialize before restoring state) ----
function initBridge(){
 return new Promise(res=>{
  const finish=()=>res();
  if(typeof bridge==='undefined'||!bridge||!bridge.initialize){ finish(); return; }
  let settled=false;
  const wrap=()=>{ if(settled) return; settled=true; BOOT.bridgeReady=true; finish(); };
  try{ bridge.initialize().then(wrap).catch(wrap); }catch(e){ wrap(); }
  setTimeout(wrap,6000);
 });
}
function sendGameReadyOnce(){ if(BOOT.gameReadySent) return; BOOT.gameReadySent=true; platformMsg('game_ready'); }

// ---- boot sequence: bridge -> save -> eased loader -> menu ----
const TIPS=[
 '💡 TIP: SPACE = speed boost • Q = vacuum blast',
 '💡 TIP: Glowing rings show which planets you can eat',
 '💡 TIP: Run from bigger black holes - they eat you back!',
 '💡 TIP: Coins fly to you on their own - focus on hunting',
 '💡 TIP: Magnetic Pull in the shop extends your suck range',
 '💡 TIP: Claim your DAILY GIFT every day for bigger rewards',
 '💡 TIP: Defeat the BOSS to raise your menu level'
];
let tipIdx=0, tipTimer=null, revealDone=false;
function startTips(){
 if(tipTimer) clearInterval(tipTimer);
 tipIdx=0;
 const el=document.getElementById('loadTip'); if(el) el.textContent=TIPS[0];
 tipTimer=setInterval(()=>{
  tipIdx=(tipIdx+1)%TIPS.length;
  const el2=document.getElementById('loadTip'); if(el2) el2.textContent=TIPS[tipIdx];
 },1500);
}
function revealMenu(){
 if(revealDone) return;
 revealDone=true;
 if(tipTimer) clearInterval(tipTimer);
 const ls=document.getElementById('loadingScreen');
 try{
  if(ls){ ls.style.transition='opacity .6s'; ls.style.opacity='0'; }
  setTimeout(()=>{ if(ls) ls.style.display='none'; showMenu(); },620);
 }catch(e){ if(ls) ls.style.display='none'; showMenu(); }
}
let loadDone=false, loadElapsed=0, loadLastTs=null;
function loadFrame(ts){
 if(revealDone||loadDone) return;
 if(loadLastTs===null) loadLastTs=ts;
 loadElapsed+=Math.min((ts-loadLastTs)/1000,0.05); loadLastTs=ts;
 const t=Math.min(1,loadElapsed/3.0);
 const p=Math.floor((1-Math.pow(1-t,3))*100); // ease-out cubic
 const fill=document.getElementById('loadFill'); if(fill) fill.style.width=p+'%';
 const txt=document.getElementById('loadText'); if(txt) txt.textContent='LOADING '+p+'%';
 if(t>=1){
  loadDone=true;
  if(BOOT.storageLoaded) revealMenu();
  else setTimeout(revealMenu,2500); // never hang on the loader
 } else requestAnimationFrame(loadFrame);
}
async function bootSeq(){
 startTips();
 try{ await initBridge(); }catch(e){}
 try{ if(typeof bridge!=='undefined'&&bridge&&bridge.platform&&bridge.platform.language) { BOOT.language=String(bridge.platform.language); uiLang=LOC[BOOT.language.slice(0,2).toLowerCase()]?BOOT.language.slice(0,2).toLowerCase():'en'; } }catch(e){}
 wirePlatformEvents(); wireAdEvents();
 try{ await loadSave(); }catch(e){}
 BOOT.storageLoaded=true;
 ensureMissions();
 refreshMenuUI();
 // Fallback: never get stuck on the loading screen even if boot hangs
 setTimeout(()=>{ if(!BOOT.storageLoaded) BOOT.storageLoaded=true; revealMenu(); },8000);
}
requestAnimationFrame(loadFrame);
function openShop(){ 
  // Hide other overlays to prevent blocking
  let endOver=document.getElementById('endOverlay');
  if(endOver && endOver.style.display==='flex'){ endOver.dataset.wasOpen='true'; }
  // Show shop on top
  let shop=document.getElementById('shopOverlay');
  if(shop){ shop.style.display='flex'; shop.scrollTop=0; }
  document.body.style.overflow='hidden';
  let sc=document.getElementById('shopCoins'); if(sc) sc.textContent=storage.coins.toLocaleString('en-US');
  renderShop();
}
function closeShop(){ 
  let shop=document.getElementById('shopOverlay'); if(shop) shop.style.display='none';
  document.body.style.overflow='';
  // If shop was opened from end screen, show end screen again, else show main menu
  let endOver=document.getElementById('endOverlay');
  let startOver=document.getElementById('startOverlay');
  if(endOver && endOver.dataset.wasOpen==='true'){
    endOver.style.display='flex';
    delete endOver.dataset.wasOpen;
  } else if(startOver && !game.running){
    startOver.style.display='flex';
  }
 refreshMenuUI();}
let shopTab='ability';
function switchTab(t){
 shopTab=t;
 let ab=document.getElementById('tabAb'); let sk=document.getElementById('tabSkin');
 if(ab&&sk){ ab.classList.toggle('active',t==='ability'); sk.classList.toggle('active',t==='skin'); }
 renderShop();
}
function renderShop(){ try{
 const grid=document.getElementById('shopGrid'); if(!grid) return; grid.innerHTML='';
 if(shopTab==='ability'){
   ABILITIES.forEach(ab=>{
     let owned=storage.abs.includes(ab.id);
     let div=document.createElement('div'); div.className='item';
     div.innerHTML=`<div style="font-size:24px">${ab.icon}</div><div style="font-weight:700;margin-top:4px;font-size:13px">${ab.name}</div><div style="font-size:10px;color:#94a3b8">${ab.desc}</div><div class="price">${owned?'✅ Owned':'🪙 '+ab.price.toLocaleString('en-US')}</div>`;
     if(!owned){
       let btn=document.createElement('button'); btn.className='btn btn-primary'; btn.style.marginTop='8px'; btn.style.width='100%'; btn.style.padding='8px'; btn.textContent='BUY';
       btn.addEventListener('click',()=>{ if(storage.coins>=ab.price){ storage.coins=storage.coins-ab.price; let arr=storage.abs; arr.push(ab.id); storage.abs=arr; renderShop(); let sc=document.getElementById('shopCoins'); if(sc) sc.textContent=storage.coins.toLocaleString('en-US'); let mc=document.getElementById('menuCoins'); if(mc) mc.textContent=storage.coins.toLocaleString('en-US'); } else toast('❌ Not enough coins','Need 🪙 '+(ab.price-storage.coins).toLocaleString('en-US')+' more'); });
       div.appendChild(btn);
     }
     grid.appendChild(div);
   });
 } else {
   SKINS.forEach(sk=>{
     let owned=storage.skins.includes(sk.id); let selected=storage.skin===sk.id;
     let div=document.createElement('div'); div.className='item'; div.style.borderColor=selected?'#8b5cf6':'rgba(255,255,255,0.1)';
     div.innerHTML=`<div style="display:flex;gap:8px;align-items:center"><div class="dot" style="background:radial-gradient(circle at 30% 30%, ${sk.rim[2]}, ${sk.rim[0]})"></div><div><div style="font-weight:700;font-size:12px">${sk.name}</div><div style="font-size:10px;color:#94a3b8">${sk.price===0?'FREE':'🪙 '+sk.price.toLocaleString('en-US')}</div></div></div>`;
     let btn=document.createElement('button'); btn.className='btn '+(selected?'btn-primary':'btn-ghost'); btn.style.marginTop='10px'; btn.style.width='100%'; btn.style.padding='8px'; btn.style.fontSize='12px';
     if(!owned){
       btn.textContent='BUY';
       btn.addEventListener('click',()=>{ if(storage.coins>=sk.price){ storage.coins-=sk.price; let arr=storage.skins; arr.push(sk.id); storage.skins=arr; storage.skin=sk.id; renderShop(); let sc=document.getElementById('shopCoins'); if(sc) sc.textContent=storage.coins.toLocaleString('en-US'); let mc=document.getElementById('menuCoins'); if(mc) mc.textContent=storage.coins.toLocaleString('en-US'); let ms=document.getElementById('menuSkin'); if(ms) ms.textContent=sk.name; } else toast('❌ Not enough coins','Need 🪙 '+(sk.price-storage.coins).toLocaleString('en-US')+' more'); });
     } else {
       btn.textContent=selected?'SELECTED':'SELECT';
       btn.addEventListener('click',()=>{ storage.skin=sk.id; renderShop(); let ms=document.getElementById('menuSkin'); if(ms) ms.textContent=sk.name; });
     }
     div.appendChild(btn); grid.appendChild(div);
   });
 }
 }catch(e){ console.error('Shop render error:', e); }
}

// INPUT - FIXED: Prevent default only when needed, check existence
window.addEventListener('mousemove',(e)=>{game.mouse.x=e.clientX; game.mouse.y=e.clientY;});
window.addEventListener('touchmove',(e)=>{ if(game.running){ e.preventDefault(); game.mouse.x=e.touches[0].clientX; game.mouse.y=e.touches[0].clientY; }},{passive:false});
window.addEventListener('touchstart',(e)=>{ if(e.touches[0]){ game.mouse.x=e.touches[0].clientX; game.mouse.y=e.touches[0].clientY; }},{passive:false});
window.addEventListener('keydown',(e)=>{
 // BUG FIX: normalize to lowercase so W/A/S/D with Shift or CapsLock still move the hole
 const k=typeof e.key==='string'?e.key.toLowerCase():e.key; game.keys[k]=true;
 if(e.code==='Space'){ e.preventDefault(); activateSpeed(); }
 if(k==='q'){ if(game.running) triggerVacuum(); }
 if(e.key==='Escape'){ if(game.running) exitToMenu(); }
});
window.addEventListener('keyup',(e)=>{ const k=typeof e.key==='string'?e.key.toLowerCase():e.key; game.keys[k]=false;});
addEventListener('blur',()=>{ game.keys={}; });
document.addEventListener('visibilitychange',()=>{ if(document.hidden) game.keys={}; });

// INIT - boot sequence (bridge -> save -> loader -> menu)
bootSeq();

console.log('Black Orbit v2.2 Loaded - Playgama Bridge, missions, daily gift, achievements, revive, rewarded');
