"use strict";

/* =========================
   NEXUS CHURCHS - app.js
   (ASCII limpio, sin chars raros)
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
  var u = new URL(location.href);
  u.searchParams.set(key, value);
  history.replaceState({}, "", u.toString());
}

/* ---------- URL params ---------- */
var params = new URLSearchParams(location.search);
var churchId = clean(params.get("church") || "demo");

/* ---------- Tabs (botones) ---------- */
var tabBtns = document.querySelectorAll(".tabBtn");
var tabPanels = document.querySelectorAll(".tab");
var lastTabKey = "register";

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
  var map = { register:"registro", wow:"wow", config:"config", history:"historial" };
  return map[key] || "registro";
}
function openTab(key, syncHash){
  if (syncHash === undefined) syncHash = true;
  key = normalizeTabKey(key);
  lastTabKey = key;

  for (var i=0;i<tabBtns.length;i++){
    var b = tabBtns[i];
    var on = (b.dataset.tab === key);
    b.classList.toggle("active", on);
    b.setAttribute("aria-selected", on ? "true" : "false");
  }
  for (var j=0;j<tabPanels.length;j++){
    var p = tabPanels[j];
    var on2 = (p.dataset.tabpanel === key);
    p.classList.toggle("active", on2);
  }

  if (syncHash){
    var h = keyToHash(key);
    if (location.hash !== "#" + h){
      history.replaceState({}, "", location.pathname + location.search + "#" + h);
    }
  }
}
for (var t=0;t<tabBtns.length;t++){
  tabBtns[t].addEventListener("click", function(){
    openTab(this.dataset.tab, true);
  });
}
window.addEventListener("hashchange", function(){
  openTab(location.hash, false);
});

/* ---------- DOM ---------- */
var churchSelect = $("churchSelect");
var kpiTotal = $("kpiTotal");

var formCheckin = $("formCheckin");
var firstName = $("firstName");
var lastName = $("lastName");
var town = $("town");
var partySize = $("partySize");
var errCheckin = $("errCheckin");
var checkinStatus = $("checkinStatus");

var btnWowFullscreen = $("btnWowFullscreen");
var welcomeBig = $("welcomeBig");
var tickerTrack = $("tickerTrack");
var wowAudio = $("wowAudio");

var wowSeconds = $("wowSeconds");
var btnSaveWow = $("btnSaveWow");
var wowSavedMsg = $("wowSavedMsg");

var newChurchName = $("newChurchName");
var btnCreateChurch = $("btnCreateChurch");
var createChurchMsg = $("createChurchMsg");

var sessionPill = $("sessionPill");
var btnOpenSession = $("btnOpenSession");
var btnCloseSession = $("btnCloseSession");
var sessionTitle = $("sessionTitle");
var sessionMeta = $("sessionMeta");

var historyList = $("historyList");

/* PIN */
var btnLock = $("btnLock");
var pinOverlay = $("pinOverlay");
var pinInput = $("pinInput");
var btnPinUnlock = $("btnPinUnlock");
var pinError = $("pinError");
var pinSub = $("pinSub");

var pinCurrent = $("pinCurrent");
var pinNew = $("pinNew");
var btnSavePin = $("btnSavePin");
var pinSavedMsg = $("pinSavedMsg");

/* ---------- State ---------- */
var churchName = "";
var activeEventId = null;
var WOW_MS = 6000;
var churchPinHash = "";

var unsubChurch = null;
var unsubCheckins = null;
var unsubHistory = null;

var firstLoad = true;
var lastWelcomeId = null;
var welcomeTimer = null;

/* WOW fullscreen + audio fade */
var isWowFullscreen = false;
var wasTabBeforeWow = "register";
var fadeTimer = null;
var WOW_VOL_TARGET = 0.35;
var FADE_MS = 1000;

/* PIN */
var DEFAULT_PIN = "1234";
function UNLOCK_KEY(id){ return "nc.unlocked." + id + ".v1"; }

/* =========================
   INIT
========================= */
init().catch(function(e){ console.error(e); });

async function init(){
  openTab(location.hash || "register", true);

  if (btnWowFullscreen) btnWowFullscreen.addEventListener("click", function(){ toggleWowFullscreen(); });

  document.addEventListener("keydown", function(e){
    if (e.key === "Escape" && isWowFullscreen) toggleWowFullscreen(false);
  });

  await loadChurches();
  bindActions();
  bindPinActions();
  watchChurch();

  if (firstName) firstName.focus();
}

