"use strict";

/* ========== ANTI-DUPLICADO ========== */
if (window.__NEXUS_CHURCHS_LOADED__) {
  console.warn("Nexus Churchs ya estaba cargado. Abortando segunda ejecución.");
  throw new Error("Duplicated app.js execution");
}
window.__NEXUS_CHURCHS_LOADED__ = true;

/******** FIREBASE CONFIG (INTACTO) ********/
const firebaseConfig = {
  apiKey: "AIzaSyAkBdi6tYWetTiyKrt-jHYY9Va1Wikf29c",
  authDomain: "nexus-churchs.firebaseapp.com",
  projectId: "nexus-churchs",
  storageBucket: "nexus-churchs.firebasestorage.app",
  messagingSenderId: "594921350925",
  appId: "1:594921350925:web:266da215d57b94fb94b244"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
firebase.auth().signInAnonymously().catch(console.error);
const { jsPDF } = window.jspdf;

/******** URL church ********/
const params = new URLSearchParams(location.search);
let churchId = (params.get("church") || "demo").trim();

/******** Hash / Tabs helpers ********/
function normalizeTabKey(k){
  k = String(k || "").replace("#","").trim().toLowerCase();
  if(k === "registro") return "register";
  if(k === "wow") return "wow";
  if(k === "config" || k === "configuracion") return "config";
  if(k === "historial") return "history";
  if(["register","wow","config","history"].includes(k)) return k;
  return "register";
}
function tabKeyToHash(key){
  const map = {register:"registro", wow:"wow", config:"config", history:"historial"};
  return map[key] || "registro";
}

/******** Tabs ********/
const tabBtns = document.querySelectorAll(".tabBtn");
const tabPanels = document.querySelectorAll(".tab");
let lastTabKey = "register";

function openTab(key, {syncHash=true} = {}){
  key = normalizeTabKey(key || "register");
  lastTabKey = key;

  tabBtns.forEach(b=>{
    const on = b.dataset.tab === key;
    b.classList.toggle("active", on);
    b.setAttribute("aria-selected", on ? "true" : "false");
  });

  tabPanels.forEach(p=>{
    const on = p.dataset.tabpanel === key;
    p.classList.toggle("active", on);
  });

  if(syncHash){
    const h = tabKeyToHash(key);
    if(location.hash !== "#" + h){
      history.replaceState({}, "", location.pathname + location.search + "#" + h);
    }
  }
}
tabBtns.forEach(btn=> btn.addEventListener("click", ()=> openTab(btn.dataset.tab)));
window.addEventListener("hashchange", ()=> openTab(location.hash, {syncHash:false}));

/******** DOM ********/
const churchSelect = document.getElementById("churchSelect");
const kpiTotal = document.getElementById("kpiTotalжаў
const brandSub = document.getElementById("brandSub");

const formCheckin = document.getElementById("formCheckin");
const firstName = document.getElementById("firstName");
const lastName  = document.getElementById("lastName");
const town      = document.getElementById("town");
const partySize = document.getElementById("partySize");
const errCheckin = document.getElementById("errCheckin");
const checkinStatus = document.getElementById("checkinStatus");

const btnWowFullscreen = document.getElementById("btnWowFullscreen");
const welcomeBig = document.getElementById("welcomeBig");
const tickerTrack = document.getElementById("tickerTrack");

const wowSeconds = document.getElementById("wowSeconds");
const btnSaveWow = document.getElementById("btnSaveWow");
const wowSavedMsg = document.getElementById("wowSavedMsg");

const newChurchName = document.getElementById("newChurchName");
const btnCreateChurch = document.getElementById("btnCreateChurch");
const createChurchMsg = document.getElementById("createChurchMsg");

const sessionPill = document.getElementById("sessionPill");
const btnOpenSession = document.getElementById("btnOpenSession");
const btnCloseSession = document.getElementById("btnCloseSession");
const sessionTitle = document.getElementById("sessionTitle");
const sessionMeta = document.getElementById("sessionMeta");

const historyList = document.getElementById("historyList");
const wowAudio = document.getElementById("wowAudio");

/* PIN UI */
const btnLock = document.getElementById("btnLock");
const pinOverlay = document.getElementById("pinOverlay");
const pinInput = document.getElementById("pinInput");
const btnPinUnlock = document.getElementById("btnPinUnlock");
const pinError = document.getElementById("pinError");
const pinSub = document.getElementById("pinSub");

const pinCurrent = document.getElementById("pinCurrent");
const pinNew = document.getElementById("pinNew");
const btnSavePin = document.getElementById("btnSavePin");
const pinSavedMsg = document.getElementById("pinSavedMsg");

/******** State ********/
let activeEventId = null;
let WOW_MS = 6000;

let unsubChurch = null;
let unsubCheckins = null;
let unsubHistory = null;

let firstLoad = true;
let lastWelcomeId = null;
let welcomeTimer = null;

let churchName = "";

/******** PIN ********/
let churchPinHash = "";
const DEFAULT_PIN = "1234";
const UNLOCK_KEY = (id)=> `nc.unlocked.${id}.v1`;

/******** WOW fullscreen + audio fade ********/
let wasTabBeforeWow = "register";
let isWowFullscreen = false;
let fadeTimer = null;

const WOW_VOL_TARGET = 0.35;
const FADE_MS = 1000;

/******** INIT ********/
init().catch(console.error);

async function init(){
  // abrir tab inicial desde hash
  openTab(location.hash || "register", {syncHash:true});

  // wow fullscreen
  btnWowFullscreen?.addEventListener("click", ()=> toggleWowFullscreen());

  document.addEventListener("keydown", (e)=>{
    if(e.key === "Escape" && isWowFullscreen) toggleWowFullscreen(false);
  });

  await loadChurches();

  bindPinActions();
  bindActions();
  watchChurch();

  firstName?.focus();
}

/******** Audio fade ********/
function stopFade(){
  if(fadeTimer){ clearInterval(fadeTimer); fadeTimer = null; }
}
function fadeTo(target, ms){
  stopFade();
  if(!wowAudio) return;

  const startVol = Number(wowAudio.volume || 0);
  const endVol = clamp(Number(target), 0, 1);

  const steps = 20;
  const stepMs = Math.max(10, Math.floor(ms / steps));
  let i = 0;

  fadeTimer = setInterval(()=>{
    i++;
    const t = i / steps;
    wowAudio.volume = clamp(startVol + (endVol - startVol) * t, 0, 1);
    if(i >= steps){
      stopFade();
      wowAudio.volume = endVol;
    }
  }, stepMs);
}

/******** WOW fullscreen toggle ********/
function toggleWowFullscreen(force){
  const next = (typeof force === "boolean") ? force : !isWowFullscreen;

  if(next){
    wasTabBeforeWow = lastTabKey || "register";
    openTab("wow");

    document.body.classList.add("wow-fullscreen");
    isWowFullscreen = true;
    if(btnWowFullscreen) btnWowFullscreen.textContent = "✕";

    try{
      if(wowAudio){
        wowAudio.currentTime = 0;
        wowAudio.volume = 0.0;
        const p = wowAudio.play();
        if(p && typeof p.catch === "function") p.catch(()=>{});
        fadeTo(WOW_VOL_TARGET, FADE_MS);
      }
    }catch(e){ console.warn("Audio err:", e); }

  } else {
    document.body.classList.remove("wow-fullscreen");
    isWowFullscreen = false;
    if(btnWowFullscreen) btnWowFullscreen.textContent = "⛶";

    try{
      if(wowAudio){
        fadeTo(0.0, 300);
        setTimeout(()=>{
          try{ wowAudio.pause(); wowAudio.currentTime = 0; }catch(e){}
        }, 320);
      }
    }catch(e){}

    openTab(wasTabBeforeWow || "register");
  }
}

/******** Churches list ********/
async function loadChurches(){
  if(!churchSelect) return;

  churchSelect.innerHTML = "";
  const snap = await db.collection("churches").orderBy("name").get();

  if(snap.empty){
    addOpt("demo","demo");
    churchSelect.value = churchId;
  } else {
    let found=false;
    snap.forEach(doc=>{
      const d = doc.data() || {};
      addOpt(doc.id, d.name || doc.id);
      if(doc.id === churchId) found=true;
    });
    if(!found){
      churchId = churchSelect.options[0].value;
      replaceParam("church", churchId);
    }
    churchSelect.value = churchId;
  }

  churchSelect.addEventListener("change", ()=>{
    churchId = churchSelect.value;
    replaceParam("church", churchId);
    location.reload();
  });

  function addOpt(id, label){
    const o=document.createElement("option");
    o.value=id; o.textContent=label;
    churchSelect.appendChild(o);
  }
}

/******** Watch church doc ********/
function watchChurch(){
  if(unsubChurch) unsubChurch();

  unsubChurch = db.collection("churches").doc(churchId).onSnapshot(doc=>{
    const d = doc.data() || {};

    churchName = clean(d.name) || doc.id;
    if(brandSub) brandSub.textContent = churchName;

    churchPinHash = clean(d.pinHash) || "";
    if(pinSub) pinSub.textContent = `PIN requerido — ${churchName}`;

    activeEventId = d.activeEventId || null;

    const sec = clamp(parseInt(d.wowSeconds || 6, 10) || 6, 1, 30);
    WOW_MS = sec * 1000;
    if(wowSeconds) wowSeconds.value = String(sec);

    enforcePinForChurch();

    renderSession();
    mountCheckins();
    mountHistory();
  }, console.error);
}

/******** Actions ********/
function bindActions(){
  btnSaveWow?.addEventListener("click", async ()=>{
    const sec = clamp(parseInt(wowSeconds.value,10) || 6, 1, 30);
    await db.collection("churches").doc(churchId).set({ wowSeconds: sec }, { merge:true });
    if(wowSavedMsg) wowSavedMsg.textContent = `WOW guardado: ${sec}s`;
  });

  btnCreateChurch?.addEventListener("click", async ()=>{
    const name = clean(newChurchName.value);
    if(!name){
      if(createChurchMsg) createChurchMsg.textContent = "Escribe el nombre de la iglesia.";
      return;
    }

    btnCreateChurch.disabled = true;
    btnCreateChurch.textContent = "Creando…";
    try{
      let id = slugify(name) || ("iglesia_" + rand4());
      const exists = await db.collection("churches").doc(id).get();
      if(exists.exists) id = `${id}_${rand4()}`;

      await db.collection("churches").doc(id).set({
        name,
        wowSeconds: 6,
        activeEventId: null,
        pinHash: "",
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge:true });

      replaceParam("church", id);
      location.reload();
    } catch(e){
      console.error(e);
      if(createChurchMsg) createChurchMsg.textContent = "Error creando iglesia. Revisa reglas.";
    } finally{
      btnCreateChurch.disabled = false;
      btnCreateChurch.textContent = "+ Nueva";
      newChurchName.value = "";
    }
  });

  btnOpenSession?.addEventListener("click", openSession);
  btnCloseSession?.addEventListener("click", closeSession);

  formCheckin?.addEventListener("submit", submitCheckin);
}

/******** Session UI ********/
function renderSession(){
  if(activeEventId){
    sessionPill.textContent = "ABIERTA";
    sessionPill.className = "pill ok";
    btnCloseSession.disabled = false;
    if(sessionMeta) sessionMeta.textContent = `Evento activo: ${activeEventId}`;
    if(checkinStatus) checkinStatus.textContent = "Sesión abierta ✅";
  } else {
    sessionPill.textContent = "CERRADA";
    sessionPill.className = "pill bad";
    btnCloseSession.disabled = true;
    if(sessionMeta) sessionMeta.textContent = "No hay sesión abierta.";
    if(checkinStatus) checkinStatus.textContent = "Abre una sesión en Configuración para registrar.";
    if(kpiTotal) kpiTotal.textContent = "0";
    if(tickerTrack) tickerTrack.innerHTML = "";
    if(welcomeBig) welcomeBig.textContent = "Bienvenidos";
  }
}

/******** Open/Close session ********/
async function openSession(){
  const title = clean(sessionTitle.value) || `Servicio ${new Date().toLocaleDateString()}`;
  const date = new Date().toISOString().slice(0,10);

  const evRef = db.collection("churches").doc(churchId).collection("events").doc();
  await evRef.set({
    title, date, status:"open",
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });

  await db.collection("churches").doc(churchId).set({ activeEventId: evRef.id }, { merge:true });
  sessionTitle.value = "";
}

async function closeSession(){
  if(!activeEventId) return;
  const evRef = db.collection("churches").doc(churchId).collection("events").doc(activeEventId);

  await evRef.set({
    status:"closed",
    closedAt: firebase.firestore.FieldValue.serverTimestamp()
  }, { merge:true });

  await db.collection("churches").doc(churchId).set({ activeEventId:null }, { merge:true });
}

/******** Submit checkin ********/
async function submitCheckin(e){
  e.preventDefault();

  if(!activeEventId){
    if(errCheckin){
      errCheckin.hidden = false;
      errCheckin.textContent = "Sesión cerrada. Abre sesión en Configuración.";
    }
    return;
  }

  const f = clean(firstName.value);
  const l = clean(lastName.value);
  const t = clean(town.value);
  const qty = Math.max(1, parseInt(partySize.value,10) || 1);

  if(!f || !l){
    if(errCheckin){
      errCheckin.hidden = false;
      errCheckin.textContent = "Falta nombre y/o apellido.";
    }
    return;
  }
  if(errCheckin) errCheckin.hidden = true;

  const full = `${f} ${l}`.trim();

  await db.collection("churches").doc(churchId)
    .collection("events").doc(activeEventId)
    .collection("checkins")
    .add({
      firstName:f,
      lastName:l,
      fullName:full,
      town: t || "",
      partySize: qty,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

  firstName.value=""; lastName.value=""; town.value=""; partySize.value="1";
  firstName.focus();
  if(checkinStatus) checkinStatus.textContent = "Registrado ✅";
}

/******** Realtime checkins ********/
function mountCheckins(){
  if(unsubCheckins) unsubCheckins();
  firstLoad = true;
  lastWelcomeId = null;

  if(!activeEventId) return;

  unsubCheckins = db.collection("churches").doc(churchId)
    .collection("events").doc(activeEventId)
    .collection("checkins")
    .orderBy("createdAt","desc")
    .limit(40)
    .onSnapshot(snap=>{
      let total=0;
      const names=[];

      const newestDoc = snap.docs[0];
      const newestId  = newestDoc ? newestDoc.id : null;
      const newest    = newestDoc ? (newestDoc.data() || {}) : null;

      snap.forEach(doc=>{
        const d = doc.data() || {};
        total += Number(d.partySize || 1);
        if(d.fullName) names.push(d.fullName);
      });

      if(kpiTotal) kpiTotal.textContent = total;

      if(tickerTrack){
        tickerTrack.innerHTML = names.concat(names).map(n=>(
          `<span class="tickerItem">${escapeHtml(n)}</span>`
        )).join("");
      }

      if(newestId && newest && newest.fullName){
        if(firstLoad){
          firstLoad=false;
          lastWelcomeId=newestId;
          if(welcomeBig) welcomeBig.textContent="Bienvenidos";
        } else if(newestId !== lastWelcomeId){
          lastWelcomeId=newestId;
          popWelcome(newest.fullName);
        }
      }
    }, console.error);
}

/******** WOW pop ********/
function popWelcome(fullName){
  if(welcomeTimer) clearTimeout(welcomeTimer);

  const churchText = churchName ? ` a la Iglesia ${churchName}` : "";
  const msg = `Bienvenidos ${fullName}${churchText}`;

  if(welcomeBig){
    welcomeBig.textContent = msg;
    welcomeBig.classList.remove("pop");
    void welcomeBig.offsetWidth;
    welcomeBig.classList.add("pop");
  }

  welcomeTimer = setTimeout(()=>{
    if(welcomeBig){
      welcomeBig.classList.remove("pop");
      welcomeBig.textContent = "Bienvenidos";
    }
  }, WOW_MS);
}

/******** History realtime ********/
function mountHistory(){
  if(unsubHistory) unsubHistory();

  unsubHistory = db.collection("churches").doc(churchId)
    .collection("events")
    .orderBy("createdAt","desc")
    .limit(20)
    .onSnapshot(snap=>{
      if(!historyList) return;
      historyList.innerHTML = "";

      if(snap.empty){
        historyList.innerHTML = `<div class="hint">No hay sesiones todavía.</div>`;
        return;
      }

      snap.forEach(doc=>{
        const e = doc.data() || {};
        const id = doc.id;

        const title = e.title || "Sesión";
        const date  = e.date || "";
        const status= e.status || "—";

        const box = document.createElement("div");
        box.className = "hItem";
        box.innerHTML = `
          <div class="hTop">
            <div>
              <div class="hTitle">${escapeHtml(title)}</div>
              <div class="hMeta">${escapeHtml(date)} · ${escapeHtml(status)} · ID: ${id}</div>
            </div>
            <div class="hBtns">
              <button class="ghost" data-pdf="${id}">PDF</button>
            </div>
          </div>
        `;
        historyList.appendChild(box);
      });

      historyList.querySelectorAll("button[data-pdf]").forEach(btn=>{
        btn.addEventListener("click", ()=> exportEventPDF(btn.getAttribute("data-pdf")));
      });
    }, console.error);
}

/******** Export PDF ********/
async function exportEventPDF(eventId){
  const evRef = db.collection("churches").doc(churchId).collection("events").doc(eventId);
  const evSnap = await evRef.get();
  const ev = evSnap.data() || {};
  const title = ev.title || "Sesión";
  const date = ev.date || "";

  const qSnap = await evRef.collection("checkins").orderBy("createdAt","asc").get();

  const rows = [];
  let total = 0;

  qSnap.forEach((doc, idx)=>{
    const d = doc.data() || {};
    const qty = Number(d.partySize || 1);
    total += qty;

    rows.push({
      n: idx+1,
      time: d.createdAt ? d.createdAt.toDate().toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"}) : "",
      name: d.fullName || "",
      town: d.town || "",
      qty
    });
  });

  const pdf = new jsPDF({ unit:"pt", format:"letter" });
  let y = 50;

  pdf.setFont("helvetica","bold");
  pdf.setFontSize(18);
  pdf.text("Nexus Churchs — Historial de Asistencia", 40, y); y += 22;

  pdf.setFont("helvetica","normal");
  pdf.setFontSize(12);
  pdf.text(`Iglesia: ${churchName || churchId}`, 40, y); y += 16;
  pdf.text(`Sesión: ${title}`, 40, y); y += 16;
  pdf.text(`Fecha: ${date}`, 40, y); y += 16;
  pdf.text(`Total asistencia: ${total}`, 40, y); y += 22;

  pdf.setFont("helvetica","bold");
  pdf.text("#", 40, y);
  pdf.text("Hora", 70, y);
  pdf.text("Nombre", 130, y);
  pdf.text("Pueblo", 360, y);
  pdf.text("Qty", 540, y);
  y += 12;

  pdf.setDrawColor(90);
  pdf.line(40, y, 572, y);
  y += 14;

  pdf.setFont("helvetica","normal");
  pdf.setFontSize(11);

  for(const r of rows){
    if(y > 740){ pdf.addPage(); y = 60; }
    pdf.text(String(r.n), 40, y);
    pdf.text(r.time, 70, y);
    pdf.text(trunc(r.name, 34), 130, y);
    pdf.text(trunc(r.town, 20), 360, y);
    pdf.text(String(r.qty), 540, y);
    y += 16;
  }

  pdf.save(`NexusChurchs_${safeFile(title)}_${date || "reporte"}.pdf`);
}

/***********************
 * PIN POR IGLESIA (FIX DEFINITIVO)
 * - Default 1234 si NO hay pinHash
 * - Overlay se oculta FORZADO (style.display, pointer-events, opacity)
 ***********************/
function isUnlocked(){
  return sessionStorage.getItem(UNLOCK_KEY(churchId)) === "1";
}
function setUnlocked(v){
  sessionStorage.setItem(UNLOCK_KEY(churchId), v ? "1" : "0");
}
function hardShowOverlay(){
  if(!pinOverlay) return;
  pinOverlay.hidden = false;
  pinOverlay.style.display = "flex";
  pinOverlay.style.opacity = "1";
  pinOverlay.style.pointerEvents = "auto";
  pinOverlay.classList.add("show");
}
function hardHideOverlay(){
  if(!pinOverlay) return;
  pinOverlay.hidden = true;
  pinOverlay.style.display = "none";
  pinOverlay.style.opacity = "0";
  pinOverlay.style.pointerEvents = "none";
  pinOverlay.classList.remove("show");
}
function lockApp(){
  setUnlocked(false);
  document.body.classList.add("locked");
  hardShowOverlay();

  if(pinError){
    pinError.hidden = true;
    pinError.textContent = "";
  }
  if(pinInput){
    pinInput.value = "";
    setTimeout(()=> pinInput.focus(), 150);
  }
  try{ if(isWowFullscreen) toggleWowFullscreen(false); }catch(e){}
}
function unlockApp(){
  setUnlocked(true);
  document.body.classList.remove("locked");
  hardHideOverlay();
  console.log("✅ PIN OK — App desbloqueada");
}
function enforcePinForChurch(){
  if(isUnlocked()) unlockApp();
  else lockApp();
}
function showPinError(msg){
  if(!pinError) return;
  pinError.hidden = false;
  pinError.textContent = msg;
}

async function sha256Hex(text){
  const enc = new TextEncoder().encode(String(text || ""));
  const buf = await crypto.subtle.digest("SHA-256", enc);
  const arr = Array.from(new Uint8Array(buf));
  return arr.map(b=>b.toString(16).padStart(2,"0")).join("");
}

async function tryUnlockPin(){
  const entered = String(pinInput?.value || "").trim();
  console.log("PIN entered:", entered);

  if(!/^\d{4,6}$/.test(entered)){
    showPinError("PIN inválido. Usa 4–6 dígitos.");
    return;
  }

  // Sin pinHash => default 1234
  if(!churchPinHash){
    if(entered === DEFAULT_PIN){
      unlockApp();
      return;
    }
    showPinError("PIN incorrecto. Default: 1234.");
    return;
  }

  try{
    const enteredHash = await sha256Hex(entered);
    if(enteredHash === churchPinHash){
      unlockApp();
      return;
    }
    showPinError("PIN incorrecto.");
  }catch(err){
    console.error("PIN unlock error:", err);
    showPinError("Error validando PIN.");
  }
}

function bindPinActions(){
  if(btnLock) btnLock.addEventListener("click", (e)=>{ e.preventDefault(); lockApp(); });
  if(btnPinUnlock) btnPinUnlock.addEventListener("click", (e)=>{ e.preventDefault(); tryUnlockPin(); });

  if(pinInput){
    pinInput.addEventListener("keydown", (e)=>{
      if(e.key === "Enter"){
        e.preventDefault();
        tryUnlockPin();
      }
    });
  }

  if(btnSavePin){
    btnSavePin.addEventListener("click", async (e)=>{
      e.preventDefault();
      if(pinSavedMsg) pinSavedMsg.textContent = "—";

      const cur = String(pinCurrent?.value || "").trim();
      const neu = String(pinNew?.value || "").trim();

      if(!/^\d{4,6}$/.test(cur)){
        if(pinSavedMsg) pinSavedMsg.textContent = "PIN actual inválido.";
        return;
      }
      if(!/^\d{4,6}$/.test(neu)){
        if(pinSavedMsg) pinSavedMsg.textContent = "Nuevo PIN inválido (4–6 dígitos).";
        return;
      }

      try{
        // si no existía pinHash, el actual válido es default 1234
        if(!churchPinHash && cur !== DEFAULT_PIN){
          if(pinSavedMsg) pinSavedMsg.textContent = "PIN actual incorrecto (default 1234).";
          return;
        }

        // si existía pinHash, verificar contra hash actual
        if(churchPinHash){
          const curHash = await sha256Hex(cur);
          if(curHash !== churchPinHash){
            if(pinSavedMsg) pinSavedMsg.textContent = "PIN actual incorrecto.";
            return;
          }
        }

        const neuHash = await sha256Hex(neu);

        await db.collection("churches").doc(churchId).set({
          pinHash: neuHash,
          pinUpdatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge:true });

        churchPinHash = neuHash;
        if(pinSavedMsg) pinSavedMsg.textContent = "PIN actualizado ✅ (solo esta iglesia)";
        if(pinCurrent) pinCurrent.value = "";
        if(pinNew) pinNew.value = "";
      }catch(err){
        console.error("Save PIN error:", err);
        if(pinSavedMsg) pinSavedMsg.textContent = "No se pudo guardar el PIN.";
      }
    });
  }
}

/******** Utils ********/
function replaceParam(key, value){
  const u = new URL(location.href);
  u.searchParams.set(key, value);
  history.replaceState({}, "", u.toString());
}
function clean(v){ return String(v || "").replace(/\s+/g," ").trim(); }
function clamp(n,a,b){ return Math.max(a, Math.min(b, n)); }
function escapeHtml(str){
  return String(str || "")
    .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
    .replaceAll('"',"&quot;").replaceAll("'","&#039;");
}
function trunc(s, max){
  s = String(s || "");
  return s.length > max ? s.slice(0, max-1) + "…" : s;
}
function safeFile(s){
  return String(s || "").replace(/[^\w\-]+/g,"_").slice(0,40);
}
function slugify(s){
  return String(s||"").trim().toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .replace(/[^a-z0-9]+/g,"-")
    .replace(/^-+|-+$/g,"")
    .slice(0,40);
}
function rand4(){ return Math.random().toString(36).slice(2,6); }
