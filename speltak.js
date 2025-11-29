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

/* ---------------------------------------------------
   FIREBASE CONFIG
--------------------------------------------------- */
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

/* ---------------------------------------------------
   VARIABELEN
--------------------------------------------------- */

let isAdmin = false;
let speltak = "";
let leden = [];
let jeugd = [];
let leiding = [];
let opkomsten = [];
let vandaagISO = new Date().toISOString().split("T")[0];

document.addEventListener("DOMContentLoaded", start);

async function start() {
  speltak = document.body.dataset.speltak;
  document.getElementById("editButton").addEventListener("click", toggleAdmin);

  loadData();
}

/* ---------------------------------------------------
   ADMIN MODUS
--------------------------------------------------- */

function toggleAdmin() {
  if (!isAdmin) {
    const pw = prompt("Wachtwoord:");
    if (pw === "bevers2025") {
      isAdmin = true;
    } else { return alert("Fout wachtwoord."); }
  } else {
    isAdmin = false;
  }
  renderTable();
}

/* ---------------------------------------------------
   DATA LADEN
--------------------------------------------------- */

async function loadData() {
  const snap = await get(child(ref(db), speltak));
  if (!snap.exists()) return;

  let data = snap.val();

  leden = Object.entries(data.leden || {}).map(([id, v]) => ({
    id, naam: v.naam, type: v.type, volgorde: v.volgorde
  }));

  jeugd = leden.filter(l => l.type === "jeugd").sort((a,b)=>a.volgorde-b.volgorde);
  leiding = leden.filter(l => l.type === "leiding").sort((a,b)=>a.volgorde-b.volgorde);

  opkomsten = Object.entries(data.opkomsten || {}).map(([id, v]) => ({
    id, ...v
  }));

  sortOpkomsten();
  renderTable();
}

/* ---------------------------------------------------
   SORTEREN OPNKOMSTEN
--------------------------------------------------- */
function sortOpkomsten() {
  const toekomst = opkomsten.filter(o => o.datum >= vandaagISO);
  const verleden = opkomsten.filter(o => o.datum < vandaagISO);

  toekomst.sort((a,b)=>a.datum.localeCompare(b.datum));
  verleden.sort((a,b)=>a.datum.localeCompare(b.datum));

  opkomsten = [...toekomst, ...verleden];
}

/* ---------------------------------------------------
   TABEL RENDEREN
--------------------------------------------------- */

function renderTable() {
  const headTop = document.getElementById("headerRowTop");
  const headBot = document.getElementById("headerRowBottom");
  const body = document.getElementById("tableBody");

  headTop.innerHTML = "";
  headBot.innerHTML = "";
  body.innerHTML = "";

  /* -------- HEADER ROWN 1 (SUBHEADERS) -------- */
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

  /* -------- HEADER ROW 2 (NAMEN) -------- */
  addTH(headBot, "");  // prullenbak
  addTH(headBot, "");  // datum
  addTH(headBot, "");  // thema
  addTH(headBot, "");  // bijz
  addTH(headBot, "");  // start
  addTH(headBot, "");  // eind
  addTH(headBot, "");  // procor
  addTH(headBot, "");  // bert

  jeugd.forEach(l => addTH(headBot, l.naam));
  leiding.forEach(l => addTH(headBot, l.naam));

  /* -------- BODY ROWS -------- */
  opkomsten.forEach((o, index) => {
    const tr = document.createElement("tr");

    // kleur
    if (o.datum < vandaagISO) tr.classList.add("greyed");
    else if (index === 0) tr.classList.add("next");
    if (o.typeOpkomst === "bijzonder") tr.classList.add("bijzonder");
    if (o.typeOpkomst === "kamp") tr.classList.add("kamp");

    /* DELETE BTN */
    const del = document.createElement("td");
    del.className = "delete-btn";
    del.textContent = isAdmin ? "🗑" : "";
    if (isAdmin) del.onclick = () => deleteOpkomst(o.id);
    tr.appendChild(del);

    /* INLINE CEL FUNCTIE */
    const addEditable = (value, field, type="text") => {
      const td = document.createElement("td");
      td.textContent = value || "";
      if (isAdmin) {
        td.classList.add("editable");
        td.onclick = () => editCell(td, o, field, type);
      }
      tr.appendChild(td);
    };

    addEditable(o.datum, "datum", "date");
    addEditable(o.thema, "thema", "text");
    addEditable(o.bijzonderheden, "bijzonderheden", "text");
    addEditable(o.starttijd, "starttijd", "time");
    addEditable(o.eindtijd, "eindtijd", "time");

    /* PROCOR (dropdown) */
    const tdProcor = document.createElement("td");
    tdProcor.textContent = getNaam(o.procor) || "";
    if (isAdmin) tdProcor.onclick = () => editProcor(tdProcor, o);
    tr.appendChild(tdProcor);

    /* BERT (dropdown jeugd) */
    const tdBert = document.createElement("td");
    tdBert.textContent = getNaam(o.bert_met) || "";
    if (isAdmin) tdBert.onclick = () => editBert(tdBert, o);
    tr.appendChild(tdBert);

    /* JEUGD aanwezigheid */
    jeugd.forEach(l => tr.appendChild(createPresenceCell(o, l.id)));

    /* LEIDING aanwezigheid */
    leiding.forEach(l => {
      tr.appendChild(createPresenceCell(o, "leiding-"+l.id));
    });

    body.appendChild(tr);
  });
}

