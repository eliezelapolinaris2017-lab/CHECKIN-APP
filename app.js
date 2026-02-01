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

/******** Tabs (1 visible, resto oculto) ********/
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

tabBtns.forEach(btn=>{
  btn.addEventListener("click", ()=> openTab(btn.dataset.tab));
});

openTab("register");

/******** DOM ********/
const churchSelect = document.getElementById("churchSelect");
const kpiTotal = document.getElementById("kpiTotal");

const formCheckin = document.getElementById("formCheckin");
const firstName = document.getElementById("firstName");
const lastName  = document.getElementById("lastName");
const town      = document.getElementById("town");
const partySize = document.getElementById("partySize");
const errCheckin = document.getElementById("errCheckin");
const checkinStatus = document.getElementById("checkinStatus");

const wowStage = document.getElementById("wowStage");
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

/******** State ********/
let activeEventId = null;
let WOW_MS = 6000;

let unsubChurch = null;
let unsubCheckins = null;
let unsubHistory = null;

let firstLoad = true;
let lastWelcomeId = null;
let welcomeTimer = null;

/******** WOW Fullscreen state ********/
let wasTabBeforeWow = "register";
let isWowFullscreen = false;

/******** INIT ********/
init().catch(console.error);

async function init(){
  // ✅ WOW Full Screen: limpia TODO (solo queda WOW + botón para salir)
  btnWowFullscreen.onclick = toggleWowFullscreen;

  // Esc sale del modo WOW fullscreen (extra cómodo)
  document.addEventListener("keydown", (e)=>{
    if(e.key === "Escape" && isWowFullscreen){
      toggleWowFullscreen(false);
    }
  });

  await loadChurches();
  bindActions();
  watchChurch();

  firstName?.focus();
}

/******** WOW fullscreen toggle ********/
function toggleWowFullscreen(force){
  const next = (typeof force === "boolean") ? force : !isWowFullscreen;

  if(next){
    // guardar tab previo y forzar WOW
    wasTabBeforeWow = lastTabKey || "register";
    openTab("wow");

    document.body.classList.add("wow-fullscreen");
    isWowFullscreen = true;

    // botón se vuelve "salir"
    btnWowFullscreen.textContent = "✕";
    btnWowFullscreen.setAttribute("aria-label", "Salir de pantalla completa");

  }else{
    document.body.classList.remove("wow-fullscreen");
    isWowFullscreen = false;

    // volver a botón de entrar
    btnWowFullscreen.textContent = "⛶";
    btnWowFullscreen.setAttribute("aria-label", "Entrar a pantalla completa");

    // volver al tab que estaba antes (si quieres que se quede en WOW, comenta esta línea)
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

/******** Watch church doc ********/
function watchChurch(){
  if(unsubChurch) unsubChurch();

  unsubChurch = db.collection("churches").doc(churchId).onSnapshot(doc=>{
    const d = doc.data() || {};
    activeEventId = d.activeEventId || null;

    const sec = clamp(parseInt(d.wowSeconds || 6, 10) || 6, 1, 30);
    WOW_MS = sec * 1000;
    wowSeconds.value = String(sec);

    renderSession();
    mountCheckins();
    mountHistory();
  }, console.error);
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
        name, wowSeconds: 6, activeEventId: null,
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
    errCheckin.hidden = false;
    errCheckin.textContent = "Sesión cerrada. Abre sesión en Configuración.";
    return;
  }

  const f = clean(firstName.value);
  const l = clean(lastName.value);
  const t = clean(town.value);
  const qty = Math.max(1, parseInt(partySize.value,10) || 1);

  if(!f || !l){
    errCheckin.hidden = false;
    errCheckin.textContent = "Falta nombre y/o apellido.";
    return;
  }

  errCheckin.hidden = true;

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
  checkinStatus.textContent = "Registrado ✅";
}

/******** Realtime checkins (WOW + KPI + ticker) ********/
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

      kpiTotal.textContent = total;

      // ticker duplicado para loop suave
      tickerTrack.innerHTML = names.concat(names).map(n=>(
        `<span class="tickerItem">${escapeHtml(n)}</span>`
      )).join("");

      // WOW pop en todos los dispositivos
      if(newestId && newest && newest.fullName){
        if(firstLoad){
          firstLoad=false;
          lastWelcomeId=newestId;
          welcomeBig.textContent="Bienvenidos";
        } else if(newestId !== lastWelcomeId){
          lastWelcomeId=newestId;
          popWelcome(newest.fullName);
        }
      }
    }, console.error);
}

/******** WOW pop ********/
function popWelcome(name){
  if(welcomeTimer) clearTimeout(welcomeTimer);

  welcomeBig.textContent = "Bienvenidos " + name;
  welcomeBig.classList.remove("pop");
  void welcomeBig.offsetWidth;
  welcomeBig.classList.add("pop");

  welcomeTimer = setTimeout(()=>{
    welcomeBig.classList.remove("pop");
    welcomeBig.textContent = "Bienvenidos";
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
  pdf.text(`Iglesia: ${churchId}`, 40, y); y += 16;
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
