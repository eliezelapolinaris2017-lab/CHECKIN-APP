"use strict";

/* ==========================================================
   Nexus Churchs — app.js (COMPLETO)
   - Multi-iglesias
   - Tabs
   - WOW fullscreen limpio + audio fade
   - Verses: catálogo (assets/verses/index.json) + dropdown
   - Queue: cola rotativa en tiempo real (Firestore)
   - PIN por iglesia
========================================================== */

if (window.__NEXUS_CHURCHS_LOADED__) {
  console.warn("Duplicated app.js execution blocked.");
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
firebase.auth().signInAnonymously().catch(()=>{});
const { jsPDF } = (window.jspdf || {});

/* =========================
   URL church
========================= */
const params = new URLSearchParams(location.search);
let churchId = clean(params.get("church") || "demo");

/* =========================
   Tabs
========================= */
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

/* =========================
   DOM
========================= */
const churchSelect = document.getElementById("churchSelect");
const kpiTotal = document.getElementById("kpiTotal");

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
const wowAudio = document.getElementById("wowAudio");

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

/* Verse UI */
const verseSelect = document.getElementById("verseSelect");
const versePreview = document.getElementById("versePreview");
const verseDuration = document.getElementById("verseDuration");
const btnAddToQueue = document.getElementById("btnAddToQueue");
const btnClearQueue = document.getElementById("btnClearQueue");
const btnStartQueue = document.getElementById("btnStartQueue");
const btnStopQueue  = document.getElementById("btnStopQueue");
const queueMsg = document.getElementById("queueMsg");
const queueCount = document.getElementById("queueCount");

/* Verse render in WOW */
const verseLine = document.getElementById("verseLine");
const verseRef  = document.getElementById("verseRef");

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

/* =========================
   State
========================= */
let churchName = "";
let activeEventId = null;
let WOW_MS = 6000;

let unsubChurch = null;
let unsubCheckins = null;
let unsubHistory = null;

let firstLoad = true;
let lastWelcomeId = null;
let welcomeTimer = null;

let isWowFullscreen = false;
let wasTabBeforeWow = "register";
let fadeTimer = null;

const WOW_VOL_TARGET = 0.35;
const FADE_MS = 1000;

/* PIN */
let pinHashFromDB = "";

/* Verses catálogo + queue */
let VERSES_CATALOG = []; // [{path, ref, text}]
let WOW_QUEUE = [];      // [{path, ref, duration}]
let queueEnabled = false;
let queueIndex = 0;
let queueTimer = null;

/* =========================
   INIT
========================= */
init().catch(console.error);

async function init(){
  // WOW fullscreen
  if(btnWowFullscreen) btnWowFullscreen.onclick = ()=> toggleWowFullscreen();
  document.addEventListener("keydown",(e)=>{
    if(e.key === "Escape" && isWowFullscreen) toggleWowFullscreen(false);
  });

  // PIN enter
  if(pinInput){
    pinInput.addEventListener("keydown",(e)=>{
      if(e.key === "Enter"){ e.preventDefault(); tryUnlock(); }
    });
  }

  await loadChurches();
  await loadVersesCatalog();     // <-- catálogo dropdown
  bindActions();
  watchChurch();

  firstName?.focus();
}

/* =========================
   Audio fade
========================= */
function stopFade(){
  if(fadeTimer){ clearInterval(fadeTimer); fadeTimer=null; }
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
    const t = i/steps;
    wowAudio.volume = clamp(startVol + (endVol-startVol)*t, 0, 1);
    if(i>=steps){
      stopFade();
      wowAudio.volume = endVol;
    }
  }, stepMs);
}

