"use strict";

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

/******** Tabs ********/
const tabBtns = document.querySelectorAll(".tabBtn");
const tabPanels = document.querySelectorAll(".tab");
let lastTabKey = "register";

function openTab(key){
  if(!key) key = "register";
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
}
tabBtns.forEach(btn=> btn.addEventListener("click", ()=> openTab(btn.dataset.tab)));
openTab("register");

/******** DOM ********/
const churchSelect = document.getElementById("churchSelect");
const kpiTotal = document.getElementById("kpiTotal");
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

/******** Iglesia name ********/
let churchName = "";
/******** PIN hash por iglesia ********/
let churchPinHash = ""; // sha256 hex

/******** WOW Fullscreen + Audio fade ********/
let wasTabBeforeWow = "register";
let isWowFullscreen = false;
let fadeTimer = null;

const WOW_VOL_TARGET = 0.35;
const FADE_MS = 1000;

/******** PIN Session (por iglesia) ********/
const UNLOCK_KEY = (id)=> `nc.unlocked.${id}.v1`;
const DEFAULT_PIN = "1234";

/******** INIT ********/
init().catch(console.error);

async function init(){
  btnWowFullscreen.onclick = toggleWowFullscreen;

  document.addEventListener("keydown", (e)=>{
    if(e.key === "Escape" && isWowFullscreen){
      toggleWowFullscreen(false);
    }
  });

  await loadChurches();
  bindActions();
  bindPinActions();
  watchChurch();

  firstName?.focus();
}

/******** Audio fade helpers ********/
function stopFade(){
  if(fadeTimer){
    clearInterval(fadeTimer);
    fadeTimer = null;
  }
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
    const v = startVol + (endVol - startVol) * t;
    wowAudio.volume = clamp(v, 0, 1);

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

    btnWowFullscreen.textContent = "✕";
    btnWowFullscreen.setAttribute("aria-label", "Salir de pantalla completa");

    try{
      wowAudio.currentTime = 0;
      wowAudio.volume = 0.0;
      const p = wowAudio.play();
      if(p && typeof p.catch === "function") p.catch(()=>{});
      fadeTo(WOW_VOL_TARGET, FADE_MS);
    }catch(e){ console.warn("Audio err:", e); }

  } else {
    document.body.classList.remove("wow-fullscreen");
    isWowFullscreen = false;

    btnWowFullscreen.textContent = "⛶";
    btnWowFullscreen.setAttribute("aria-label", "Entrar a pantalla completa");

    try{
      fadeTo(0.0, 300);
      setTimeout(()=>{
        try{ wowAudio.pause(); wowAudio.currentTime = 0; }catch(e){}
      }, 320);
    }catch(e){}

    openTab(wasTabBeforeWow || "register");
  }
}

/******** Churches list ********/
async function loadChurches(){
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

  churchSelect.onchange = ()=>{
    churchId = churchSelect.value;
    replaceParam("church", churchId);
    location.reload();
  };

  function addOpt(id, label){
    const o=document.createElement("option");
    o.value=id; o.textContent=label;
    churchSelect.appendChild(o);
  }
}

/******** Watch church doc (nombre + settings + pinHash) ********/
function watchChurch(){
  if(unsubChurch) unsubChurch();

  unsubChurch = db.collection("churches").doc(churchId).onSnapshot(async (doc)=>{
    const d = doc.data() || {};

    churchName = clean(d.name) || doc.id;
    if(brandSub) brandSub.textContent = churchName;

    activeEventId = d.activeEventId || null;

    const sec = clamp(parseInt(d.wowSeconds || 6, 10) || 6, 1, 30);
    WOW_MS = sec * 1000;
    wowSeconds.value = String(sec);

    // ✅ PIN por iglesia (hash)
    churchPinHash = clean(d.pinHash) || "";
    if(pinSub) pinSub.textContent = `PIN requerido — ${churchName}`;

    // Enforce lock por iglesia
    await enforcePinForChurch();

    renderSession();
    mountCheckins();
    mountHistory();
  }, console.error);
}

/******** PIN logic ********/
function isUnlocked(){
  return sessionStorage.getItem(UNLOCK_KEY(churchId)) === "1";
}
function setUnlocked(v){
  sessionStorage.setItem(UNLOCK_KEY(churchId), v ? "1" : "0");
}
function lockApp(){
  setUnlocked(false);
  document.body.classList.add("locked");
  if(pinOverlay) pinOverlay.hidden = false;
  if(pinError){ pinError.hidden = true; pinError.textContent=""; }
  if(pinInput){ pinInput.value=""; setTimeout(()=>pinInput.focus(), 60); }
  try{ if(isWowFullscreen) toggleWowFullscreen(false); }catch(e){}
}
function unlockApp(){
  setUnlocked(true);
  document.body.classList.remove("locked");
  if(pinOverlay) pinOverlay.hidden = true;
}
async function enforcePinForChurch(){
  // si ya está desbloqueado en esta sesión/iglesia, no molestes
  if(isUnlocked()){
    unlockApp();
    return;
  }
  // si no hay pinHash configurado, usamos default 1234 como base
  // (hash se valida contra default si no existe pinHash)
  lockApp();
}

async function tryUnlockPin(){
  const entered = String(pinInput?.value || "").trim();
  if(!/^\d{4,6}$/.test(entered)){
    showPinError("PIN inválido. Usa 4 a 6 dígitos.");
    return;
  }

  const enteredHash = await sha256Hex(entered);

  if(churchPinHash){
    if(enteredHash === churchPinHash){
      unlockApp();
      return;
    }
    showPinError("PIN incorrecto.");
    return;
  }

  // Si no hay pinHash en Firestore, aceptamos default 1234
  const defaultHash = await sha256Hex(DEFAULT_PIN);
  if(enteredHash === defaultHash){
    unlockApp();
    return;
  }
  showPinError("PIN incorrecto.");
}

