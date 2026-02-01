"use strict";

/* ===== FIREBASE ===== */
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
const { jsPDF } = window.jspdf;

/* ===== PARAM ===== */
const params = new URLSearchParams(location.search);
let churchId = params.get("church") || "demo";

/* ===== DOM ===== */
const pinOverlay = document.getElementById("pinOverlay");
const pinInput = document.getElementById("pinInput");
const btnPinUnlock = document.getElementById("btnPinUnlock");
const pinError = document.getElementById("pinError");
const btnLock = document.getElementById("btnLock");

const welcomeBig = document.getElementById("welcomeBig");
const wowAudio = document.getElementById("wowAudio");
const btnWowFullscreen = document.getElementById("btnWowFullscreen");

const formCheckin = document.getElementById("formCheckin");
const firstName = document.getElementById("firstName");
const lastName = document.getElementById("lastName");
const town = document.getElementById("town");
const partySize = document.getElementById("partySize");

const kpiTotal = document.getElementById("kpiTotal");

const sessionPill = document.getElementById("sessionPill");
const btnOpenSession = document.getElementById("btnOpenSession");
const btnCloseSession = document.getElementById("btnCloseSession");
const sessionTitle = document.getElementById("sessionTitle");

/* ===== STATE ===== */
let churchName = "";
let activeEventId = null;
let churchPinHash = "";

/* ===== PIN ===== */
const DEFAULT_PIN = "1234";

function lockApp(){
  pinOverlay.style.display = "flex";
  pinInput.value = "";
  pinInput.focus();
}

function unlockApp(){
  pinOverlay.style.display = "none";
}

async function sha256(text){
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,"0")).join("");
}

async function tryUnlock(){
  const val = pinInput.value.trim();
  if(!/^[0-9]{4,6}$/.test(val)){
    pinError.textContent = "PIN inválido";
    pinError.hidden = false;
    return;
  }

  if(!churchPinHash){
    if(val === DEFAULT_PIN){ unlockApp(); return; }
    pinError.textContent = "PIN incorrecto";
    pinError.hidden = false;
    return;
  }

  const h = await sha256(val);
  if(h === churchPinHash){ unlockApp(); return; }

  pinError.textContent = "PIN incorrecto";
  pinError.hidden = false;
}

btnPinUnlock.onclick = tryUnlock;
pinInput.addEventListener("keydown", e=>{ if(e.key==="Enter") tryUnlock(); });
btnLock.onclick = lockApp;

/* ===== WOW ===== */
let wowOn = false;

btnWowFullscreen.onclick = ()=>{
  wowOn = !wowOn;
  if(wowOn){
    document.body.classList.add("wow-fullscreen");
    wowAudio.volume = 0;
    wowAudio.play().catch(()=>{});
    let v=0;
    const t=setInterval(()=>{
      v+=0.05;
      wowAudio.volume = v;
      if(v>=0.35) clearInterval(t);
    },50);
  } else {
    document.body.classList.remove("wow-fullscreen");
    wowAudio.pause();
  }
};

/* ===== WATCH CHURCH ===== */
db.collection("churches").doc(churchId).onSnapshot(doc=>{
  const d = doc.data() || {};
  churchName = d.name || churchId;
  activeEventId = d.activeEventId || null;
  churchPinHash = d.pinHash || "";

  if(!sessionPill) return;

  if(activeEventId){
    sessionPill.textContent = "ABIERTA";
    btnCloseSession.disabled = false;
  } else {
    sessionPill.textContent = "CERRADA";
    btnCloseSession.disabled = true;
  }

  lockApp();
});

/* ===== SESSION ===== */
btnOpenSession.onclick = async ()=>{
  const title = sessionTitle.value || "Servicio";
  const ref = db.collection("churches").doc(churchId).collection("events").doc();
  await ref.set({
    title,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    status:"open"
  });
  await db.collection("churches").doc(churchId).set({activeEventId:ref.id},{merge:true});
};

btnCloseSession.onclick = async ()=>{
  if(!activeEventId) return;
  await db.collection("churches").doc(churchId).set({activeEventId:null},{merge:true});
};

/* ===== CHECKIN ===== */
formCheckin.onsubmit = async e=>{
  e.preventDefault();
  if(!activeEventId) return;

  const full = firstName.value + " " + lastName.value;

  await db.collection("churches")
    .doc(churchId)
    .collection("events")
    .doc(activeEventId)
    .collection("checkins")
    .add({
      fullName: full,
      town: town.value || "",
      partySize: Number(partySize.value || 1),
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

  welcomeBig.textContent = "Bienvenidos " + full + " a la Iglesia " + churchName;

  firstName.value="";
  lastName.value="";
  town.value="";
  partySize.value=1;
};
