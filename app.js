/******** FIREBASE YA CONFIGURADO ARRIBA ********/
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
firebase.auth().signInAnonymously();

/******** DOM ********/
const form = checkinForm;
const fullNameInput = fullName;
const partySizeInput = partySize;
const nameError = nameError;
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
function clean(v){return v.replace(/\s+/g," ").trim();}
function valid(n){
  const p=n.split(" ");
  return p.length>=2 && p.every(x=>x.length>=2);
}

/******** CHURCH + EVENT (usa los tuyos existentes) ********/
const churchId = localStorage.getItem("nc.churchId") || "demo";

/******** SUBMIT ********/
form.onsubmit = async e=>{
  e.preventDefault();

  const name = clean(fullNameInput.value);
  if(!valid(name)){ nameError.hidden=false; return; }
  nameError.hidden=true;

  const qty = Number(partySizeInput.value||1);

  await db.collection("churches")
    .doc(churchId)
    .collection("checkins")
    .add({
      fullName:name,
      partySize:qty,
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
  void welcomeBig.offsetWidth;
  welcomeBig.classList.add("pop");
}

/******** TICKER + KPI ********/
db.collection("churches")
.doc(churchId)
.collection("checkins")
.orderBy("createdAt","desc")
.limit(40)
.onSnapshot(snap=>{
  let total=0;
  let items=[];

  snap.forEach(d=>{
    const x=d.data();
    total += Number(x.partySize||1);
    items.push(x.fullName);
  });

  totalCount.textContent = total;

  tickerTrack.innerHTML =
    items.concat(items).map(n=>`<span class="tickerItem">${n}</span>`).join("");
});