/* =========================
   WOW fullscreen
========================= */
function toggleWowFullscreen(force){
  const next = (typeof force === "boolean") ? force : !isWowFullscreen;

  if(next){
    wasTabBeforeWow = lastTabKey || "register";
    openTab("wow");

    document.body.classList.add("wow-fullscreen");
    isWowFullscreen = true;

    if(btnWowFullscreen){
      btnWowFullscreen.textContent = "✕";
      btnWowFullscreen.setAttribute("aria-label","Salir de pantalla completa");
    }

    // Audio
    try{
      if(wowAudio){
        wowAudio.currentTime = 0;
        wowAudio.volume = 0.0;
        const p = wowAudio.play();
        if(p && typeof p.catch === "function") p.catch(()=>{});
        fadeTo(WOW_VOL_TARGET, FADE_MS);
      }
    }catch(e){}

    // Render inmediato (si queue está corriendo)
    renderCurrentQueueItem();

  } else {
    document.body.classList.remove("wow-fullscreen");
    isWowFullscreen = false;

    if(btnWowFullscreen){
      btnWowFullscreen.textContent = "⛶";
      btnWowFullscreen.setAttribute("aria-label","Entrar a pantalla completa");
    }

    // Stop audio
    try{
      fadeTo(0.0, 300);
      setTimeout(()=>{ try{ wowAudio.pause(); wowAudio.currentTime=0; }catch(e){} }, 320);
    }catch(e){}

    openTab(wasTabBeforeWow || "register");

    // opcional: esconder verse al salir
    if(verseLine) verseLine.hidden = true;
    if(verseRef)  verseRef.hidden = true;
  }
}

/* =========================
   Churches list
========================= */
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
      const d=doc.data()||{};
      addOpt(doc.id, d.name || doc.id);
      if(doc.id===churchId) found=true;
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

/* =========================
   Verses catalog (dropdown)
   - lee assets/verses/index.json
========================= */
async function loadVersesCatalog(){
  if(!verseSelect) return;

  verseSelect.innerHTML = `<option value="">Cargando catálogo…</option>`;
  versePreview && (versePreview.textContent = "—");

  try{
    const res = await fetch("assets/verses/index.json", { cache:"no-store" });
    if(!res.ok) throw new Error("No existe assets/verses/index.json");
    const data = await res.json();

    VERSES_CATALOG = Array.isArray(data.items) ? data.items : [];
    verseSelect.innerHTML = `<option value="">— Selecciona un versículo —</option>`;

    VERSES_CATALOG.forEach((it, idx)=>{
      const opt = document.createElement("option");
      opt.value = String(idx);
      opt.textContent = `${clean(it.ref || "Verso")} — ${trunc(clean(it.text||""), 42)}`;
      verseSelect.appendChild(opt);
    });

    verseSelect.onchange = ()=>{
      const i = parseInt(verseSelect.value,10);
      const it = VERSES_CATALOG[i];
      if(!it){
        versePreview && (versePreview.textContent = "—");
        return;
      }
      const ref = clean(it.ref || "");
      const txt = clean(it.text || "");
      versePreview && (versePreview.textContent = ref ? `${ref} — ${txt}` : txt);
    };

  }catch(e){
    VERSES_CATALOG = [];
    verseSelect.innerHTML = `<option value="">Catálogo no disponible</option>`;
    versePreview && (versePreview.textContent = "Crea assets/verses/index.json");
  }
}

/* =========================
   Watch church doc
   - Lee: wowSeconds, pinHash, activeEventId
   - Lee queue: wowQueue, queueEnabled, queueIndex
========================= */
function watchChurch(){
  if(unsubChurch) unsubChurch();

  unsubChurch = db.collection("churches").doc(churchId).onSnapshot(doc=>{
    const d = doc.data() || {};

    churchName = clean(d.name) || doc.id;
    activeEventId = d.activeEventId || null;

    const sec = clamp(parseInt(d.wowSeconds || 6,10) || 6, 1, 30);
    WOW_MS = sec * 1000;
    if(wowSeconds) wowSeconds.value = String(sec);

    pinHashFromDB = clean(d.pinHash || "");

    // Queue
    WOW_QUEUE = Array.isArray(d.wowQueue) ? d.wowQueue : [];
    queueEnabled = !!d.queueEnabled;
    queueIndex = clamp(parseInt(d.queueIndex || 0,10) || 0, 0, Math.max(0, WOW_QUEUE.length-1));

    if(queueCount) queueCount.textContent = `Cola: ${WOW_QUEUE.length}`;

    renderSession();
    mountCheckins();
    mountHistory();

    // PIN gate
    enforcePin();

    // Si queue está enabled, corre rotación local
    if(queueEnabled) startLocalQueueRotation();
    else stopLocalQueueRotation();

    // Render actual
    renderCurrentQueueItem();

  }, console.error);
}

