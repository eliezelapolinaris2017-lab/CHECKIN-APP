/******** FIREBASE CONFIG ********/
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

/******** URL MODE ********/
const params = new URLSearchParams(location.search);
const MODE = (params.get("mode") || "staff").toLowerCase(); // kiosk | staff | admin

/******** DOM ********/
const modeLabel       = document.getElementById("modeLabel");

const churchSelect    = document.getElementById("churchSelect");
const churchChip      = document.getElementById("churchChip");

const btnSettings     = document.getElementById("btnSettings");
const settingsPanel   = document.getElementById("settingsPanel");
const btnCloseSettings= document.getElementById("btnCloseSettings");
const settingsSub     = document.getElementById("settingsSub");

const btnCopyLink     = document.getElementById("btnCopyLink");

const adminBlock      = document.getElementById("adminBlock");
const newChurchName   = document.getElementById("newChurchName");
const btnCreateChurch = document.getElementById("btnCreateChurch");
const createMsg       = document.getElementById("createMsg");

const opsBlock        = document.getElementById("opsBlock");
const sessionPill     = document.getElementById("sessionPill");
const btnOpenSession  = document.getElementById("btnOpenSession");
const btnCloseSession = document.getElementById("btnCloseSession");
const sessionTitle    = document.getElementById("sessionTitle");
const sessionMeta     = document.getElementById("sessionMeta");

const wowSeconds      = document.getElementById("wowSeconds");
const btnApplyWow     = document.getElementById("btnApplyWow");

const form            = document.getElementById("checkinForm");
const fullNameInput   = document.getElementById("fullName");
const partySizeInput  = document.getElementById("partySize");
const nameErrorEl     = document.getElementById("nameError");
const btnCheckin      = document.getElementById("btnCheckin");

const historyBlock    = document.getElementById("historyBlock");
const historyList     = document.getElementById("historyList");

const totalCount      = document.getElementById("totalCount");
const welcomeBig      = document.getElementById("welcomeBig");
const tickerTrack     = document.getElementById("tickerTrack");

const displayCard     = document.getElementById("displayCard");
const btnFullscreen   = document.getElementById("btnFullscreen");

/******** QUICK BUTTONS + FULLSCREEN ********/
document.querySelectorAll(".q").forEach(b => b.onclick = ()=> partySizeInput.value = b.dataset.n);
btnFullscreen.onclick = ()=> displayCard.classList.toggle("fullscreen");

/******** CHANNEL ********/
let churchId = (params.get("church") || "demo").trim();

/******** WOW TIME ********/
let WOW_MS = toInt(params.get("wow"), 6) * 1000;
wowSeconds.value = String(clamp(Math.round(WOW_MS/1000), 1, 30));

/******** STATE ********/
let activeEventId = null;

let unsubChurch = null;
let unsubCheckins = null;
let unsubHistory = null;

let lastWelcomeId = null;
let firstLoad = true;
let welcomeTimer = null;

/******** INIT ********/
init().catch(console.error);

async function init(){
  applyModeUI();
  await loadChurches();
  bindUI();
  watchChurch();
  fullNameInput.focus();
}

/******** MODE UI ********/
function applyModeUI(){
  modeLabel.textContent = `Modo: ${MODE.toUpperCase()}`;

  // Drawer solo para staff/admin
  const canConfig = (MODE === "staff" || MODE === "admin");
  btnSettings.hidden = !canConfig;

  // Admin-only: crear iglesias
  adminBlock.hidden = (MODE !== "admin");

  settingsSub.textContent = (MODE === "admin") ? "Admin" : "Staff";

  // KIOSK: bloquear todo menos registro
  if(MODE === "kiosk"){
    // oculta selector (evita que cambien de iglesia)
    churchChip.style.display = "none";

    // oculta ops + historial
    opsBlock.style.display = "none";
    historyBlock.style.display = "none";

    // cierre por si estaba abierto
    settingsPanel.hidden = true;
  }
}

/******** LOAD CHURCHES ********/
async function loadChurches(){
  churchSelect.innerHTML = "";

  const snap = await db.collection("churches").orderBy("name").get();
  if(snap.empty){
    addOption("demo","demo");
    churchSelect.value = churchId;
    return;
  }

  let found = false;
  snap.forEach(doc=>{
    const d = doc.data() || {};
    addOption(doc.id, d.name || doc.id);
    if(doc.id === churchId) found = true;
  });

  if(!found){
    churchId = churchSelect.options[0].value;
    replaceParam("church", churchId);
  }

  churchSelect.value = churchId;

  function addOption(id,label){
    const opt = document.createElement("option");
    opt.value = id;
    opt.textContent = label;
    churchSelect.appendChild(opt);
  }
}

