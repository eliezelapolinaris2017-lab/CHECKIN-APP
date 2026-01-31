/******** CONFIG ********/

const firebaseConfig = {
apiKey: "PUT_KEY",
authDomain: "PUT_DOMAIN",
projectId: "PUT_ID"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

/******** PARAMS ********/
/* churchId viene por URL: ?church=oasis */

const params = new URLSearchParams(location.search);
const churchId = params.get("church") || "demo";

/******** AUTH SIMPLE ********/

firebase.auth().signInAnonymously();

/******** FORM ********/

const form = document.getElementById("checkinForm");

form.onsubmit = async e => {
e.preventDefault();

const fullName = fullNameInput.value.trim();
const partySize = Number(partySizeInput.value || 1);

await db.collection("churches")
.doc(churchId)
.collection("checkins")
.add({
fullName,
partySize,
createdAt: firebase.firestore.FieldValue.serverTimestamp()
});

form.reset();
};

/******** LIVE DISPLAY ********/

const rows = document.getElementById("rows");
const welcome = document.getElementById("welcome");
const totalCount = document.getElementById("totalCount");

db.collection("churches")
.doc(churchId)
.collection("checkins")
.orderBy("createdAt","desc")
.limit(50)
.onSnapshot(snap => {

rows.innerHTML = "";
let total = 0;
let first = true;

snap.forEach(doc => {
const d = doc.data();
total += d.partySize || 1;

const tr = document.createElement("tr");
tr.innerHTML = `
<td>${timeFmt(d.createdAt)}</td>
<td>${d.fullName}</td>
<td>${d.partySize}</td>
`;
rows.appendChild(tr);

if(first){
showWelcome(d.fullName);
first = false;
}
});

totalCount.textContent = total;
});

/******** HELPERS ********/

function showWelcome(name){
welcome.textContent = "Bienvenido " + name;
welcome.style.opacity = 1;
setTimeout(()=> welcome.style.opacity = .4, 4000);
}

function timeFmt(ts){
if(!ts) return "";
const d = ts.toDate();
return d.toLocaleTimeString();
}

/******** DOM REFS ********/

const fullNameInput = document.getElementById("fullName");
const partySizeInput = document.getElementById("partySize");