/* =========================
   Actions
========================= */
function bindActions(){
  // WOW seconds save
  if(btnSaveWow){
    btnSaveWow.onclick = async ()=>{
      const sec = clamp(parseInt(wowSeconds.value,10) || 6, 1, 30);
      await db.collection("churches").doc(churchId).set({ wowSeconds: sec }, { merge:true });
      wowSavedMsg && (wowSavedMsg.textContent = `WOW guardado: ${sec}s`);
    };
  }

  // Create church
  if(btnCreateChurch){
    btnCreateChurch.onclick = async ()=>{
      const name = clean(newChurchName?.value);
      if(!name){
        createChurchMsg && (createChurchMsg.textContent = "Escribe el nombre de la iglesia.");
        return;
      }
      btnCreateChurch.disabled = true;
      btnCreateChurch.textContent = "Creando…";
      try{
        let id = slugify(name) || ("iglesia_" + rand4());
        const exists = await db.collection("churches").doc(id).get();
        if(exists.exists) id = `${id}_${rand4()}`;

        await db.collection("churches").doc(id).set({
          name, wowSeconds: 6, activeEventId: null,
          pinHash: "",
          wowQueue: [],
          queueEnabled: false,
          queueIndex: 0,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge:true });

        replaceParam("church", id);
        location.reload();
      }catch(e){
        console.error(e);
        createChurchMsg && (createChurchMsg.textContent = "Error creando iglesia (reglas/permiso).");
      }finally{
        btnCreateChurch.disabled = false;
        btnCreateChurch.textContent = "+ Nueva";
        if(newChurchName) newChurchName.value = "";
      }
    };
  }

  // Session open/close
  btnOpenSession && (btnOpenSession.onclick = openSession);
  btnCloseSession && (btnCloseSession.onclick = closeSession);

  // Register
  formCheckin && (formCheckin.onsubmit = submitCheckin);

  // PIN
  btnLock && (btnLock.onclick = ()=> lockApp());
  btnPinUnlock && (btnPinUnlock.onclick = ()=> tryUnlock());
  btnSavePin && (btnSavePin.onclick = ()=> changePin());

  // Queue controls
  if(btnAddToQueue){
    btnAddToQueue.onclick = async ()=>{
      const i = parseInt(verseSelect?.value || "",10);
      const it = VERSES_CATALOG[i];
      if(!it){
        queueMsg && (queueMsg.textContent = "Selecciona un versículo del dropdown.");
        return;
      }

      const dur = clamp(parseInt(verseDuration?.value || "12",10) || 12, 3, 120);
      const item = { path: clean(it.path), ref: clean(it.ref||""), duration: dur };

      if(!item.path || !item.path.endsWith(".json")){
        queueMsg && (queueMsg.textContent = "Este item no tiene path .json válido.");
        return;
      }

      const nextQueue = (WOW_QUEUE || []).concat([item]);

      await db.collection("churches").doc(churchId).set({
        wowQueue: nextQueue
      }, { merge:true });

      queueMsg && (queueMsg.textContent = "Añadido a cola ✅");
    };
  }

  if(btnClearQueue){
    btnClearQueue.onclick = async ()=>{
      await db.collection("churches").doc(churchId).set({
        wowQueue: [],
        queueIndex: 0
      }, { merge:true });
      queueMsg && (queueMsg.textContent = "Cola vacía ✅");
    };
  }

  if(btnStartQueue){
    btnStartQueue.onclick = async ()=>{
      if(!WOW_QUEUE || WOW_QUEUE.length === 0){
        queueMsg && (queueMsg.textContent = "La cola está vacía.");
        return;
      }
      await db.collection("churches").doc(churchId).set({
        queueEnabled: true
      }, { merge:true });
      queueMsg && (queueMsg.textContent = "Rotación iniciada ▶");
    };
  }

  if(btnStopQueue){
    btnStopQueue.onclick = async ()=>{
      await db.collection("churches").doc(churchId).set({
        queueEnabled: false
      }, { merge:true });
      queueMsg && (queueMsg.textContent = "Rotación pausada ⏸");
    };
  }
}

/* =========================
   Queue rotation (local timer)
   - El control (enabled/index) vive en Firestore
   - Cada device puede rotar local, pero el índice se sincroniza
========================= */
function stopLocalQueueRotation(){
  if(queueTimer){ clearTimeout(queueTimer); queueTimer = null; }
}

