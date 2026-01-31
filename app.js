/******** FIREBASE CONFIG ********/
const firebaseConfig = {
  apiKey: "PUT_KEY",
  authDomain: "PUT_DOMAIN",
  projectId: "PUT_ID"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

/******** DOM ********/
const churchSelect  = document.getElementById("churchSelect");
const eventStatus   = document.getElementById("eventStatus");
const eventMeta     = document.getElementById("eventMeta");
const displayFooter = document.getElementById("displayFooter");

const btnOpenEvent  = document.getElementById("btnOpenEvent");
const btnCloseEvent = document.getElementById("btnCloseEvent");
const btnFullscreen = document.getElementById("btnFullscreen");

const form          = document.getElementById("checkinForm");
const fullNameInput = document.getElementById("fullName");
const partySizeInput= document.getElementById("partySize");
const nameError     = document.getElementById("nameError");

const rows          = document.getElementById("rows");
const welcome       = document.getElementById("welcome");
const totalCount    = document.getElementById("totalCount");
const displayCard   = document.getElementById("displayCard");

/******** STATE ********/
let currentChurchId = null;
let currentEventId  = null;
let unsubChurchDoc  = null;
let unsubCheckins   = null;

/******** AUTH (MVP) ********/
firebase.auth().signInAnonymously().catch(console.error);

/******** BOOT ********/
init();

async function init(){
  await loadChurches();
  bindUI();
}

/******** LOAD CHURCHES ********/
async function loadChurches(){
  // churchId por URL o localStorage
  const params = new URLSearchParams(location.search);
  const preferred = (params.get("church") || localStorage.getItem("nc.churchId") || "").trim();

  const snap = await db.collection("churches").orderBy("name").get();
  churchSelect.innerHTML = "";

  // Si aún no hay iglesias, crea placeholder mínimo (para que no se muera la app)
  if (snap.empty) {
    // Nota: si tus reglas no permiten, esto fallará. Puedes crear la iglesia manual desde consola.
    const doc = await db.collection("churches").add({ name: "Iglesia Demo", createdAt: firebase.firestore.FieldValue.serverTimestamp(), activeEventId: null });
    churchSelect.innerHTML = `<option value="${doc.id}">Iglesia Demo</option>`;
    setChurch(doc.id);
    return;
  }

  let firstId = null;
  snap.forEach(d=>{
    const data = d.data();
    if(!firstId) firstId = d.id;
    const opt = document.createElement("option");
    opt.value = d.id;
    opt.textContent = data.name || d.id;
    churchSelect.appendChild(opt);
  });

  const chosen = pickValid(preferred, snap) || firstId;
  churchSelect.value = chosen;
  setChurch(chosen);
}

function pickValid(id, snap){
  if(!id) return null;
  let ok = false;
  snap.forEach(d=>{ if(d.id === id) ok = true; });
  return ok ? id : null;
}

/******** BIND UI ********/
function bindUI(){
  churchSelect.addEventListener("change", ()=> setChurch(churchSelect.value));

  btnOpenEvent.addEventListener("click", openEvent);
  btnCloseEvent.addEventListener("click", closeEvent);

  btnFullscreen.addEventListener("click", ()=>{
    displayCard.classList.toggle("fullscreen");
    btnFullscreen.textContent = displayCard.classList.contains("fullscreen") ? "Salir" : "Pantalla Completa";
  });

  form.addEventListener("submit", submitCheckin);
}

/******** SET CHURCH ********/
function setChurch(churchId){
  currentChurchId = churchId;
  localStorage.setItem("nc.churchId", churchId);

  // Limpia listeners anteriores
  if(unsubChurchDoc) unsubChurchDoc();
  if(unsubCheckins) unsubCheckins();

  // Escucha iglesia para saber activeEventId
  unsubChurchDoc = db.collection("churches").doc(churchId).onSnapshot(doc=>{
    const c = doc.data() || {};
    currentEventId = c.activeEventId || null;

    const churchName = c.name || churchId;
    displayFooter.textContent = `Iglesia: ${churchName} · Evento: ${currentEventId ? "ACTIVO" : "SIN EVENTO"}`;

    renderEventState(c);
    listenCheckins(); // reengancha según evento
  }, console.error);
}

/******** EVENT STATE ********/
function renderEventState(churchData){
  const eId = churchData.activeEventId || null;

  if(!eId){
    eventStatus.textContent = "Evento CERRADO";
    eventStatus.className = "pill bad";
    eventMeta.textContent = "No hay evento activo. Abre uno para registrar.";
    btnCloseEvent.disabled = true;
    return;
  }

  eventStatus.textContent = "Evento ABIERTO";
  eventStatus.className = "pill ok";
  btnCloseEvent.disabled = false;

  // Lee metadata del evento (title/date/status)
  db.collection("churches").doc(currentChurchId)
    .collection("events").doc(eId).get()
    .then(ev=>{
      const d = ev.data() || {};
      const title = d.title || "Evento";
      const date = d.date || "";
      eventMeta.textContent = `${title}${date ? " · " + date : ""}`;
    })
    .catch(()=>{ eventMeta.textContent = "Evento activo"; });
}

/******** OPEN EVENT ********/
async function openEvent(){
  if(!currentChurchId) return;

  const title = prompt("Nombre del evento (ej: Servicio Domingo 10AM):", "Servicio");
  if(!title) return;

  const date = new Date().toISOString().slice(0,10);

  const ref = db.collection("churches").doc(currentChurchId).collection("events").doc();
  await ref.set({
    title,
    date,
    status: "open",
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });

  await db.collection("churches").doc(currentChurchId).set({
    activeEventId: ref.id
  }, { merge:true });
}

/******** CLOSE EVENT ********/
async function closeEvent(){
  if(!currentChurchId || !currentEventId) return;

  // Marca evento closed + limpia activeEventId
  const evRef = db.collection("churches").doc(currentChurchId).collection("events").doc(currentEventId);

  await evRef.set({ status:"closed", closedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge:true });
  await db.collection("churches").doc(currentChurchId).set({ activeEventId:null }, { merge:true });
}

/******** CHECKINS LISTENER ********/
function listenCheckins(){
  if(unsubCheckins) unsubCheckins();

  rows.innerHTML = "";
  totalCount.textContent = "0";
  welcome.textContent = "—";

  if(!currentChurchId || !currentEventId){
    return;
  }

  unsubCheckins = db.collection("churches")
    .doc(currentChurchId)
    .collection("events")
    .doc(currentEventId)
    .collection("checkins")
    .orderBy("createdAt","desc")
    .limit(50)
    .onSnapshot(snap=>{
      rows.innerHTML = "";
      let total = 0;
      let first = true;

      snap.forEach(doc=>{
        const d = doc.data() || {};
        const qty = Number(d.partySize || 1);
        total += qty;

        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${fmt(d.createdAt)}</td>
          <td>${escapeHtml(d.fullName || "")}</td>
          <td>${qty}</td>
        `;
        rows.appendChild(tr);

        if(first && d.fullName){
          greet(d.fullName);
          first = false;
        }
      });

      totalCount.textContent = total;
    }, console.error);
}

/******** SUBMIT CHECKIN ********/
async function submitCheckin(e){
  e.preventDefault();

  if(!currentEventId){
    alert("No hay evento abierto. Abre un evento primero.");
    return;
  }

  const cleaned = cleanName(fullNameInput.value);
  const qty = Math.max(1, Number(partySizeInput.value || 1));

  if(!isValidFullName(cleaned)){
    nameError.hidden = false;
    fullNameInput.focus();
    return;
  }
  nameError.hidden = true;

  await db.collection("churches")
    .doc(currentChurchId)
    .collection("events")
    .doc(currentEventId)
    .collection("checkins")
    .add({
      fullName: cleaned,
      partySize: qty,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

  form.reset();
  fullNameInput.focus();
}

/******** HELPERS ********/
function cleanName(v){
  return String(v || "").replace(/\s+/g," ").trim();
}

function isValidFullName(name){
  const parts = name.split(" ").filter(Boolean);
  if(parts.length < 2) return false;         // nombre + apellido
  if(parts.some(p=>p.length < 2)) return false;
  return true;
}

function greet(name){
  welcome.textContent = "Bienvenido, " + name;
  welcome.style.opacity = 1;
  setTimeout(()=> welcome.style.opacity = .35, 4000);
}

function fmt(ts){
  if(!ts) return "";
  return ts.toDate().toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"});
}

function escapeHtml(str){
  return String(str || "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}
