/******** FIREBASE CONFIG ********/
const firebaseConfig = {
  apiKey: "PUT_KEY",
  authDomain: "PUT_DOMAIN",
  projectId: "PUT_ID"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

/******** CHURCH PARAM ********/
const params = new URLSearchParams(location.search);
const churchId = (params.get("church") || "demo").trim();

/******** DOM ********/
const form = checkinForm;
const fullNameInput = fullName;
const partySizeInput = partySize;
const nameError = document.getElementById("nameError");
const rows = document.getElementById("rows");
const welcome = document.getElementById("welcome");
const totalCount = document.getElementById("totalCount");

/******** AUTH ********/
firebase.auth().signInAnonymously();

/******** VALIDATION ********/
function cleanName(v){
  return v.replace(/\s+/g," ").trim();
}

function validFullName(n){
  const p = n.split(" ");
  return p.length >= 2 && p.every(x=>x.length>=2);
}

/******** FORM SUBMIT ********/
form.onsubmit = async e => {
  e.preventDefault();

  const name = cleanName(fullNameInput.value);
  const qty = Math.max(1, Number(partySizeInput.value||1));

  if(!validFullName(name)){
    nameError.hidden = false;
    return;
  }

  nameError.hidden = true;

  await db.collection("churches")
    .doc(churchId)
    .collection("checkins")
    .add({
      fullName:name,
      partySize:qty,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

  form.reset();
  fullNameInput.focus();
};

/******** REALTIME VIEW ********/
db.collection("churches")
.doc(churchId)
.collection("checkins")
.orderBy("createdAt","desc")
.limit(50)
.onSnapshot(snap=>{
  rows.innerHTML="";
  let total=0;
  let first=true;

  snap.forEach(doc=>{
    const d=doc.data();
    total += Number(d.partySize||1);

    rows.innerHTML += `
      <tr>
        <td>${fmt(d.createdAt)}</td>
        <td>${d.fullName}</td>
        <td>${d.partySize}</td>
      </tr>
    `;

    if(first){ greet(d.fullName); first=false; }
  });

  totalCount.textContent = total;
});

/******** UI HELPERS ********/
function greet(n){
  welcome.textContent = "Bienvenido, " + n;
  welcome.style.opacity=1;
  setTimeout(()=>welcome.style.opacity=.35,4000);
}

function fmt(ts){
  if(!ts) return "";
  return ts.toDate().toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"});
}