/* ---------------------------------------------------
   HEADER HELPER
--------------------------------------------------- */
function addTH(row, text, colspan=1, rowspan=1) {
  const th = document.createElement("th");
  th.textContent = text;
  th.colSpan = colspan;
  th.rowSpan = rowspan;
  row.appendChild(th);
}

/* ---------------------------------------------------
   INLINE EDITING
--------------------------------------------------- */

function editCell(td, opkomst, field, type) {
  const oldVal = td.textContent;
  const input = document.createElement("input");
  input.type = type;
  input.value = oldVal;
  td.textContent = "";
  td.appendChild(input);
  input.focus();

  input.onblur = async () => {
    let val = input.value;
    if (field === "datum" && val.length === 10) {
      await saveField(opkomst, field, val);
      loadData();
    } else {
      await saveField(opkomst, field, val);
      td.textContent = val;
    }
  };

  input.onkeydown = e => {
    if (e.key === "Enter") input.blur();
  };
}

/* ---------------------------------------------------
   PROCOR DROPDOWN
--------------------------------------------------- */
function editProcor(td, o) {
  const select = document.createElement("select");

  select.innerHTML = `<option value=""></option>` +
    leiding.map(l => `<option value="${l.id}">${l.naam}</option>`).join("");

  select.value = o.procor || "";
  td.textContent = "";
  td.appendChild(select);
  select.focus();

  select.onblur = async () => {
    await saveField(o, "procor", select.value);
    loadData();    
  };
}

/* ---------------------------------------------------
   BERT DROPDOWN
--------------------------------------------------- */
function editBert(td, o) {
  const select = document.createElement("select");

  select.innerHTML = `<option value=""></option>` +
    jeugd.map(l => `<option value="${l.id}">${l.naam}</option>`).join("");

  select.value = o.bert_met || "";
  td.textContent = "";
  td.appendChild(select);
  select.focus();

  select.onblur = async () => {
    await saveField(o, "bert_met", select.value);
    loadData();
  };
}

/* ---------------------------------------------------
   HELPERS
--------------------------------------------------- */
function getNaam(id) {
  if (!id) return "";
  const l = leden.find(x => x.id === id);
  return l ? l.naam : "";
}

/* ---------------------------------------------------
   AANWEZIGHEID
--------------------------------------------------- */
function createPresenceCell(o, lidId) {
  const td = document.createElement("td");
  td.classList.add("presence-cell");

  const state = o.aanwezigheid?.[lidId] || "onbekend";
  td.textContent = state === "aanwezig" ? "✔" :
                   state === "afwezig"  ? "✖" : "–";

  if (isAdmin) {
    td.onclick = async () => {
      const next = state === "onbekend" ? "aanwezig" :
                   state === "aanwezig"  ? "afwezig" : "onbekend";

      await update(ref(db, `${speltak}/opkomsten/${o.id}/aanwezigheid`), {
        [lidId]: next
      });
      loadData();
    };
  }

  return td;
}

/* ---------------------------------------------------
   OPSLAAN VAN VELD
--------------------------------------------------- */
async function saveField(opkomst, field, value) {
  await update(ref(db, `${speltak}/opkomsten/${opkomst.id}`), {
    [field]: value
  });
}

/* ---------------------------------------------------
   VERWIJDEREN
--------------------------------------------------- */
async function deleteOpkomst(id) {
  if (!confirm("Weet je zeker dat je dit wilt verwijderen?")) return;
  await remove(ref(db, `${speltak}/opkomsten/${id}`));
  loadData();
}

/* ---------------------------------------------------
   NIEUWE OPNKOMST VIA + RIJ
--------------------------------------------------- */
document.getElementById("addOpkomstRow").onclick = () => {
  if (!isAdmin) return;

  const today = new Date().toISOString().split("T")[0];

  const nieuw = {
    datum: today,
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

  set(
    ref(db, `${speltak}/opkomsten/${today}-${Date.now()}`),
    nieuw
  ).then(loadData);
};

