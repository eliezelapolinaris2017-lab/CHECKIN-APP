"use strict";

/* =========================
   NEXUS CHURCHS - app.js
   - Multi iglesias
   - Registro / WOW / Config / Historial
   - WOW fullscreen + audio fade
   - PIN por iglesia (hash SHA-256) + lock
   - Verses JSON por ruta (assets/verses/...)
========================= */

/* ---------- Anti-duplicado ---------- */
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
firebase.auth().signInAnonymously().catch(function(){});
const jsPDF = (window.jspdf && window.jspdf.jsPDF) ? window.jspdf.jsPDF : null;

/* ---------- Helpers ---------- */
function $(id){ return document.getElementById(id); }
function clean(v){ return String(v || "").replace(/\s+/g," ").trim(); }
function clamp(n,a,b){ n = Number(n); return Math.max(a, Math.min(b, n)); }
function escapeHtml(str){
  return String(str || "")
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;").replace(/'/g,"&#039;");
}
function trunc(s, max){
  s = String(s || "");
  return s.length > max ? s.slice(0, max-1) + "..." : s;
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
function replaceParam(key, value){
  const u = new URL(location.href);
  u.searchParams.set(key, value);
  history.replaceState({}, "", u.toString());
}

/* ---------- URL params ---------- */
const params = new URLSearchParams(location.search);
let churchId = clean(params.get("church") || "demo");

/* ---------- Tabs ---------- */
const tabBtns = document.querySelectorAll(".tabBtn");
const tabPanels = document.querySelectorAll(".tab");
let lastTabKey = "register";

function normalizeTabKey(k){
  k = String(k || "").replace("#","").trim().toLowerCase();
  if (k === "registro") return "register";
  if (k === "wow") return "wow";
  if (k === "config" || k === "configuracion") return "config";
  if (k === "historial") return "history";
  if (k === "register" || k === "wow" || k === "config" || k === "history") return k;
  return "register";
}
function keyToHash(key){
  const map = { register:"registro", wow:"wow", config:"config", history:"historial" };
  return map[key] || "registro";
}
function openTab(key, syncHash=true){
  key = normalizeTabKey(key);
  lastTabKey = key;

  tabBtns.forEach(b=>{
    const on = (b.dataset.tab === key);
    b.classList.toggle("active", on);
    b.setAttribute("aria-selected", on ? "true" : "false");
  });

  tabPanels.forEach(p=>{
    const on = (p.dataset.tabpanel === key);
    p.classList.toggle("active", on);
  });

  if(syncHash){
    const h = keyToHash(key);
    if(location.hash !== "#" + h){
      history.replaceState({}, "", location.pathname + location.search + "#" + h);
    }
  }
}
tabBtns.forEach(btn=> btn.addEventListener("click", ()=> openTab(btn.dataset.tab, true)));
window.addEventListener("hashchange", ()=> openTab(location.hash, false));

/* ---------- DOM ---------- */
const churchSelect = $("churchSelect");
const kpiTotal = $("kpiTotal");

const formCheckin = $("formCheckin");
const firstName = $("firstName");
const lastName = $("lastName");
const town = $("town");
const partySize = $("partySize");
const errCheckin = $("errCheckin");
const checkinStatus = $("checkinStatus");

const btnWowFullscreen = $("btnWowFullscreen");
const welcomeBig = $("welcomeBig");
const tickerTrack = $("tickerTrack");

const wowSeconds = $("wowSeconds");
const btnSaveWow = $("btnSaveWow");
const wowSavedMsg = $("wowSavedMsg");

const newChurchName = $("newChurchName");
const btnCreateChurch = $("btnCreateChurch");
const createChurchMsg = $("createChurchMsg");

const sessionPill = $("sessionPill");
const btnOpenSession = $("btnOpenSession");
const btnCloseSession = $("btnCloseSession");
const sessionTitle = $("sessionTitle");
const sessionMeta = $("sessionMeta");

const historyList = $("historyList");
const wowAudio = $("wowAudio");

/* Verses JSON (opcionales en HTML) */
const wowVersePath = $("wowVersePath");
const wowVerseRef  = $("wowVerseRef");
const btnSaveWowVerse = $("btnSaveWowVerse");
const wowVerseMsg = $("wowVerseMsg");

const verseLine = $("verseLine");
const verseRef  = $("verseRef");

/* PIN */
const btnLock = $("btnLock");
const pinOverlay = $("pinOverlay");
const pinInput = $("pinInput");
const btnPinUnlock = $("btnPinUnlock");
const pinError = $("pinError");
const pinSub = $("pinSub");

const pinCurrent = $("pinCurrent");
const pinNew = $("pinNew");
const btnSavePin = $("btnSavePin");
const pinSavedMsg = $("pinSavedMsg");

/* ---------- State ---------- */
let churchName = "";
let activeEventId = null;
let WOW_MS = 6000;

let churchPinHash = "";
const DEFAULT_PIN = "1234";

let unsubChurch = null;
let unsubCheckins = null;
let unsubHistory = null;

let firstLoad = true;
let lastWelcomeId = null;
let welcomeTimer = null;

/* WOW fullscreen + audio fade */
let isWowFullscreen = false;
let wasTabBeforeWow = "register";
let fadeTimer = null;

const WOW_VOL_TARGET = 0.35;
const FADE_MS = 1000;

/* Verses state (por iglesia) */
let WOW_VERSE = { path:"", ref:"" };

/* =========================
   INIT
========================= */
init().catch(console.error);

async function init(){
  openTab(location.hash || "register", true);

  if(btnWowFullscreen) btnWowFullscreen.addEventListener("click", ()=> toggleWowFullscreen());
  document.addEventListener("keydown", (e)=>{
    if(e.key === "Escape" && isWowFullscreen) toggleWowFullscreen(false);
  });

  await loadChurches();
  bindActions();
  bindPinActions();
  watchChurch();

  firstName && firstName.focus();
}

/* =========================
   Audio fade helpers
========================= */
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

/* =========================
   WOW fullscreen toggle
========================= */
function toggleWowFullscreen(force){
  const next = (typeof force === "boolean") ? force : !isWowFullscreen;

  if(next){
    wasTabBeforeWow = lastTabKey || "register";
    openTab("wow", true);

    document.body.classList.add("wow-fullscreen");
    isWowFullscreen = true;

    if(btnWowFullscreen){
      btnWowFullscreen.textContent = "X";
      btnWowFullscreen.setAttribute("aria-label", "Salir de pantalla completa");
    }

    // Asegura texto base visible
    if(welcomeBig){
      if(!welcomeBig.textContent || !welcomeBig.textContent.trim()){
        welcomeBig.textContent = "Bienvenidos";
      }
      welcomeBig.classList.remove("pop");
      void welcomeBig.offsetWidth;
    }

    // Carga versiculo en WOW fullscreen
    loadWowVerse();

    // Audio
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

    if(btnWowFullscreen){
      btnWowFullscreen.textContent = "⛶";
      btnWowFullscreen.setAttribute("aria-label", "Entrar a pantalla completa");
    }

    // Oculta versiculo al salir (opcional)
    if(verseLine) verseLine.hidden = true;
    if(verseRef) verseRef.hidden = true;

    try{
      fadeTo(0.0, 300);
      setTimeout(()=>{
        try{ wowAudio.pause(); wowAudio.currentTime = 0; }catch(e){}
      }, 320);
    }catch(e){}

    openTab(wasTabBeforeWow || "register", true);
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
    let found = false;
    snap.forEach(doc=>{
      const d = doc.data() || {};
      addOpt(doc.id, d.name || doc.id);
      if(doc.id === churchId) found = true;
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
    const o = document.createElement("option");
    o.value = id;
    o.textContent = label;
    churchSelect.appendChild(o);
  }
}

/* =========================
   Watch church doc
========================= */
function watchChurch(){
  if(unsubChurch) unsubChurch();

  unsubChurch = db.collection("churches").doc(churchId).onSnapshot(doc=>{
    const d = doc.data() || {};

    churchName = clean(d.name) || doc.id;
    activeEventId = d.activeEventId || null;

    // WOW seconds
    const sec = clamp(parseInt(d.wowSeconds || 6, 10) || 6, 1, 30);
    WOW_MS = sec * 1000;
    if(wowSeconds) wowSeconds.value = String(sec);

    // PIN hash
    churchPinHash = clean(d.pinHash) || "";
    if(pinSub) pinSub.textContent = "PIN requerido - " + churchName;

    // Verses JSON settings
    const wv = d.wowVerse || {};
    WOW_VERSE.path = clean(wv.path || "");
    WOW_VERSE.ref  = clean(wv.ref || "");

    if(wowVersePath) wowVersePath.value = WOW_VERSE.path;
    if(wowVerseRef)  wowVerseRef.value  = WOW_VERSE.ref;

    enforcePin();
    renderSession();
    mountCheckins();
    mountHistory();
  }, console.error);
}

/* =========================
   Actions
========================= */
function bindActions(){
  if(btnSaveWow){
    btnSaveWow.addEventListener("click", async ()=>{
      const sec = clamp(parseInt(wowSeconds.value,10) || 6, 1, 30);
      await db.collection("churches").doc(churchId).set({ wowSeconds: sec }, { merge:true });
      if(wowSavedMsg) wowSavedMsg.textContent = "WOW guardado: " + sec + "s";
    });
  }

  if(btnCreateChurch){
    btnCreateChurch.addEventListener("click", async ()=>{
      const name = clean(newChurchName ? newChurchName.value : "");
      if(!name){
        if(createChurchMsg) createChurchMsg.textContent = "Escribe el nombre de la iglesia.";
        return;
      }

      btnCreateChurch.disabled = true;
      btnCreateChurch.textContent = "Creando...";

      try{
        let id = slugify(name) || ("iglesia_" + rand4());
        const exists = await db.collection("churches").doc(id).get();
        if(exists.exists) id = id + "_" + rand4();

        await db.collection("churches").doc(id).set({
          name,
          wowSeconds: 6,
          activeEventId: null,
          pinHash: "",
          wowVerse: { mode:"path", path:"", ref:"" },
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge:true });

        if(createChurchMsg) createChurchMsg.textContent = "Creada: " + name + " (ID: " + id + ")";
        replaceParam("church", id);
        location.reload();
      }catch(e){
        console.error(e);
        if(createChurchMsg) createChurchMsg.textContent = "Error creando iglesia. Revisa reglas.";
      }finally{
        btnCreateChurch.disabled = false;
        btnCreateChurch.textContent = "+ Nueva";
        if(newChurchName) newChurchName.value = "";
      }
    });
  }

  if(btnOpenSession) btnOpenSession.addEventListener("click", openSession);
  if(btnCloseSession) btnCloseSession.addEventListener("click", closeSession);

  if(formCheckin) formCheckin.addEventListener("submit", submitCheckin);

  // Guardar versiculo (si existe UI)
  if(btnSaveWowVerse){
    btnSaveWowVerse.addEventListener("click", async ()=>{
      if(!wowVerseMsg) return;

      const path = clean(wowVersePath ? wowVersePath.value : "");
      const ref  = clean(wowVerseRef ? wowVerseRef.value : "");

      if(!path || !path.endsWith(".json")){
        wowVerseMsg.textContent = "Ruta invalida. Usa un .json (ej: assets/verses/juan/3/16.json)";
        return;
      }

      await db.collection("churches").doc(churchId).set({
        wowVerse: { mode:"path", path, ref }
      }, { merge:true });

      WOW_VERSE.path = path;
      WOW_VERSE.ref = ref;

      wowVerseMsg.textContent = "Versiculo guardado ✅";
      // Si estas en WOW fullscreen, refresca
      if(isWowFullscreen) loadWowVerse();
    });
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
    if(sessionMeta) sessionMeta.textContent = "Evento activo: " + activeEventId;
    if(checkinStatus) checkinStatus.textContent = "Sesion abierta.";
  } else {
    sessionPill.textContent = "CERRADA";
    sessionPill.className = "pill bad";
    if(btnCloseSession) btnCloseSession.disabled = true;
    if(sessionMeta) sessionMeta.textContent = "No hay sesion abierta.";
    if(checkinStatus) checkinStatus.textContent = "Abre una sesion en Configuracion para registrar.";
    if(kpiTotal) kpiTotal.textContent = "0";
    if(tickerTrack) tickerTrack.innerHTML = "";
    if(welcomeBig) welcomeBig.textContent = "Bienvenidos";
  }
}

async function openSession(){
  const title = clean(sessionTitle ? sessionTitle.value : "") || ("Servicio " + new Date().toLocaleDateString());
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
   Submit checkin
========================= */
async function submitCheckin(e){
  e.preventDefault();

  if(!activeEventId){
    if(errCheckin){
      errCheckin.hidden = false;
      errCheckin.textContent = "Sesion cerrada. Abre sesion en Configuracion.";
    }
    return;
  }

  const f = clean(firstName ? firstName.value : "");
  const l = clean(lastName ? lastName.value : "");
  const t = clean(town ? town.value : "");
  const qty = Math.max(1, parseInt(partySize ? partySize.value : "1",10) || 1);

  if(!f || !l){
    if(errCheckin){
      errCheckin.hidden = false;
      errCheckin.textContent = "Falta nombre y/o apellido.";
    }
    return;
  }
  if(errCheckin) errCheckin.hidden = true;

  const full = (f + " " + l).trim();

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
  if(firstName) firstName.focus();

  if(checkinStatus) checkinStatus.textContent = "Registrado ✅";
}

/* =========================
   Realtime checkins (KPI + ticker + WOW pop)
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
      let total = 0;
      const names = [];

      const newestDoc = snap.docs[0] || null;
      const newestId  = newestDoc ? newestDoc.id : null;
      const newest    = newestDoc ? (newestDoc.data() || {}) : null;

      snap.forEach(doc=>{
        const d = doc.data() || {};
        total += Number(d.partySize || 1);
        if(d.fullName) names.push(d.fullName);
      });

      if(kpiTotal) kpiTotal.textContent = String(total);

      if(tickerTrack){
        const doubled = names.concat(names);
        tickerTrack.innerHTML = doubled.map(n=>(
          '<span class="tickerItem">' + escapeHtml(n) + "</span>"
        )).join("");
      }

      if(newestId && newest && newest.fullName){
        if(firstLoad){
          firstLoad = false;
          lastWelcomeId = newestId;
          if(welcomeBig) welcomeBig.textContent = "Bienvenidos";
        } else if(newestId !== lastWelcomeId){
          lastWelcomeId = newestId;
          popWelcome(newest.fullName);
        }
      }
    }, console.error);
}

function popWelcome(fullName){
  if(welcomeTimer) clearTimeout(welcomeTimer);

  const churchText = churchName ? (" a la Iglesia " + churchName) : "";
  const msg = "Bienvenidos " + fullName + churchText;

  if(welcomeBig){
    welcomeBig.textContent = msg;
    welcomeBig.classList.remove("pop");
    void welcomeBig.offsetWidth;
    welcomeBig.classList.add("pop");
  }

  // Si estas en fullscreen, refresca versiculo tambien
  if(isWowFullscreen) loadWowVerse();

  welcomeTimer = setTimeout(()=>{
    if(welcomeBig){
      welcomeBig.classList.remove("pop");
      welcomeBig.textContent = "Bienvenidos";
    }
  }, WOW_MS);
}

/* =========================
   Verses JSON loader
   - WOW_VERSE.path = "assets/verses/juan/3/16.json"
   - JSON: { "ref":"Juan 3:16", "text":"..." }
========================= */
async function loadWowVerse(){
  try{
    if(!verseLine || !verseRef) return;

    const path = WOW_VERSE.path;
    if(!path){
      verseLine.hidden = true;
      verseRef.hidden = true;
      return;
    }

    const res = await fetch(path, { cache:"no-store" });
    if(!res.ok) throw new Error("Verse JSON not found: " + path);

    const j = await res.json();
    const txt = clean(j.text || "");
    const ref = clean(j.ref || WOW_VERSE.ref || "");

    if(!txt){
      verseLine.hidden = true;
      verseRef.hidden = true;
      return;
    }

    verseLine.textContent = txt;
    verseRef.textContent = ref || "—";
    verseLine.hidden = false;
    verseRef.hidden = false;

  }catch(e){
    console.warn("loadWowVerse:", e);
    if(verseLine) verseLine.hidden = true;
    if(verseRef) verseRef.hidden = true;
  }
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
        historyList.innerHTML = '<div class="hint">No hay sesiones todavia.</div>';
        return;
      }

      snap.forEach(doc=>{
        const e = doc.data() || {};
        const id = doc.id;

        const title = e.title || "Sesion";
        const date  = e.date || "";
        const status= e.status || "-";

        const box = document.createElement("div");
        box.className = "hItem";
        box.innerHTML =
          '<div class="hTop">' +
            '<div>' +
              '<div class="hTitle">' + escapeHtml(title) + '</div>' +
              '<div class="hMeta">' + escapeHtml(date) + " · " + escapeHtml(status) + " · ID: " + escapeHtml(id) + "</div>" +
            "</div>" +
            '<div class="hBtns"><button class="ghost" data-pdf="' + escapeHtml(id) + '">PDF</button></div>' +
          "</div>";

        historyList.appendChild(box);
      });

      historyList.querySelectorAll("button[data-pdf]").forEach(btn=>{
        btn.addEventListener("click", ()=> exportEventPDF(btn.getAttribute("data-pdf")));
      });
    }, console.error);
}

async function exportEventPDF(eventId){
  if(!jsPDF){
    alert("jsPDF no cargo.");
    return;
  }

  const evRef = db.collection("churches").doc(churchId).collection("events").doc(eventId);
  const evSnap = await evRef.get();
  const ev = evSnap.data() || {};
  const title = ev.title || "Sesion";
  const date = ev.date || "";

  const qSnap = await evRef.collection("checkins").orderBy("createdAt","asc").get();

  const rows = [];
  let total = 0;

  qSnap.forEach((doc)=>{
    const d = doc.data() || {};
    const qty = Number(d.partySize || 1);
    total += qty;

    rows.push({
      n: rows.length + 1,
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
  pdf.text("Nexus Churchs - Historial de Asistencia", 40, y); y += 22;

  pdf.setFont("helvetica","normal");
  pdf.setFontSize(12);
  pdf.text("Iglesia: " + (churchName || churchId), 40, y); y += 16;
  pdf.text("Sesion: " + title, 40, y); y += 16;
  pdf.text("Fecha: " + date, 40, y); y += 16;
  pdf.text("Total asistencia: " + String(total), 40, y); y += 22;

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
    pdf.text(String(r.time), 70, y);
    pdf.text(trunc(r.name, 34), 130, y);
    pdf.text(trunc(r.town, 20), 360, y);
    pdf.text(String(r.qty), 540, y);
    y += 16;
  }

  pdf.save("NexusChurchs_" + safeFile(title) + "_" + (date || "reporte") + ".pdf");
}

/* =========================
   PIN Security (por iglesia)
========================= */
function UNLOCK_KEY(id){ return "nc.unlocked." + id + ".v1"; }
function isUnlocked(){ return sessionStorage.getItem(UNLOCK_KEY(churchId)) === "1"; }
function setUnlocked(v){ sessionStorage.setItem(UNLOCK_KEY(churchId), v ? "1" : "0"); }

function hardShowOverlay(){
  if(!pinOverlay) return;
  pinOverlay.hidden = false;
  pinOverlay.style.display = "flex";
  pinOverlay.style.opacity = "1";
  pinOverlay.style.pointerEvents = "auto";
}
function hardHideOverlay(){
  if(!pinOverlay) return;
  pinOverlay.hidden = true;
  pinOverlay.style.display = "none";
  pinOverlay.style.opacity = "0";
  pinOverlay.style.pointerEvents = "none";
}
function showPinError(msg){
  if(!pinError) return;
  pinError.hidden = false;
  pinError.textContent = msg;
}
function clearPinError(){
  if(!pinError) return;
  pinError.hidden = true;
  pinError.textContent = "";
}

function lockApp(){
  setUnlocked(false);
  document.body.classList.add("locked");
  hardShowOverlay();
  clearPinError();
  if(pinInput){
    pinInput.value = "";
    setTimeout(()=> pinInput.focus(), 120);
  }
  try{ if(isWowFullscreen) toggleWowFullscreen(false); }catch(e){}
}

function unlockApp(){
  setUnlocked(true);
  document.body.classList.remove("locked");
  hardHideOverlay();
  clearPinError();
}

function enforcePin(){
  if(isUnlocked()) unlockApp();
  else lockApp();
}

async function sha256Hex(text){
  const enc = new TextEncoder().encode(String(text || ""));
  const buf = await crypto.subtle.digest("SHA-256", enc);
  const arr = Array.from(new Uint8Array(buf));
  return arr.map(b=> b.toString(16).padStart(2,"0")).join("");
}

async function tryUnlockPin(){
  const entered = clean(pinInput ? pinInput.value : "");
  if(!/^\d{4,6}$/.test(entered)){
    showPinError("PIN invalido. Usa 4-6 digitos.");
    return;
  }

  // No hay pinHash -> default 1234
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
  }catch(e){
    console.error(e);
    showPinError("Error validando PIN.");
  }
}

function bindPinActions(){
  if(btnLock){
    btnLock.addEventListener("click", (e)=>{
      e.preventDefault();
      lockApp();
    });
  }

  if(btnPinUnlock){
    btnPinUnlock.addEventListener("click", (e)=>{
      e.preventDefault();
      tryUnlockPin();
    });
  }

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
      if(pinSavedMsg) pinSavedMsg.textContent = "";

      const cur = clean(pinCurrent ? pinCurrent.value : "");
      const neu = clean(pinNew ? pinNew.value : "");

      if(!/^\d{4,6}$/.test(cur)){
        if(pinSavedMsg) pinSavedMsg.textContent = "PIN actual invalido.";
        return;
      }
      if(!/^\d{4,6}$/.test(neu)){
        if(pinSavedMsg) pinSavedMsg.textContent = "Nuevo PIN invalido (4-6 digitos).";
        return;
      }

      try{
        // Si pinHash no existe, pin actual valido es default 1234
        if(!churchPinHash && cur !== DEFAULT_PIN){
          if(pinSavedMsg) pinSavedMsg.textContent = "PIN actual incorrecto (default 1234).";
          return;
        }

        // Si existe pinHash, validar contra hash
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
        if(pinSavedMsg) pinSavedMsg.textContent = "PIN actualizado (solo esta iglesia).";
        if(pinCurrent) pinCurrent.value = "";
        if(pinNew) pinNew.value = "";

      }catch(err){
        console.error(err);
        if(pinSavedMsg) pinSavedMsg.textContent = "No se pudo guardar el PIN.";
      }
    });
  }
}