/******** UI ********/
function bindUI(){
  // Selector: solo staff/admin
  churchSelect.onchange = ()=>{
    if(MODE === "kiosk") return;
    replaceParam("church", churchSelect.value);
    location.reload();
  };

  // Settings drawer
  btnSettings.onclick = ()=> settingsPanel.hidden = false;
  btnCloseSettings.onclick = ()=> settingsPanel.hidden = true;

  // Copiar link (incluye church/mode/wow)
  btnCopyLink.onclick = async ()=>{
    const url = location.href;
    try{
      await navigator.clipboard.writeText(url);
      btnCopyLink.textContent = "Link Copiado ✅";
      setTimeout(()=> btnCopyLink.textContent="Copiar Link",1500);
    }catch{
      prompt("Copia este link:", url);
    }
  };

  // WOW seconds (solo staff/admin)
  btnApplyWow.onclick = ()=>{
    if(MODE === "kiosk") return;
    const sec = clamp(toInt(wowSeconds.value, 6), 1, 30);
    replaceParam("wow", String(sec));
    location.reload();
  };

  // Admin: crear iglesia
  btnCreateChurch.onclick = async ()=>{
    if(MODE !== "admin") return;

    const name = clean(newChurchName.value);
    if(!name){ flash(createMsg,"Escribe el nombre de la iglesia.", true); return; }

    btnCreateChurch.disabled = true;
    btnCreateChurch.textContent = "Creando…";
    try{
      let id = slugify(name) || ("iglesia_" + rand4());
      const exists = await db.collection("churches").doc(id).get();
      if(exists.exists) id = `${id}_${rand4()}`;

      await db.collection("churches").doc(id).set({
        name,
        activeEventId: null,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      }, {merge:true});

      replaceParam("church", id);
      flash(createMsg, `Iglesia creada: "${name}" · ID: ${id}`, false);
      location.reload();
    }catch(e){
      console.error(e);
      flash(createMsg, "No se pudo crear. Revisa reglas/permisos.", true);
    }finally{
      btnCreateChurch.disabled = false;
      btnCreateChurch.textContent = "+ Nueva";
      newChurchName.value = "";
    }
  };

  // Sesión: solo staff/admin (kiosk lo tiene oculto)
  btnOpenSession.onclick = openSession;
  btnCloseSession.onclick = closeSession;

  // Registro: siempre activo, pero requiere sesión abierta
  form.onsubmit = submitCheckin;
}

/******** WATCH CHURCH ********/
function watchChurch(){
  if(unsubChurch) unsubChurch();

  unsubChurch = db.collection("churches").doc(churchId)
    .onSnapshot(doc=>{
      const d = doc.data() || {};
      activeEventId = d.activeEventId || null;

      renderSessionState();
      mountCheckinsRealtime();

      // Historial solo staff/admin
      if(MODE === "staff" || MODE === "admin") mountHistoryRealtime();
    }, console.error);
}

/******** SESSION UI ********/
function renderSessionState(){
  if(activeEventId){
    sessionPill.textContent = "ABIERTA";
    sessionPill.className = "pill ok";
    btnCloseSession.disabled = false;
    btnCheckin.disabled = false;
    sessionMeta.textContent = `Evento activo: ${activeEventId}`;
  }else{
    sessionPill.textContent = "CERRADA";
    sessionPill.className = "pill bad";
    btnCloseSession.disabled = true;
    btnCheckin.disabled = true;
    totalCount.textContent = "0";
    tickerTrack.innerHTML = "";
    welcomeBig.textContent = "Bienvenidos";
    sessionMeta.textContent = "No hay sesión abierta. Abre una para registrar.";
  }
}

/******** OPEN/CLOSE SESSION ********/
async function openSession(){
  if(MODE === "kiosk") return;

  const title = clean(sessionTitle.value || "");
  const finalTitle = title || `Servicio ${new Date().toLocaleDateString()}`;
  const date = new Date().toISOString().slice(0,10);

  const evRef = db.collection("churches").doc(churchId)
    .collection("events").doc();

  await evRef.set({
    title: finalTitle,
    date,
    status: "open",
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });

  await db.collection("churches").doc(churchId).set({
    activeEventId: evRef.id
  }, {merge:true});

  sessionTitle.value = "";
}

async function closeSession(){
  if(MODE === "kiosk") return;
  if(!activeEventId) return;

  const evRef = db.collection("churches").doc(churchId)
    .collection("events").doc(activeEventId);

  await evRef.set({
    status:"closed",
    closedAt: firebase.firestore.FieldValue.serverTimestamp()
  }, {merge:true});

  await db.collection("churches").doc(churchId).set({
    activeEventId: null
  }, {merge:true});
}