/* =========================
   WOW audio fade
========================= */
function stopFade(){
  if (fadeTimer){
    clearInterval(fadeTimer);
    fadeTimer = null;
  }
}
function fadeTo(target, ms){
  stopFade();
  if (!wowAudio) return;

  var startVol = Number(wowAudio.volume || 0);
  var endVol = clamp(Number(target), 0, 1);

  var steps = 20;
  var stepMs = Math.max(10, Math.floor(ms / steps));
  var i = 0;

  fadeTimer = setInterval(function(){
    i++;
    var t = i / steps;
    var v = startVol + (endVol - startVol) * t;
    wowAudio.volume = clamp(v, 0, 1);

    if (i >= steps){
      stopFade();
      wowAudio.volume = endVol;
    }
  }, stepMs);
}

/* =========================
   WOW fullscreen toggle
========================= */
function toggleWowFullscreen(force){
  var next = (typeof force === "boolean") ? force : !isWowFullscreen;

  if (next){
    wasTabBeforeWow = lastTabKey || "register";
    openTab("wow", true);

    document.body.classList.add("wow-fullscreen");
    isWowFullscreen = true;

    if (btnWowFullscreen) btnWowFullscreen.textContent = "X";

    try{
      if (wowAudio){
        wowAudio.currentTime = 0;
        wowAudio.volume = 0.0;
        var p = wowAudio.play();
        if (p && typeof p.catch === "function") p.catch(function(){});
        fadeTo(WOW_VOL_TARGET, FADE_MS);
      }
    }catch(e){ console.warn(e); }

  } else {
    document.body.classList.remove("wow-fullscreen");
    isWowFullscreen = false;

    if (btnWowFullscreen) btnWowFullscreen.textContent = "\u26F6"; // fullscreen icon fallback

    try{
      if (wowAudio){
        fadeTo(0.0, 300);
        setTimeout(function(){
          try{ wowAudio.pause(); wowAudio.currentTime = 0; }catch(e){}
        }, 320);
      }
    }catch(e){}

    openTab(wasTabBeforeWow || "register", true);
  }
}

/* =========================
   Churches list
========================= */
async function loadChurches(){
  if (!churchSelect) return;

  churchSelect.innerHTML = "";
  var snap = await db.collection("churches").orderBy("name").get();

  if (snap.empty){
    addOpt("demo","demo");
    churchSelect.value = churchId;
  } else {
    var found = false;
    snap.forEach(function(doc){
      var d = doc.data() || {};
      addOpt(doc.id, d.name || doc.id);
      if (doc.id === churchId) found = true;
    });
    if (!found){
      churchId = churchSelect.options[0].value;
      replaceParam("church", churchId);
    }
    churchSelect.value = churchId;
  }

  churchSelect.addEventListener("change", function(){
    churchId = churchSelect.value;
    replaceParam("church", churchId);
    location.reload();
  });

  function addOpt(id, label){
    var o = document.createElement("option");
    o.value = id;
    o.textContent = label;
    churchSelect.appendChild(o);
  }
}

/* =========================
   Watch church doc (name, wow, pin, activeEventId)
========================= */
function watchChurch(){
  if (unsubChurch) unsubChurch();

  unsubChurch = db.collection("churches").doc(churchId).onSnapshot(function(doc){
    var d = doc.data() || {};

    churchName = clean(d.name) || doc.id;
    churchPinHash = clean(d.pinHash) || "";
    activeEventId = d.activeEventId || null;

    var sec = clamp(parseInt(d.wowSeconds || 6, 10) || 6, 1, 30);
    WOW_MS = sec * 1000;
    if (wowSeconds) wowSeconds.value = String(sec);

    if (pinSub) pinSub.textContent = "PIN requerido - " + churchName;

    enforcePin();

    renderSession();
    mountCheckins();
    mountHistory();
  }, function(err){
    console.error(err);
  });
}

/* =========================
   Session UI
========================= */
function renderSession(){
  if (!sessionPill) return;

  if (activeEventId){
    sessionPill.textContent = "ABIERTA";
    sessionPill.className = "pill ok";
    if (btnCloseSession) btnCloseSession.disabled = false;
    if (sessionMeta) sessionMeta.textContent = "Evento activo: " + activeEventId;
    if (checkinStatus) checkinStatus.textContent = "Sesion abierta.";
  } else {
    sessionPill.textContent = "CERRADA";
    sessionPill.className = "pill bad";
    if (btnCloseSession) btnCloseSession.disabled = true;
    if (sessionMeta) sessionMeta.textContent = "No hay sesion abierta.";
    if (checkinStatus) checkinStatus.textContent = "Abre una sesion en Configuracion para registrar.";
    if (kpiTotal) kpiTotal.textContent = "0";
    if (tickerTrack) tickerTrack.innerHTML = "";
    if (welcomeBig) welcomeBig.textContent = "Bienvenidos";
  }
}