function startLocalQueueRotation(){
  stopLocalQueueRotation();
  // evita correr si no hay cola
  if(!WOW_QUEUE || WOW_QUEUE.length === 0) return;

  const current = WOW_QUEUE[queueIndex] || WOW_QUEUE[0];
  const dur = clamp(parseInt(current?.duration || 12,10) || 12, 3, 120);

  queueTimer = setTimeout(async ()=>{
    try{
      if(!queueEnabled) return;

      const nextIndex = (queueIndex + 1) % WOW_QUEUE.length;

      // escribe el índice global para que todos vayan al mismo ritmo
      await db.collection("churches").doc(churchId).set({
        queueIndex: nextIndex
      }, { merge:true });

    }catch(e){
      console.warn("queue rotate err", e);
    }
  }, dur * 1000);
}

/* Render item actual */
async function renderCurrentQueueItem(){
  // si no hay queue o está deshabilitada, no mostramos nada (o puedes dejar fijo)
  if(!queueEnabled || !WOW_QUEUE || WOW_QUEUE.length === 0){
    if(verseLine) verseLine.hidden = true;
    if(verseRef)  verseRef.hidden  = true;
    return;
  }

  const item = WOW_QUEUE[queueIndex] || WOW_QUEUE[0];
  if(!item?.path) return;

  await loadVerseByPath(item.path, item.ref || "");
}

/* fetch del verse json */
async function loadVerseByPath(path, fallbackRef){
  try{
    if(!verseLine || !verseRef) return;

    const res = await fetch(path, { cache:"no-store" });
    if(!res.ok) throw new Error("404 verse: " + path);

    const j = await res.json();
    const txt = clean(j.text || "");
    const ref = clean(j.ref || fallbackRef || "");

    if(!txt){
      verseLine.hidden = true;
      verseRef.hidden  = true;
      return;
    }

    verseLine.textContent = txt;
    verseRef.textContent  = ref || "—";
    verseLine.hidden = false;
    verseRef.hidden  = false;

  }catch(e){
    console.warn("loadVerseByPath:", e);
    if(verseLine) verseLine.hidden = true;
    if(verseRef)  verseRef.hidden  = true;
  }
}

/* =========================
   Session
========================= */
function renderSession(){
  if(!sessionPill) return;

  if(activeEventId){
    sessionPill.textContent = "ABIERTA";
    sessionPill.className = "pill ok";
    if(btnCloseSession) btnCloseSession.disabled = false;
    sessionMeta && (sessionMeta.textContent = `Evento activo: ${activeEventId}`);
    checkinStatus && (checkinStatus.textContent = "Sesión abierta ✅");
  } else {
    sessionPill.textContent = "CERRADA";
    sessionPill.className = "pill bad";
    if(btnCloseSession) btnCloseSession.disabled = true;
    sessionMeta && (sessionMeta.textContent = "No hay sesión abierta.");
    checkinStatus && (checkinStatus.textContent = "Abre sesión en Configuración para registrar.");
    if(kpiTotal) kpiTotal.textContent = "0";
    if(tickerTrack) tickerTrack.innerHTML = "";
    if(welcomeBig) welcomeBig.textContent = "Bienvenidos";
  }
}

async function openSession(){
  const title = clean(sessionTitle?.value) || `Servicio ${new Date().toLocaleDateString()}`;
  const date = new Date().toISOString().slice(0,10);

  const evRef = db.collection("churches").doc(churchId).collection("events").doc();
  await evRef.set({
    title, date, status:"open",
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });

  await db.collection("churches").doc(churchId).set({ activeEventId: evRef.id }, { merge:true });
  if(sessionTitle) sessionTitle.value = "";
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

/* =========================
   Checkin
========================= */
async function submitCheckin(e){
  e.preventDefault();

  if(!activeEventId){
    if(errCheckin){
      errCheckin.hidden = false;
      errCheckin.textContent = "Sesión cerrada. Abre sesión en Configuración.";
    }
    return;
  }

  const f = clean(firstName?.value);
  const l = clean(lastName?.value);
  const t = clean(town?.value);
  const qty = Math.max(1, parseInt(partySize?.value,10) || 1);

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

  if(firstName) firstName.value="";
  if(lastName) lastName.value="";
  if(town) town.value="";
  if(partySize) partySize.value="1";
  firstName && firstName.focus();
  checkinStatus && (checkinStatus.textContent = "Registrado ✅");
}

/* =========================
   Realtime checkins: KPI + ticker + welcome pop
========================= */
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

      if(kpiTotal) kpiTotal.textContent = String(total);

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

/* =========================
   History + PDF
========================= */
function mountHistory(){
  if(unsubHistory) unsubHistory();
  if(!historyList) return;

  unsubHistory = db.collection("churches").doc(churchId)
    .collection("events")
    .orderBy("createdAt","desc")
    .limit(20)
    .onSnapshot(snap=>{
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
        btn.onclick = ()=> exportEventPDF(btn.getAttribute("data-pdf"));
      });
    }, console.error);
}