/******** REALTIME CHECKINS ********/
function mountCheckinsRealtime(){
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

      const newestDoc = snap.docs[0];
      const newestId = newestDoc ? newestDoc.id : null;
      const newest = newestDoc ? newestDoc.data() : null;

      snap.forEach(doc=>{
        const d = doc.data() || {};
        total += Number(d.partySize || 1);
        if(d.fullName) names.push(d.fullName);
      });

      totalCount.textContent = total;

      tickerTrack.innerHTML =
        names.concat(names)
          .map(n=>`<span class="tickerItem">${escapeHtml(n)}</span>`)
          .join("");

      if(newestId && newest && newest.fullName){
        if(firstLoad){
          firstLoad = false;
          lastWelcomeId = newestId;
          welcomeBig.textContent = "Bienvenidos";
        }else if(newestId !== lastWelcomeId){
          lastWelcomeId = newestId;
          popWelcome(newest.fullName);
        }
      }
    }, console.error);
}

/******** SUBMIT CHECKIN ********/
async function submitCheckin(e){
  e.preventDefault();

  if(!activeEventId){
    alert("No hay sesión abierta. Abre una sesión primero.");
    return;
  }

  const name = clean(fullNameInput.value);
  if(!validFullName(name)){
    nameErrorEl.hidden = false;
    fullNameInput.focus();
    return;
  }
  nameErrorEl.hidden = true;

  const qty = Math.max(1, Number(partySizeInput.value || 1));

  await db.collection("churches").doc(churchId)
    .collection("events").doc(activeEventId)
    .collection("checkins")
    .add({
      fullName:name,
      partySize:qty,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

  form.reset();
  fullNameInput.focus();
}

/******** HISTORY + PDF (solo staff/admin) ********/
function mountHistoryRealtime(){
  if(unsubHistory) unsubHistory();

  unsubHistory = db.collection("churches").doc(churchId)
    .collection("events")
    .orderBy("createdAt","desc")
    .limit(12)
    .onSnapshot(snap=>{
      historyList.innerHTML = "";
      if(snap.empty){
        historyList.innerHTML = `<div class="hint">No hay sesiones aún.</div>`;
        return;
      }

      snap.forEach(doc=>{
        const e = doc.data() || {};
        const id = doc.id;
        const title = e.title || "Sesión";
        const date = e.date || "";
        const status = e.status || "—";

        const div = document.createElement("div");
        div.className = "hItem";
        div.innerHTML = `
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
        historyList.appendChild(div);
      });

      historyList.querySelectorAll("button[data-pdf]").forEach(btn=>{
        btn.onclick = ()=> exportEventPDF(btn.getAttribute("data-pdf"));
      });
    }, console.error);
}

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
      qty
    });
  });

  const pdf = new jsPDF({ unit:"pt", format:"letter" });
  let y = 50;

  pdf.setFont("helvetica","bold");
  pdf.setFontSize(18);
  pdf.text("Nexus Churchs — Reporte de Asistencia", 40, y); y += 22;

  pdf.setFont("helvetica","normal");
  pdf.setFontSize(12);
  pdf.text(`Iglesia: ${churchId}`, 40, y); y += 16;
  pdf.text(`Sesión: ${title}`, 40, y); y += 16;
  pdf.text(`Fecha: ${date}`, 40, y); y += 16;
  pdf.text(`Total asistencia: ${total}`, 40, y); y += 24;

  pdf.setFont("helvetica","bold");
  pdf.text("#", 40, y);
  pdf.text("Hora", 70, y);
  pdf.text("Nombre", 140, y);
  pdf.text("Qty", 520, y);
  y += 12;

  pdf.setDrawColor(80);
  pdf.line(40, y, 572, y);
  y += 14;

  pdf.setFont("helvetica","normal");
  pdf.setFontSize(11);

  for(const r of rows){
    if(y > 740){ pdf.addPage(); y = 60; }
    pdf.text(String(r.n), 40, y);
    pdf.text(r.time, 70, y);
    pdf.text(trunc(r.name, 55), 140, y);
    pdf.text(String(r.qty), 520, y);
    y += 16;
  }

  pdf.save(`NexusChurchs_${safeFile(title)}_${date || "reporte"}.pdf`);
}

/******** WOW ********/
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

/******** HELPERS ********/
function replaceParam(key, value){
  const u = new URL(location.href);
  u.searchParams.set(key, value);
  history.replaceState({}, "", u.toString());
}

function clean(v){ return String(v || "").replace(/\s+/g," ").trim(); }
function validFullName(name){
  const p = name.split(" ").filter(Boolean);
  return p.length >= 2 && p.every(x=>x.length >= 2);
}
function toInt(v, fallback){
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}
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
function flash(el, msg, isBad){
  el.textContent = msg;
  el.style.color = isBad ? "var(--bad)" : "var(--muted)";
}
function slugify(s){
  return String(s||"").trim().toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .replace(/[^a-z0-9]+/g,"-")
    .replace(/^-+|-+$/g,"")
    .slice(0,40);
}
function rand4(){ return Math.random().toString(36).slice(2,6); }