/* =========================
   Actions
========================= */
function bindActions(){
  if (btnSaveWow){
    btnSaveWow.addEventListener("click", async function(){
      var sec = clamp(parseInt(wowSeconds.value,10) || 6, 1, 30);
      await db.collection("churches").doc(churchId).set({ wowSeconds: sec }, { merge:true });
      if (wowSavedMsg) wowSavedMsg.textContent = "WOW guardado: " + sec + "s";
    });
  }

  if (btnCreateChurch){
    btnCreateChurch.addEventListener("click", async function(){
      var name = clean(newChurchName ? newChurchName.value : "");
      if (!name){
        if (createChurchMsg) createChurchMsg.textContent = "Escribe el nombre de la iglesia.";
        return;
      }

      btnCreateChurch.disabled = true;
      btnCreateChurch.textContent = "Creando...";

      try{
        var id = slugify(name) || ("iglesia_" + rand4());
        var exists = await db.collection("churches").doc(id).get();
        if (exists.exists) id = id + "_" + rand4();

        await db.collection("churches").doc(id).set({
          name: name,
          wowSeconds: 6,
          activeEventId: null,
          pinHash: "",
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge:true });

        if (createChurchMsg) createChurchMsg.textContent = "Creada: " + name + " (ID: " + id + ")";
        replaceParam("church", id);
        location.reload();

      }catch(e){
        console.error(e);
        if (createChurchMsg) createChurchMsg.textContent = "Error creando iglesia. Revisa reglas.";
      }finally{
        btnCreateChurch.disabled = false;
        btnCreateChurch.textContent = "+ Nueva";
        if (newChurchName) newChurchName.value = "";
      }
    });
  }

  if (btnOpenSession){
    btnOpenSession.addEventListener("click", openSession);
  }
  if (btnCloseSession){
    btnCloseSession.addEventListener("click", closeSession);
  }

  if (formCheckin){
    formCheckin.addEventListener("submit", submitCheckin);
  }
}

async function openSession(){
  var title = clean(sessionTitle ? sessionTitle.value : "") || ("Servicio " + new Date().toLocaleDateString());
  var date = new Date().toISOString().slice(0,10);

  var evRef = db.collection("churches").doc(churchId).collection("events").doc();
  await evRef.set({
    title: title,
    date: date,
    status: "open",
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });

  await db.collection("churches").doc(churchId).set({ activeEventId: evRef.id }, { merge:true });
  if (sessionTitle) sessionTitle.value = "";
}

async function closeSession(){
  if (!activeEventId) return;

  var evRef = db.collection("churches").doc(churchId).collection("events").doc(activeEventId);
  await evRef.set({
    status: "closed",
    closedAt: firebase.firestore.FieldValue.serverTimestamp()
  }, { merge:true });

  await db.collection("churches").doc(churchId).set({ activeEventId: null }, { merge:true });
}

