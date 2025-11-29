/* -----------------------------------------------------
   FIREBASE INIT
----------------------------------------------------- */
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import {
  getDatabase,
  ref,
  child,
  get,
  set,
  update,
  remove,
  push
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyAZN4QdTuOpk8lEKsyPuhynqZ9-GJLDE0s",
  authDomain: "jaarplanning-ovn.firebaseapp.com",
  databaseURL: "https://jaarplanning-ovn-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "jaarplanning-ovn",
  storageBucket: "jaarplanning-ovn.firebasestorage.app",
  messagingSenderId: "526104562356",
  appId: "1:526104562356:web:ea211e722202d6383f65e1"
};

initializeApp(firebaseConfig);
const db = getDatabase();

/* -----------------------------------------------------
   VARIABELEN
----------------------------------------------------- */
let speltak = "";
let isAdmin = false;

let leden = [];
let jeugd = [];
let leiding = [];
let opkomsten = [];

const todayISO = new Date().toISOString().split("T")[0];

/* -----------------------------------------------------
   START
----------------------------------------------------- */
document.addEventListener("DOMContentLoaded", () => {
  speltak = document.body.dataset.speltak;
  document.getElementById("editButton").onclick = toggleAdmin;
  document.getElementById("addOpkomstRow").onclick = addNewOpkomst;
  document.getElementById("addMemberButton").onclick = addNewLid;

  loadData();
});

/* -----------------------------------------------------
   ADMIN TOGGLE
----------------------------------------------------- */
function toggleAdmin() {
  if (!isAdmin) {
    const pw = prompt("Wachtwoord:");
    if (pw !== "bevers2025") return;
    isAdmin = true;
  } else {
    isAdmin = false;
  }
  renderTable();
}

/* -----------------------------------------------------
   LADEN VAN DATA
----------------------------------------------------- */
async function loadData() {
  const snap = await get(child(ref(db), speltak));
  if (!snap.exists()) return;

  const data = snap.val();

  leden = Object.entries(data.leden || {}).map(([id, v]) => ({
    id,
    naam: v.naam,
    type: v.type === "jeugdlid" ? "jeugd" : v.type,
    volgorde: v.volgorde || 0
  }));

  jeugd = leden.filter(l => l.type === "jeugd").sort((a,b)=>a.volgorde-b.volgorde);
  leiding = leden.filter(l => l.type === "leiding").sort((a,b)=>a.volgorde-b.volgorde);

  opkomsten = Object.entries(data.opkomsten || {}).map(([id,v]) => ({ id, ...v }));
  opkomsten.sort((a,b)=>a.datum.localeCompare(b.datum));

  renderTable();
}

/* -----------------------------------------------------
   RENDER TABEL
----------------------------------------------------- */
function renderTable() {
  const headTop = document.getElementById("headerRowTop");
  const headBot = document.getElementById("headerRowBottom");
  const body = document.getElementById("tableBody");

  headTop.innerHTML = "";
  headBot.innerHTML = "";
  body.innerHTML = "";

  /* --- HEADER TOP --- */
  addTH(headTop, "🗑", 1, 2);
  addTH(headTop, "Datum", 1, 2);
  addTH(headTop, "Thema", 1, 2);
  addTH(headTop, "Bijzonderheden", 1, 2);
  addTH(headTop, "Start", 1, 2);
  addTH(headTop, "Eind", 1, 2);
  addTH(headTop, "Procor", 1, 2);
  addTH(headTop, "Bert 🧸", 1, 2);

  addTH(headTop, "JEUGD", jeugd.length, 1);
  addTH(headTop, "LEIDING", leiding.length, 1);

  /* --- HEADER BOTTOM --- */
  const empty = 8;
  for (let i=0;i<empty;i++) addTH(headBot, "");

  jeugd.forEach(j => addTH(headBot, j.naam));
  leiding.forEach(l => addTH(headBot, l.naam));

  /* --- BODY --- */
  let next = true;

  opkomsten.forEach(o => {
    const tr = document.createElement("tr");

    if (o.datum < todayISO) tr.classList.add("row-grey");
    else if (next) { tr.classList.add("row-next"); next = false; }

    if (o.typeOpkomst === "bijzonder") tr.classList.add("row-bijzonder");
    if (o.typeOpkomst === "kamp") tr.classList.add("row-kamp");

    /* DELETE BTN */
    const tdDel = document.createElement("td");
    tdDel.textContent = isAdmin ? "🗑" : "";
    tdDel.className = "delete-btn";
    if (isAdmin) tdDel.onclick = () => deleteOpkomst(o.id);
    tr.appendChild(tdDel);

    /* TEXT CEL HELPER */
    const addText = (value, field, type="text") => {
      const td = document.createElement("td");
      td.textContent = value || "";

      if (isAdmin) {
        td.classList.add("editable");
        td.onclick = () => editText(td, o, field, type);
      }

      tr.appendChild(td);
    };

    addText(o.datum, "datum", "date");
    addText(o.thema, "thema");
    addText(o.bijzonderheden, "bijzonderheden");
    addText(o.starttijd, "starttijd", "time");
    addText(o.eindtijd, "eindtijd", "time");

    /* PROCOR */
    const tdProcor = document.createElement("td");
    tdProcor.textContent = getNaam(o.procor);
    if (isAdmin) tdProcor.onclick = () => editProcor(tdProcor, o);
    tr.appendChild(tdProcor);

    /* BERT */
    const tdBert = document.createElement("td");
    tdBert.textContent = getNaam(o.bert_met);
    if (isAdmin) tdBert.onclick = () => editBert(tdBert, o);
    tr.appendChild(tdBert);

    /* JEUGD AANWEZIGHEID */
    jeugd.forEach(j => tr.appendChild(makePresenceCell(o, j.id)));

    /* LEIDING AANWEZIGHEID */
    leiding.forEach(l => tr.appendChild(makePresenceCell(o, "leiding-" + l.id)));

    body.appendChild(tr);
  });
}