function showPinError(msg){
  if(pinError){
    pinError.hidden = false;
    pinError.textContent = msg;
  }
}

function bindPinActions(){
  if(btnLock) btnLock.onclick = ()=> lockApp();

  if(btnPinUnlock) btnPinUnlock.onclick = ()=> tryUnlockPin();

  if(pinInput){
    pinInput.addEventListener("keydown", (e)=>{
      if(e.key === "Enter") tryUnlockPin();
    });
  }

  if(btnSavePin){
    btnSavePin.onclick = async ()=>{
      pinSavedMsg.textContent = "—";
      const cur = String(pinCurrent?.value || "").trim();
      const neu = String(pinNew?.value || "").trim();

      if(!/^\d{4,6}$/.test(neu)){
        pinSavedMsg.textContent = "Nuevo PIN inválido (4–6 dígitos).";
        return;
      }

      // Validación del PIN actual:
      // - si existe churchPinHash: requiere match
      // - si NO existe: requiere default 1234
      const curHash = await sha256Hex(cur);
      const defaultHash = await sha256Hex(DEFAULT_PIN);

      const okCur = churchPinHash ? (curHash === churchPinHash) : (curHash === defaultHash);
      if(!okCur){
        pinSavedMsg.textContent = "PIN actual incorrecto.";
        return;
      }

      const neuHash = await sha256Hex(neu);

      try{
        await db.collection("churches").doc(churchId).set({
          pinHash: neuHash,
          pinUpdatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge:true });

        pinSavedMsg.textContent = "PIN actualizado ✅ (solo para esta iglesia)";
        pinCurrent.value = "";
        pinNew.value = "";
      }catch(e){
        console.error(e);
        pinSavedMsg.textContent = "No se pudo guardar el PIN. Revisa reglas.";
      }
    };
  }
}

/******** Actions ********/
function bindActions(){
  btnSaveWow.onclick = async ()=>{
    const sec = clamp(parseInt(wowSeconds.value,10) || 6, 1, 30);
    await db.collection("churches").doc(churchId).set({ wowSeconds: sec }, { merge:true });
    wowSavedMsg.textContent = `WOW guardado: ${sec}s (global en esta iglesia)`;
  };

  btnCreateChurch.onclick = async ()=>{
    const name = clean(newChurchName.value);
    if(!name){
      createChurchMsg.textContent = "Escribe el nombre de la iglesia.";
      createChurchMsg.style.color = "var(--bad)";
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
        // pinHash queda vacío => default 1234 funciona hasta que lo cambies
        pinHash: "",
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge:true });

      createChurchMsg.textContent = `Creada: "${name}" (ID: ${id})`;
      createChurchMsg.style.color = "var(--muted)";

      replaceParam("church", id);
      location.reload();
    } catch(e){
      console.error(e);
      createChurchMsg.textContent = "Error creando iglesia. Revisa reglas.";
      createChurchMsg.style.color = "var(--bad)";
    } finally{
      btnCreateChurch.disabled = false;
      btnCreateChurch.textContent = "+ Nueva";
      newChurchName.value = "";
    }
  };

  btnOpenSession.onclick = openSession;
  btnCloseSession.onclick = closeSession;

  formCheckin.onsubmit = submitCheckin;
}

/******** Session UI ********/
function renderSession(){
  if(activeEventId){
    sessionPill.textContent = "ABIERTA";
    sessionPill.className = "pill ok";
    btnCloseSession.disabled = false;
    sessionMeta.textContent = `Evento activo: ${activeEventId}`;
    checkinStatus.textContent = "Sesión abierta ✅";
  } else {
    sessionPill.textContent = "CERRADA";
    sessionPill.className = "pill bad";
    btnCloseSession.disabled = true;
    sessionMeta.textContent = "No hay sesión abierta.";
    checkinStatus.textContent = "Abre una sesión en Configuración para registrar.";
    kpiTotal.textContent = "0";
    tickerTrack.innerHTML = "";
    welcomeBig.textContent = "Bienvenidos";
  }
}

/******** Open/Close session ********/
async function openI 

Se cortó el `app.js` en tu pantalla (te quedó a mitad en **“async function R…”**). Eso es exactamente lo que te estaba pasando antes: el archivo queda incompleto y “rompe” todo.

Así que vamos a hacerlo **sin riesgo** y “como negocio”: te doy un **patch 100% seguro** que pegas en tu `app.js` actual (el que ya funciona), sin reescribirlo entero. Con esto quedas con **PIN distinto por iglesia** y listo.

---

# ✅ Implementación SIN ROMPER NADA (PIN por iglesia)

## A) `index.html`
Ya lo tienes casi todo. Solo verifica que tengas:
1) Botón 🔒 en header
2) Overlay del PIN
3) Inputs de PIN en Config: `pinCurrent`, `pinNew`, `btnSavePin`, `pinSavedMsg`

Si ya los tienes, **no toques HTML**.

---

## B) `styles.css`
Ya te pasé el bloque del overlay. Si lo pegaste, ok.

---

## C) `app.js` (TU ARCHIVO ACTUAL) — pega 3 bloques

### 1) AGREGA estos DOM nuevos (una sola vez)
Busca tu sección `/*** DOM ***/` y añade esto debajo de `const wowAudio = ...`:

```js
// ===== PIN UI =====
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

const brandSub = document.getElementById("brandSub"); // opcional (subheader)