async function submitCheckin(e){
  e.preventDefault();

  if (!activeEventId){
    if (errCheckin){
      errCheckin.hidden = false;
      errCheckin.textContent = "Sesion cerrada. Abre sesion en Configuracion.";
    }
    return;
  }

  var f = clean(firstName ? firstName.value : "");
  var l = clean(lastName ? lastName.value : "");
  var t = clean(town ? town.value : "");
  var qty = Math.max(1, parseInt(partySize ? partySize.value : "1",10) || 1);

  if (!f || !l){
    if (errCheckin){
      errCheckin.hidden = false;
      errCheckin.textContent = "Falta nombre y/o apellido.";
    }
    return;
  }
  if (errCheckin) errCheckin.hidden = true;

  var full = (f + " " + l).trim();

  await db.collection("churches").doc(churchId)
    .collection("events").doc(activeEventId)
    .collection("checkins")
    .add({
      firstName: f,
      lastName: l,
      fullName: full,
      town: t || "",
      partySize: qty,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

  if (firstName) firstName.value = "";
  if (lastName) lastName.value = "";
  if (town) town.value = "";
  if (partySize) partySize.value = "1";
  if (firstName) firstName.focus();

  if (checkinStatus) checkinStatus.textContent = "Registrado.";
}

/* =========================
   Realtime checkins (KPI + ticker + WOW)
========================= */
function mountCheckins(){
  if (unsubCheckins) unsubCheckins();
  firstLoad = true;
  lastWelcomeId = null;

  if (!activeEventId) return;

  unsubCheckins = db.collection("churches").doc(churchId)
    .collection("events").doc(activeEventId)
    .collection("checkins")
    .orderBy("createdAt","desc")
    .limit(40)
    .onSnapshot(function(snap){
      var total = 0;
      var names = [];

      var newestDoc = snap.docs[0] || null;
      var newestId = newestDoc ? newestDoc.id : null;
      var newest = newestDoc ? (newestDoc.data() || {}) : null;

      snap.forEach(function(doc){
        var d = doc.data() || {};
        total += Number(d.partySize || 1);
        if (d.fullName) names.push(d.fullName);
      });

      if (kpiTotal) kpiTotal.textContent = String(total);

      if (tickerTrack){
        var doubled = names.concat(names);
        tickerTrack.innerHTML = doubled.map(function(n){
          return '<span class="tickerItem">' + escapeHtml(n) + "</span>";
        }).join("");
      }

      if (newestId && newest && newest.fullName){
        if (firstLoad){
          firstLoad = false;
          lastWelcomeId = newestId;
          if (welcomeBig) welcomeBig.textContent = "Bienvenidos";
        } else if (newestId !== lastWelcomeId){
          lastWelcomeId = newestId;
          popWelcome(newest.fullName);
        }
      }

    }, function(err){
      console.error(err);
    });
}

function popWelcome(fullName){
  if (welcomeTimer) clearTimeout(welcomeTimer);

  var churchText = churchName ? (" a la Iglesia " + churchName) : "";
  var msg = "Bienvenidos " + fullName + churchText;

  if (welcomeBig){
    welcomeBig.textContent = msg;
    welcomeBig.classList.remove("pop");
    void welcomeBig.offsetWidth;
    welcomeBig.classList.add("pop");
  }

  welcomeTimer = setTimeout(function(){
    if (welcomeBig){
      welcomeBig.classList.remove("pop");
      welcomeBig.textContent = "Bienvenidos";
    }
  }, WOW_MS);
}

/* =========================
   History + PDF
========================= */
function mountHistory(){
  if (unsubHistory) unsubHistory();
  if (!historyList) return;

  unsubHistory = db.collection("churches").doc(churchId)
    .collection("events")
    .orderBy("createdAt","desc")
    .limit(20)
    .onSnapshot(function(snap){
      historyList.innerHTML = "";

      if (snap.empty){
        historyList.innerHTML = '<div class="hint">No hay sesiones todavia.</div>';
        return;
      }

      snap.forEach(function(doc){
        var e = doc.data() || {};
        var id = doc.id;

        var title = e.title || "Sesion";
        var date = e.date || "";
        var status = e.status || "-";

        var box = document.createElement("div");
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

      var btns = historyList.querySelectorAll("button[data-pdf]");
      for (var i=0;i<btns.length;i++){
        btns[i].addEventListener("click", function(){
          exportEventPDF(this.getAttribute("data-pdf"));
        });
      }
    }, function(err){
      console.error(err);
    });
}

async function exportEventPDF(eventId){
  if (!jsPDF){
    alert("jsPDF no cargo.");
    return;
  }

  var evRef = db.collection("churches").doc(churchId).collection("events").doc(eventId);
  var evSnap = await evRef.get();
  var ev = evSnap.data() || {};
  var title = ev.title || "Sesion";
  var date = ev.date || "";

  var qSnap = await evRef.collection("checkins").orderBy("createdAt","asc").get();

  var rows = [];
  var total = 0;

  qSnap.forEach(function(doc, idx){
    var d = doc.data() || {};
    var qty = Number(d.partySize || 1);
    total += qty;

    rows.push({
      n: rows.length + 1,
      time: d.createdAt ? d.createdAt.toDate().toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"}) : "",
      name: d.fullName || "",
      town: d.town || "",
      qty: qty
    });
  });

  var pdf = new jsPDF({ unit:"pt", format:"letter" });
  var y = 50;

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

  for (var i=0;i<rows.length;i++){
    var r = rows[i];
    if (y > 740){ pdf.addPage(); y = 60; }
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
   - Default 1234 si pinHash vacio
   - Overlay show/hide FORZADO
========================= */
function isUnlocked(){
  return sessionStorage.getItem(UNLOCK_KEY(churchId)) === "1";
}
function setUnlocked(v){
  sessionStorage.setItem(UNLOCK_KEY(churchId), v ? "1" : "0");
}
function hardShowOverlay(){
  if (!pinOverlay) return;
  pinOverlay.hidden = false;
  pinOverlay.style.display = "flex";
  pinOverlay.style.opacity = "1";
  pinOverlay.style.pointerEvents = "auto";
}
function hardHideOverlay(){
  if (!pinOverlay) return;
  pinOverlay.hidden = true;
  pinOverlay.style.display = "none";
  pinOverlay.style.opacity = "0";
  pinOverlay.style.pointerEvents = "none";
}
function showPinError(msg){
  if (!pinError) return;
  pinError.hidden = false;
  pinError.textContent = msg;
}
function clearPinError(){
  if (!pinError) return;
  pinError.hidden = true;
  pinError.textContent = "";
}

function lockApp(){
  setUnlocked(false);
  document.body.classList.add("locked");
  hardShowOverlay();
  clearPinError();
  if (pinInput){
    pinInput.value = "";
    setTimeout(function(){ pinInput.focus(); }, 120);
  }
  try{ if (isWowFullscreen) toggleWowFullscreen(false); }catch(e){}
}

function unlockApp(){
  setUnlocked(true);
  document.body.classList.remove("locked");
  hardHideOverlay();
  clearPinError();
  console.log("PIN OK - unlocked");
}

function enforcePin(){
  if (isUnlocked()) unlockApp();
  else lockApp();
}

async function sha256Hex(text){
  var enc = new TextEncoder().encode(String(text || ""));
  var buf = await crypto.subtle.digest("SHA-256", enc);
  var arr = Array.from(new Uint8Array(buf));
  return arr.map(function(b){ return b.toString(16).padStart(2,"0"); }).join("");
}

async function tryUnlockPin(){
  var entered = clean(pinInput ? pinInput.value : "");
  if (!/^\d{4,6}$/.test(entered)){
    showPinError("PIN invalido. Usa 4-6 digitos.");
    return;
  }

  /* No hay pinHash -> default 1234 */
  if (!churchPinHash){
    if (entered === DEFAULT_PIN){
      unlockApp();
      return;
    }
    showPinError("PIN incorrecto. Default: 1234.");
    return;
  }

  try{
    var enteredHash = await sha256Hex(entered);
    if (enteredHash === churchPinHash){
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
  if (btnLock){
    btnLock.addEventListener("click", function(e){
      e.preventDefault();
      lockApp();
    });
  }

  if (btnPinUnlock){
    btnPinUnlock.addEventListener("click", function(e){
      e.preventDefault();
      tryUnlockPin();
    });
  }

  if (pinInput){
    pinInput.addEventListener("keydown", function(e){
      if (e.key === "Enter"){
        e.preventDefault();
        tryUnlockPin();
      }
    });
  }

  if (btnSavePin){
    btnSavePin.addEventListener("click", async function(e){
      e.preventDefault();
      if (pinSavedMsg) pinSavedMsg.textContent = "";

      var cur = clean(pinCurrent ? pinCurrent.value : "");
      var neu = clean(pinNew ? pinNew.value : "");

      if (!/^\d{4,6}$/.test(cur)){
        if (pinSavedMsg) pinSavedMsg.textContent = "PIN actual invalido.";
        return;
      }
      if (!/^\d{4,6}$/.test(neu)){
        if (pinSavedMsg) pinSavedMsg.textContent = "Nuevo PIN invalido (4-6 digitos).";
        return;
      }

      try{
        /* Si pinHash no existe, el pin actual valido es default 1234 */
        if (!churchPinHash && cur !== DEFAULT_PIN){
          if (pinSavedMsg) pinSavedMsg.textContent = "PIN actual incorrecto (default 1234).";
          return;
        }

        /* Si existe pinHash, validar contra hash */
        if (churchPinHash){
          var curHash = await sha256Hex(cur);
          if (curHash !== churchPinHash){
            if (pinSavedMsg) pinSavedMsg.textContent = "PIN actual incorrecto.";
            return;
          }
        }

        var neuHash = await sha256Hex(neu);

        await db.collection("churches").doc(churchId).set({
          pinHash: neuHash,
          pinUpdatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge:true });

        churchPinHash = neuHash;
        if (pinSavedMsg) pinSavedMsg.textContent = "PIN actualizado (solo esta iglesia).";
        if (pinCurrent) pinCurrent.value = "";
        if (pinNew) pinNew.value = "";

      }catch(err){
        console.error(err);
        if (pinSavedMsg) pinSavedMsg.textContent = "No se pudo guardar el PIN.";
      }
    });
  }
}

/* =========================
   END
========================= */
