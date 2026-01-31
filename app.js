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
const form = document.getElementById("checkinForm");
const fullNameInput = document.getElementById("fullName");
const partySizeInput = document.getElementById("partySize");
const nameErrorEl = document.getElementById("nameError");
const totalCount = document.getElementById("totalCount");
const welcomeBig = document.getElementById("welcomeBig");
const tickerTrack = document.getElementById("tickerTrack");
const displayCard = document.getElementById("displayCard");
const btnFullscreen = document.getElementById("btnFullscreen");

/******** QUICK BUTTONS ********/
document.querySelectorAll(".q").forEach(b=>{
  b.onclick = ()=> partySizeInput.value = b.dataset.n;
});

/******** FULLSCREEN ********/
btnFullscreen.onclick = ()=>{
  displayCard.classList.toggle("fullscreen");
};

/******** VALIDATION ********/
function clean(v){ return String(v || "").replace(/\s+/g," ").trim(); }
function valid(n){
  const p = n.split(" ").filter(Boolean);
  return p.length >= 2 && p.every(x => x.length >= 2);
}

/******** CHURCH ID ********/
const churchId = (new URLSearchParams(location.search).get("church") ||
                 localStorage.getItem("nc.churchId") ||
                 "demo").trim();
localStorage.setItem("nc.churchId", churchId);

/******** SUBMIT ********/
form.onsubmit = async e=>{
  e.preventDefault();

  const name = clean(fullNameInput.value);
  if(!valid(name)){
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
};

/******** WOW WELCOME ********/
function popWelcome(name){
  welcomeBig.textContent = "Bienvenido " + name;
  welcomeBig.classList.remove("pop");
  void welcomeBig.offsetWidth; // reinicia animación
  welcomeBig.classList.add("pop");
}

/******** TICKER + KPI ********/
db.collection("churches")
  .doc(churchId)
  .collection("checkins")
  .orderBy("createdAt","desc")
  .limit(40)
  .onSnapshot(snap=>{
    let total = 0;
    const items = [];

    snap.forEach(d=>{
      const x = d.data() || {};
      total += Number(x.partySize || 1);
      if (x.fullName) items.push(x.fullName);
    });

    totalCount.textContent = total;

    // duplicamos para scroll continuo
    tickerTrack.innerHTML = items.concat(items)
      .map(n => `<span class="tickerItem">${escapeHtml(n)}</span>`)
      .join("");
  }, console.error);

/******** XSS SAFE ********/
function escapeHtml(str){
  return String(str || "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}