/* -----------------------------------------------------
   HELPERS
----------------------------------------------------- */
function addTH(row, text, col=1, rowsp=1) {
  const th = document.createElement("th");
  th.colSpan = col;
  th.rowSpan = rowsp;
  th.textContent = text;
  row.appendChild(th);
}

function getNaam(id) {
  if (!id) return "";
  const f = leden.find(l => l.id === id);
  return f ? f.naam : "";
}

/* -----------------------------------------------------
   INLINE TEXT EDIT
----------------------------------------------------- */
function editText(td, opkomst, field, type) {
  const old = td.textContent;
  const input = document.createElement("input");
  input.type = type;
  input.value = old;

  td.textContent = "";
  td.appendChild(input);
  input.focus();

  input.onblur = async () => {
    const val = input.value;

    if (field === "datum") {
      await moveOpkomst(opkomst, val);
    } else {
      await update(ref(db, `${speltak}/opkomsten/${opkomst.id}`), {
        [field]: val
      });
    }

    loadData();
  };

  input.onkeydown = e => {
    if (e.key === "Enter") input.blur();
  };
}

/* -----------------------------------------------------
   PROCOR EDIT
----------------------------------------------------- */
function editProcor(td, o) {
  const sel = document.createElement("select");

  sel.innerHTML = `<option value=""></option>` +
    leiding.map(l=>`<option value="${l.id}">${l.naam}</option>`).join("");

  sel.value = o.procor || "";
  td.textContent = "";
  td.appendChild(sel);
  sel.focus();

  sel.onblur = async () => {
    await update(ref(db, `${speltak}/opkomsten/${o.id}`), { procor: sel.value });
    loadData();
  };
}

/* -----------------------------------------------------
   BERT EDIT
----------------------------------------------------- */
function editBert(td, o) {
  const sel = document.createElement("select");

  sel.innerHTML = `<option value=""></option>` +
    jeugd.map(j=>`<option value="${j.id}">${j.naam}</option>`).join("");

  sel.value = o.bert_met || "";
  td.textContent = "";
  td.appendChild(sel);
  sel.focus();

  sel.onblur = async () => {
    await update(ref(db, `${speltak}/opkomsten/${o.id}`), { bert_met: sel.value });
    loadData();
  };
}

/* -----------------------------------------------------
   AANWEZIGHEID
----------------------------------------------------- */
function makePresenceCell(o, key) {
  if (!o.aanwezigheid) o.aanwezigheid = {};
  if (!o.aanwezigheid[key]) o.aanwezigheid[key] = "onbekend";

  const state = o.aanwezigheid[key];
  const td = document.createElement("td");
  td.classList.add("presence-cell");

  td.textContent = state === "aanwezig" ? "✔" :
                   state === "afwezig" ? "✖" : "–";

  if (isAdmin) {
    td.onclick = async () => {
      const next = state === "onbekend" ? "aanwezig" :
                   state === "aanwezig" ? "afwezig" : "onbekend";

      await update(ref(db, `${speltak}/opkomsten/${o.id}/aanwezigheid`), {
        [key]: next
      });

      loadData();
    };
  }

  return td;
}

/* -----------------------------------------------------
   DATUM VERANDEREN (key move)
----------------------------------------------------- */
async function moveOpkomst(o, newDate) {
  const oldRef = ref(db, `${speltak}/opkomsten/${o.id}`);
  const newRef = ref(db, `${speltak}/opkomsten/${newDate}`);

  const newObj = {...o, datum: newDate};

  await set(newRef, newObj);
  await remove(oldRef);
}

/* -----------------------------------------------------
   DELETE
----------------------------------------------------- */
async function deleteOpkomst(id) {
  if (!confirm("Verwijderen?")) return;
  await remove(ref(db, `${speltak}/opkomsten/${id}`));
  loadData();
}

/* -----------------------------------------------------
   NIEUWE OPNKOMST
----------------------------------------------------- */
async function addNewOpkomst() {
  if (!isAdmin) return;

  const id = "opk-" + Date.now();

  const nieuw = {
    datum: todayISO,
    thema: "",
    bijzonderheden: "",
    starttijd: "10:30",
    eindtijd: "12:30",
    procor: "",
    bert_met: "",
    typeOpkomst: "normaal",
    aanwezigheid: {}
  };

  jeugd.forEach(j => nieuw.aanwezigheid[j.id] = "onbekend");
  leiding.forEach(l => nieuw.aanwezigheid["leiding-"+l.id] = "onbekend");

  await set(ref(db, `${speltak}/opkomsten/${id}`), nieuw);
  loadData();
}

/* -----------------------------------------------------
   NIEUW LID
----------------------------------------------------- */
async function addNewLid() {
  if (!isAdmin) return;

  const naam = prompt("Naam lid:");
  if (!naam) return;

  const type = prompt("Type (jeugd / leiding):", "jeugd");
  if (!type) return;

  const id = push(ref(db, `${speltak}/leden`)).key;

  await set(ref(db, `${speltak}/leden/${id}`), {
    naam,
    type,
    volgorde: leden.length + 1
  });

  // voeg toe aan aanwezigheid
  for (const o of opkomsten) {
    if (type === "leiding") {
      await update(ref(db, `${speltak}/opkomsten/${o.id}/aanwezigheid`), {
        ["leiding-"+id]: "onbekend"
      });
    } else {
      await update(ref(db, `${speltak}/opkomsten/${o.id}/aanwezigheid`), {
        [id]: "onbekend"
      });
    }
  }

  loadData();
}