async function exportEventPDF(eventId){
  if(!jsPDF){
    alert("jsPDF no cargó.");
    return;
  }

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

/* =========================
   PIN Gate (por iglesia)
   - pinHash vacío => default 1234
========================= */
function isUnlocked(){
  return sessionStorage.getItem(`nc_pin_ok_${churchId}`) === "1";
}
function setUnlocked(v){
  sessionStorage.setItem(`nc_pin_ok_${churchId}`, v ? "1" : "0");
}
function enforcePin(){
  // si overlay no existe, no bloquee
  if(!pinOverlay) return;

  if(isUnlocked()){
    pinOverlay.hidden = true;
    document.body.classList.remove("locked");
    return;
  }
  pinOverlay.hidden = false;
  document.body.classList.add("locked");
  if(pinSub) pinSub.textContent = `Entrar PIN — ${churchName || churchId}`;
  if(pinError){ pinError.hidden = true; pinError.textContent = ""; }
  if(pinInput){ pinInput.value = ""; setTimeout(()=> pinInput.focus(), 80); }
}
function lockApp(){
  setUnlocked(false);
  enforcePin();
}
async function tryUnlock(){
  const entered = clean(pinInput?.value);
  if(!/^\d{4,6}$/.test(entered)){
    return showPinError("PIN inválido (4–6 dígitos).");
  }

  // default si no hay pinHash en DB
  const expectedHash = pinHashFromDB ? pinHashFromDB : await sha256Hex("1234");
  const enteredHash = await sha256Hex(entered);

  if(enteredHash !== expectedHash){
    return showPinError("PIN incorrecto.");
  }

  // si DB no tenía pinHash, lo sembramos (para que deje de ser “default” ambiguo)
  if(!pinHashFromDB){
    try{
      await db.collection("churches").doc(churchId).set({ pinHash: expectedHash }, { merge:true });
      pinHashFromDB = expectedHash;
    }catch(e){}
  }

  setUnlocked(true);
  enforcePin();
}
function showPinError(msg){
  if(!pinError) return;
  pinError.hidden = false;
  pinError.textContent = msg;
}
async function changePin(){
  const cur = clean(pinCurrent?.value);
  const neu = clean(pinNew?.value);

  if(!/^\d{4,6}$/.test(cur) || !/^\d{4,6}$/.test(neu)){
    pinSavedMsg && (pinSavedMsg.textContent = "PIN inválido (4–6 dígitos).");
    return;
  }

  const expectedHash = pinHashFromDB ? pinHashFromDB : await sha256Hex("1234");
  const curHash = await sha256Hex(cur);

  if(curHash !== expectedHash){
    pinSavedMsg && (pinSavedMsg.textContent = "PIN actual incorrecto.");
    return;
  }

  const newHash = await sha256Hex(neu);
  await db.collection("churches").doc(churchId).set({ pinHash: newHash }, { merge:true });
  pinHashFromDB = newHash;

  if(pinCurrent) pinCurrent.value = "";
  if(pinNew) pinNew.value = "";
  pinSavedMsg && (pinSavedMsg.textContent = "PIN actualizado ✅ (solo esta iglesia)");
}

/* =========================
   Utils
========================= */
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

/* SHA-256 HEX */
async function sha256Hex(text){
  const enc = new TextEncoder().encode(String(text || ""));
  const buf = await crypto.subtle.digest("SHA-256", enc);
  const arr = Array.from(new Uint8Array(buf));
  return arr.map(b=> b.toString(16).padStart(2,"0")).join("");
}
