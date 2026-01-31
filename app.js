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

/******** DOM ********/
const churchSelect   = document.getElementById("churchSelect");
const btnCopyLink    = document.getElementById("btnCopyLink");

const form           = document.getElementById("checkinForm");
const fullNameInput  = document.getElementById("fullName");
const partySizeInput = document.getElementById("partySize");
const nameErrorEl    = document.getElementById("nameError");

const totalCount     = document.getElementById("totalCount");
const welcomeBig     = document.getElementById("welcomeBig");
const tickerTrack    = document.getElementById("tickerTrack");

const displayCard    = document.getElementById("displayCard");
const btnFullscreen  = document.getElementById("btnFullscreen");

/******** WOW CONTROLS ********/
document.querySelectorAll(".q").forEach(b=>{
  b.onclick = ()=> partySizeInput.value = b.dataset.n;
});

btnFullscreen.onclick = ()=>{
  displayCard.classList.toggle("fullscreen");
};

/******** CANAL POR URL (SIN localStorage) ********/
const params = new URLSearchParams(location.search);
let churchId = (params.get("church") || "demo").trim();

/******** REALTIME STATE ********/
let unsub = null;
let lastWelcomeId = null;
let firstLoad = true;
let welcomeTimer = null;

/******** INIT ********/
init().catch(console.error);

async function init(){
  await loadChurches();
  bindUI();
  mountRealtime();
  fullNameInput.focus();
}

/******** LOAD CHURCHES ********/
async function loadChurches(){
  churchSelect.innerHTML = "";

  const snap = await db.collection("churches").orderBy("name").get();

  if (snap.empty) {
    const opt = document.createElement("option");
    opt.value = "demo";
    opt.textContent = "demo";
    churchSelect.appendChild(opt);
    churchSelect.value = churchId;
    return;
  }

  let found = false;

  snap.forEach(doc=>{
    const d = doc.data() || {};
    const opt = document.createElement("option");
    opt.value = doc.id;
    opt.textContent = d.name || doc.id;
    churchSelect.appendChild(opt);
    if(doc.id === churchId) found = true;
  });

  if(!found){
    churchId = churchSelect.options[0].value;
    replaceChurchInUrl(churchId);
  }

  churchSelect.value = churchId;
}

/******** UI ********/
function bindUI(){

  churchSelect.onchange = ()=>{
    replaceChurchInUrl(churchSelect.value);
    location.reload();
  };

  btnCopyLink.onclick = async ()=>{
    const url = buildChurchUrl(churchId);
    try{
      await navigator.clipboard.writeText(url);
      btnCopyLink.textContent = "Link Copiado ✅";
      setTimeout(()=> btnCopyLink.textContent="Copiar Link",1500);
    }catch{
      prompt("Copia este link:", url);
    }
  };

  form.onsubmit = submitCheckin;
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

      const newestDoc = snap.docs[0];
      const newestId = newestDoc ? newestDoc.id : null;
      const newestData = newestDoc ? newestDoc.data() : null;

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

      // ✅ WOW GLOBAL SYNC
      if(newestId && newestData && newestData.fullName){
        if(firstLoad){
          firstLoad = false;
          lastWelcomeId = newestId;
          welcomeBig.textContent = "Bienvenidos";
        }
        else if(newestId !== lastWelcomeId){
          lastWelcomeId = newestId;
          popWelcome(newestData.fullName);
        }
      }

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

  form.reset();
  fullNameInput.focus();
}

/******** WOW WELCOME — TIEMPO ALARGADO ********/
function popWelcome(name){

  if(welcomeTimer) clearTimeout(welcomeTimer);

  welcomeBig.textContent = "Bienvenido " + name;

  welcomeBig.classList.remove("pop");
  void welcomeBig.offsetWidth;
  welcomeBig.classList.add("pop");

  // ⏱️ visible 6 segundos
  welcomeTimer = setTimeout(()=>{
    welcomeBig.classList.remove("pop");
    welcomeBig.textContent = "Bienvenidos";
  }, 6000);
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
  const p = name.split(" ").filter(Boolean);
  return p.length >= 2 && p.every(x=>x.length >= 2);
}

function escapeHtml(str){
  return String(str || "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}
