/* -----------------------------------------------------
   FIREBASE
----------------------------------------------------- */
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import {
  getDatabase,
  ref,
  child,
  get,
  set,
  update,
  remove
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

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

/* -----------------------------------------------------
   VARIABELEN
----------------------------------------------------- */
let speltak = "";
let leden = [];
let jeugd = [];
let leiding = [];
let opkomsten = [];
let isAdmin = false;

const todayISO = new Date().toISOString().split("T")[0];

/* -----------------------------------------------------
   START
----------------------------------------------------- */
document.addEventListener("DOMContentLoaded", () => {
  speltak = document.body.dataset.speltak;
  document.getElementById("editButton").onclick = toggleAdmin;
  document.getElementById("addOpkomstRow").onclick = addNewOpkomst;

  loadData();
});

/* -----------------------------------------------------
   LAAD ALLE DATA
----------------------------------------------------- */
async function loadData() {
  const snap = await get(child(ref(db), speltak));
  if (!snap.exists()) return;

  const data = snap.val();

  leden = Object.entries(data.leden || {}).map(([id, v]) => ({
    id,
    naam: v.naam,
    type: v.type,
    volgorde: v.volgorde || 0
  }));

  jeugd = leden.filter(l => l.type === "jeugd").sort((a,b)=>a.volgorde-b.volgorde);
  leiding = leden.filter(l => l.type === "leiding").sort((a,b)=>a.volgorde-b.volgorde);

  opkomsten = Object.entries(data.opkomsten || {}).map(([id,v]) => ({ id, ...v }));

  // Sorteren op datum
  opkomsten.sort((a,b)=>a.datum.localeCompare(b.datum));

  renderTable();
}

/* -----------------------------------------------------
   ADMIN MODUS
----------------------------------------------------- */
function toggleAdmin() {
  if (!isAdmin) {
    const pw = prompt("Wachtwoord:");
    if (pw !== "bevers2025") return alert("Incorrect wachtwoord.");
    isAdmin = true;
  } else {
    isAdmin = false;
  }
  renderTable();
}

/* -----------------------------------------------------
   TABEL BOUWEN
----------------------------------------------------- */
function renderTable() {
  const headTop = document.getElementById("headerRowTop");
  const headBot = document.getElementById("headerRowBottom");
  const body = document.getElementById("tableBody");

  headTop.innerHTML = "";
  headBot.innerHTML = "";
  body.innerHTML = "";

  /* ------------------- HEADER (rij 1) ------------------- */
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

  /* ------------------- HEADER (rij 2) ------------------- */
  const empties = 8;
  for (let i=0;i<empties;i++) addTH(headBot, "");

  jeugd.forEach(j => addTH(headBot, j.naam));
  leiding.forEach(l => addTH(headBot, l.naam));

  /* ------------------- BODY ------------------- */
  let firstFuture = true;

  opkomsten.forEach(o => {
    const tr = document.createElement("tr");

    // kleuring
    if (o.datum < todayISO) tr.classList.add("row-grey");
    else if (firstFuture) { tr.classList.add("row-next"); firstFuture = false; }
    if (o.typeOpkomst === "bijzonder") tr.classList.add("row-bijzonder");
    if (o.typeOpkomst === "kamp") tr.classList.add("row-kamp");

    /* DELETE BTN */
    const del = document.createElement("td");
    del.className = "delete-btn";
    del.textContent = isAdmin ? "🗑" : "";
    if (isAdmin) del.onclick = () => deleteOpkomst(o.id);
    tr.appendChild(del);

    /* INLINE TEXT CEL -------------------------------------------------- */
    const addEditable = (value, field, type="text") => {
      const td = document.createElement("td");
      td.textContent = value || "";
      if (isAdmin) {
        td.classList.add("editable");
        td.onclick = () => editTextCell(td, o, field, type);
      }
      tr.appendChild(td);
    };

    addEditable(o.datum, "datum", "date");
    addEditable(o.thema, "thema");
    addEditable(o.bijzonderheden, "bijzonderheden");
    addEditable(o.starttijd, "starttijd", "time");
    addEditable(o.eindtijd, "eindtijd", "time");

    /* PROCOR DROPDOWN -------------------------------------------------- */
    const tdProcor = document.createElement("td");
    tdProcor.textContent = getNaam(o.procor) || "";
    if (isAdmin) tdProcor.onclick = () => editProcorCell(tdProcor, o);
    tr.appendChild(tdProcor);

    /* BERT DROPDOWN ------------------------------------------------------ */
    const tdBert = document.createElement("td");
    tdBert.textContent = getNaam(o.bert_met) || "";
    if (isAdmin) tdBert.onclick = () => editBertCell(tdBert, o);
    tr.appendChild(tdBert);

    /* AANWEZIGHEID -------------------------------------------------------- */
    jeugd.forEach(j => tr.appendChild(makePresenceCell(o, j.id)));
    leiding.forEach(l => tr.appendChild(makePresenceCell(o, "leiding-"+l.id)));

    body.appendChild(tr);
  });
}

/* -----------------------------------------------------
   HELPERS
----------------------------------------------------- */
function addTH(row, text, colspan=1, rowspan=1) {
  const th = document.createElement("th");
  th.colSpan = colspan;
  th.rowSpan = rowspan;
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
function editTextCell(td, opkomst, field, type) {
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
   PROCOR DROPDOWN
----------------------------------------------------- */
function editProcorCell(td, o) {
  const sel = document.createElement("select");
  sel.innerHTML = `<option value=""></option>` +
    leiding.map(l=>`<option value="${l.id}">${l.naam}</option>`).join("");

  sel.value = o.procor || "";
  td.textContent = "";
  td.appendChild(sel);
  sel.focus();

  sel.onblur = async () => {
    await update(ref(db, `${speltak}/opkomsten/${o.id}`), {
      procor: sel.value
    });
    loadData();
  };
}

/* -----------------------------------------------------
   BERT DROPDOWN
----------------------------------------------------- */
function editBertCell(td, o) {
  const sel = document.createElement("select");
  sel.innerHTML = `<option value=""></option>` +
    jeugd.map(j=>`<option value="${j.id}">${j.naam}</option>`).join("");

  sel.value = o.bert_met || "";
  td.textContent = "";
  td.appendChild(sel);
  sel.focus();

  sel.onblur = async () => {
    await update(ref(db, `${speltak}/opkomsten/${o.id}`), {
      bert_met: sel.value
    });
    loadData();
  };
}

/* -----------------------------------------------------
   AANWEZIGHEID
----------------------------------------------------- */
function makePresenceCell(o, lidId) {
  if (!o.aanwezigheid) o.aanwezigheid = {};
  if (!o.aanwezigheid[lidId]) o.aanwezigheid[lidId] = "onbekend";

  const td = document.createElement("td");
  td.classList.add("presence-cell");

  const state = o.aanwezigheid[lidId];

  td.textContent = state === "aanwezig" ? "✔" :
                   state === "afwezig" ? "✖" : "–";

  if (isAdmin) {
    td.onclick = async () => {
      const next = state === "onbekend" ? "aanwezig" :
                   state === "aanwezig" ? "afwezig" : "onbekend";

      await update(ref(db, `${speltak}/opkomsten/${o.id}/aanwezigheid`), {
        [lidId]: next
      });

      loadData();
    };
  }

  return td;
}

/* -----------------------------------------------------
   DATUM WIJZIGEN (VERPLAATS KEY)
----------------------------------------------------- */
async function moveOpkomst(o, newDate) {
  const oldPath = `${speltak}/opkomsten/${o.id}`;
  const newId = `${newDate}`;

  const clone = {...o, datum: newDate};

  await set(ref(db, `${speltak}/opkomsten/${newId}`), clone);
  await remove(ref(db, oldPath));
}

/* -----------------------------------------------------
   VERWIJDEREN
----------------------------------------------------- */
async function deleteOpkomst(id) {
  if (!confirm("Weet je zeker dat je deze opkomst wilt verwijderen?")) return;
  await remove(ref(db, `${speltak}/opkomsten/${id}`));
  loadData();
}

/* -----------------------------------------------------
   NIEUWE OPNKOMST
----------------------------------------------------- */
async function addNewOpkomst() {
  if (!isAdmin) return;

  const now = Date.now();
  const id = `opk-${now}`;
  const datum = todayISO;

  const nieuw = {
    datum,
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
