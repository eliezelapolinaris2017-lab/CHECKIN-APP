/******** FIREBASE CONFIG (TU PROYECTO) ********/
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

/******** DOM ********/
const churchSelect  = document.getElementById("churchSelect");
const btnCopyLink   = document.getElementById("btnCopyLink");

const form          = document.getElementById("checkinForm");
const fullNameInput = document.getElementById("fullName");
const partySizeInput= document.getElementById("partySize");
const nameErrorEl   = document.getElementById("nameError");

const totalCount    = document.getElementById("totalCount");
const welcomeBig    = document.getElementById("welcomeBig");
const tickerTrack   = document.getElementById("tickerTrack");

const displayCard   = document.getElementById("displayCard");
const btnFullscreen = document.getElementById("btnFullscreen");

/******** WOW CONTROLS ********/
document.querySelectorAll(".q").forEach(b=>{
  b.addEventListener("click", ()=> partySizeInput.value = b.dataset.n );
});

btnFullscreen.addEventListener("click", ()=>{
  displayCard.classList.toggle("fullscreen");
});

/******** CANAL ÚNICO POR URL (SIN localStorage) ********/
const params = new URLSearchParams(location.search);
let churchId = (params.get("church") || "demo").trim();

/******** LISTENERS HOLDERS ********/
let unsub = null;

/******** INIT ********/
init().catch(console.error);

async function init(){
  await loadChurches();     // llena selector
  bindUI();                 // eventos
  mountRealtime();          // escucha realtime
  fullNameInput.focus();
}

/******** LOAD CHURCHES (si no existen, usa demo) ********/
async function loadChurches(){
  churchSelect.innerHTML = "";

  const snap = await db.collection("churches").orderBy("name").get();

  if (snap.empty) {
    // fallback: demo (no requiere tener doc creado)
    const opt = document.createElement("option");
    opt.value = "demo";
    opt.textContent = "demo";
    churchSelect.appendChild(opt);
    churchSelect.value = churchId || "demo";
    return;
  }

  let found = false;
  snap.forEach(doc=>{
    const d = doc.data() || {};
    const opt = document.createElement("option");
    opt.value = doc.id;
    opt.textContent = d.name || doc.id;
    churchSelect.appendChild(opt);
    if (doc.id === churchId) found = true;
  });

  if(!found){
    // si la URL trae un churchId que no existe, caemos al primero del listado
    churchId = churchSelect.options[0].value;
    replaceChurchInUrl(churchId);
  }

  churchSelect.value = churchId;
}

/******** UI EVENTS ********/
function bindUI(){
  churchSelect.addEventListener("change", ()=>{
    const id = churchSelect.value;
    // cambia URL -> recarga limpia -> todos sincronizados con mismo canal
    replaceChurchInUrl(id);
    location.reload();
  });

  btnCopyLink.addEventListener("click", async ()=>{
    const url = buildChurchUrl(churchId);
    try{
      await navigator.clipboard.writeText(url);
      btnCopyLink.textContent = "Link Copiado ✅";
      setTimeout(()=> btnCopyLink.textContent="Copiar Link", 1400);
    }catch{
      // fallback: prompt
      prompt("Copia este link:", url);
    }
  });

  form.addEventListener("submit", submitCheckin);
}

/******** REALTIME ********/
function mountRealtime(){
  if(unsub) unsub();

  unsub = db.collection("churches")
    .doc(churchId)
    .collection("checkins")
    .orderBy("createdAt","desc")
    .limit(40)
    .onSnapshot(snap=>{
      let total = 0;
      const names = [];

      snap.forEach(doc=>{
        const d = doc.data() || {};
        total += Number(d.partySize || 1);
        if(d.fullName) names.push(d.fullName);
      });

      totalCount.textContent = total;

      // ticker infinito
      const doubled = names.concat(names);
      tickerTrack.innerHTML = doubled
        .map(n => `<span class="tickerItem">${escapeHtml(n)}</span>`)
        .join("");

    }, console.error);
}

/******** SUBMIT ********/
async function submitCheckin(e){
  e.preventDefault();

  const name = clean(fullNameInput.value);
  if(!validFullName(name)){
    nameErrorEl.hidden = false;
    fullNameInput.focus();
    return;
  }
  nameErrorEl.hidden = true;

  const qty = Math.max(1, Number(partySizeInput.value || 1));

  await db.collection("churches")
    .doc(churchId)
    .collection("checkins")
    .add({
      fullName: name,
      partySize: qty,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

  popWelcome(name);
  form.reset();
  fullNameInput.focus();
}

/******** HELPERS ********/
function replaceChurchInUrl(id){
  const u = new URL(location.href);
  u.searchParams.set("church", id);
  history.replaceState({}, "", u.toString());
}

function buildChurchUrl(id){
  const u = new URL(location.href);
  u.searchParams.set("church", id);
  return u.toString();
}

function clean(v){
  return String(v || "").replace(/\s+/g," ").trim();
}

function validFullName(name){
  const parts = name.split(" ").filter(Boolean);
  return parts.length >= 2 && parts.every(p => p.length >= 2);
}

function popWelcome(name){
  welcomeBig.textContent = "Bienvenido " + name;
  welcomeBig.classList.remove("pop");
  void welcomeBig.offsetWidth;
  welcomeBig.classList.add("pop");
}

function escapeHtml(str){
  return String(str || "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}
