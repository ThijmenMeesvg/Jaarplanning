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
  document.getElementById("addMemberButton").onclick = addNewMember;

  loadData();
});

/* -----------------------------------------------------
   ADMIN MODUS
----------------------------------------------------- */
function toggleAdmin() {
  if (!isAdmin) {
    const pw = prompt("Wachtwoord:");
    if (pw !== "bevers2025") return;
    isAdmin = true;
  } else {
    isAdmin = false;
  }

  document.getElementById("addOpkomstRow").style.display = isAdmin ? "table-row" : "none";
  document.getElementById("addMemberButton").style.display = isAdmin ? "inline-block" : "none";

  renderTable();
}

/* -----------------------------------------------------
   DATA LADEN
----------------------------------------------------- */
async function loadData() {
  const snap = await get(child(ref(db), speltak));
  const data = snap.exists() ? snap.val() : { leden: {}, opkomsten: {} };

  // Eenvoudig: neem opgeslagen type direct over ("jeugd" of "leiding")
  leden = Object.entries(data.leden || {}).map(([id, v]) => ({
    id,
    naam: v.naam,
    type: v.type || "jeugd",
    volgorde: v.volgorde || 0
  }));

  jeugd = leden.filter(l => l.type === "jeugd").sort((a, b) => a.volgorde - b.volgorde);
  leiding = leden.filter(l => l.type === "leiding").sort((a, b) => a.volgorde - b.volgorde);

  opkomsten = Object.entries(data.opkomsten || {}).map(([id, v]) => ({ id, ...v }));
  opkomsten.sort((a, b) => a.datum.localeCompare(b.datum));

  renderTable();
}

/* -----------------------------------------------------
   TABEL RENDEREN
----------------------------------------------------- */
function renderTable() {
  const headTop = document.getElementById("headerRowTop");
  const headBot = document.getElementById("headerRowBottom");
  const body = document.getElementById("tableBody");

  headTop.innerHTML = "";
  headBot.innerHTML = "";
  body.innerHTML = "";

  /* -------- HEADER TOP -------- */
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

  /* -------- HEADER BOTTOM -------- */
  for (let i = 0; i < 8; i++) addTH(headBot, "");

  jeugd.forEach(j => addTH(headBot, j.naam));
  leiding.forEach(l => addTH(headBot, l.naam));

  /* -------- BODY -------- */
  let firstFuture = true;

  opkomsten.forEach(opkomst => {
    ensurePresence(opkomst);

    const tr = document.createElement("tr");

    if (opkomst.datum < todayISO) {
      tr.classList.add("row-grey");
    } else if (firstFuture) {
      tr.classList.add("row-next");
      firstFuture = false;
    }

    addDeleteCell(tr, opkomst);

    addTextCell(tr, opkomst, "datum", "date");
    addTextCell(tr, opkomst, "thema", "text");
    addTextCell(tr, opkomst, "bijzonderheden", "text");
    addTextCell(tr, opkomst, "starttijd", "time");
    addTextCell(tr, opkomst, "eindtijd", "time");

    addProcorCell(tr, opkomst);
    addBertCell(tr, opkomst);

    jeugd.forEach(j => tr.appendChild(makePresenceCell(opkomst, j.id)));
    leiding.forEach(l => tr.appendChild(makePresenceCell(opkomst, "leiding-" + l.id)));

    body.appendChild(tr);
  });
}

/* -----------------------------------------------------
   HEADER CEL HELPER
----------------------------------------------------- */
function addTH(row, text, col = 1, rowsp = 1) {
  const th = document.createElement("th");
  th.colSpan = col;
  th.rowSpan = rowsp;
  th.textContent = text;
  row.appendChild(th);
}

/* -----------------------------------------------------
   DELETE
----------------------------------------------------- */
function addDeleteCell(tr, o) {
  const td = document.createElement("td");
  td.textContent = isAdmin ? "🗑" : "";
  td.className = "delete-btn";

  if (isAdmin) {
    td.onclick = async () => {
      if (confirm("Weet je zeker dat je deze opkomst wilt verwijderen?")) {
        await remove(ref(db, `${speltak}/opkomsten/${o.id}`));
        loadData();
      }
    };
  }

  tr.appendChild(td);
}

/* -----------------------------------------------------
   INLINE TEXT CEL
----------------------------------------------------- */
function addTextCell(tr, o, field, type) {
  const td = document.createElement("td");
  td.textContent = o[field] || "";

  if (isAdmin) {
    td.classList.add("editable");
    td.onclick = () => editText(td, o, field, type);
  }

  tr.appendChild(td);
}

function editText(td, o, field, type) {
  const old = td.textContent;
  const input = document.createElement("input");
  input.type = type;
  input.value = old;

  td.innerHTML = "";
  td.appendChild(input);
  input.focus();

  input.onblur = async () => {
    const val = input.value;

    if (field === "datum") {
      await moveOpkomst(o, val);
    } else {
      await update(ref(db, `${speltak}/opkomsten/${o.id}`), { [field]: val });
    }

    loadData();
  };

  input.onkeydown = (e) => {
    if (e.key === "Enter") input.blur();
  };
}

/* -----------------------------------------------------
   PROCOR
----------------------------------------------------- */
function addProcorCell(tr, o) {
  const td = document.createElement("td");
  const label = o.procor ? getNaam(o.procor) : (isAdmin ? "(kies Procor)" : "");
  td.textContent = label;

  if (isAdmin) {
    td.classList.add("editable");
    td.onclick = () => editProcor(td, o);
  }

  tr.appendChild(td);
}

function editProcor(td, o) {
  const sel = document.createElement("select");
  sel.innerHTML =
    `<option value="">(kies Procor)</option>` +
    leiding.map(l => `<option value="${l.id}">${l.naam}</option>`).join("");

  sel.value = o.procor || "";
  td.innerHTML = "";
  td.appendChild(sel);
  sel.focus();

  sel.onblur = async () => {
    await update(ref(db, `${speltak}/opkomsten/${o.id}`), { procor: sel.value });
    loadData();
  };
}

/* -----------------------------------------------------
   BERT
----------------------------------------------------- */
function addBertCell(tr, o) {
  const td = document.createElement("td");
  const label = o.bert_met ? getNaam(o.bert_met) : (isAdmin ? "(kies Bert)" : "");
  td.textContent = label;

  if (isAdmin) {
    td.classList.add("editable");
    td.onclick = () => editBert(td, o);
  }

  tr.appendChild(td);
}

function editBert(td, o) {
  const sel = document.createElement("select");

  sel.innerHTML =
    `<option value="">(kies Bert)</option>` +
    jeugd.map(j => `<option value="${j.id}">${j.naam}</option>`).join("");

  sel.value = o.bert_met || "";
  td.innerHTML = "";
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
function ensurePresence(o) {
  if (!o.aanwezigheid) o.aanwezigheid = {};

  jeugd.forEach(j => {
    if (!o.aanwezigheid[j.id]) o.aanwezigheid[j.id] = "onbekend";
  });

  leiding.forEach(l => {
    const key = "leiding-" + l.id;
    if (!o.aanwezigheid[key]) o.aanwezigheid[key] = "onbekend";
  });

  update(ref(db, `${speltak}/opkomsten/${o.id}`), {
    aanwezigheid: o.aanwezigheid
  });
}

function makePresenceCell(o, key) {
  const state = o.aanwezigheid[key];
  const td = document.createElement("td");
  td.classList.add("presence-cell");

  td.textContent =
    state === "aanwezig"
      ? "✔"
      : state === "afwezig"
      ? "✖"
      : "–";

  // Altijd klikbaar (ouders moeten dit kunnen invullen)
  td.onclick = async () => {
    const next =
      state === "onbekend"
        ? "aanwezig"
        : state === "aanwezig"
        ? "afwezig"
        : "onbekend";

    await update(ref(db, `${speltak}/opkomsten/${o.id}/aanwezigheid`), {
      [key]: next
    });

    loadData();
  };

  return td;
}

/* -----------------------------------------------------
   DATUM WIJZIGEN (KEY MOVE)
----------------------------------------------------- */
async function moveOpkomst(o, newDate) {
  const oldRef = ref(db, `${speltak}/opkomsten/${o.id}`);
  const newId = newDate;
  const newRef = ref(db, `${speltak}/opkomsten/${newId}`);

  const updated = { ...o, datum: newDate };
  delete updated.id;

  await set(newRef, updated);
  await remove(oldRef);
}

/* -----------------------------------------------------
   OPKOMST TOEVOEGEN
----------------------------------------------------- */
async function addNewOpkomst() {
  if (!isAdmin) return;

  const id = todayISO + "--" + Date.now();

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

  jeugd.forEach(j => (nieuw.aanwezigheid[j.id] = "onbekend"));
  leiding.forEach(l => (nieuw.aanwezigheid["leiding-" + l.id] = "onbekend"));

  await set(ref(db, `${speltak}/opkomsten/${id}`), nieuw);
  loadData();
}

/* -----------------------------------------------------
   LIDTYPE KIEZEN (OVERLAY MET RADIOBUTTONS)
----------------------------------------------------- */
function chooseMemberType() {
  return new Promise(resolve => {
    const overlay = document.createElement("div");
    overlay.style.position = "fixed";
    overlay.style.inset = "0";
    overlay.style.background = "rgba(0,0,0,0.4)";
    overlay.style.display = "flex";
    overlay.style.alignItems = "center";
    overlay.style.justifyContent = "center";
    overlay.style.zIndex = "9999";

    const box = document.createElement("div");
    box.style.background = "white";
    box.style.padding = "16px 20px";
    box.style.borderRadius = "8px";
    box.style.minWidth = "260px";
    box.style.boxShadow = "0 4px 12px rgba(0,0,0,0.25)";
    box.innerHTML = `
      <h3 style="margin-top:0;">Type lid</h3>
      <p>Is dit een jeugdlid of leiding?</p>
      <label style="display:block;margin:4px 0;">
        <input type="radio" name="lidtype" value="jeugd" checked>
        Jeugdlid
      </label>
      <label style="display:block;margin:4px 0;">
        <input type="radio" name="lidtype" value="leiding">
        Leiding
      </label>
      <div style="margin-top:12px;text-align:right;">
        <button type="button" id="cancelTypeBtn" style="margin-right:8px;">Annuleer</button>
        <button type="button" id="okTypeBtn">OK</button>
      </div>
    `;

    overlay.appendChild(box);
    document.body.appendChild(overlay);

    const cleanup = () => {
      document.body.removeChild(overlay);
    };

    box.querySelector("#cancelTypeBtn").onclick = () => {
      cleanup();
      resolve(null);
    };

    box.querySelector("#okTypeBtn").onclick = () => {
      const checked = box.querySelector('input[name="lidtype"]:checked');
      const val = checked ? checked.value : null;
      cleanup();
      resolve(val);
    };
  });
}

/* -----------------------------------------------------
   LID TOEVOEGEN
----------------------------------------------------- */
async function addNewMember() {
  if (!isAdmin) return;

  const naam = prompt("Naam lid:");
  if (!naam) return;

  const type = await chooseMemberType();
  if (!type) return; // geannuleerd

  const id = push(ref(db, `${speltak}/leden`)).key;

  await set(ref(db, `${speltak}/leden/${id}`), {
    naam,
    type,
    volgorde: leden.length + 1
  });

  // Aanwezigheid voor alle bestaande opkomsten aanvullen
  for (const o of opkomsten) {
    if (type === "leiding") {
      await update(ref(db, `${speltak}/opkomsten/${o.id}/aanwezigheid`), {
        ["leiding-" + id]: "onbekend"
      });
    } else {
      await update(ref(db, `${speltak}/opkomsten/${o.id}/aanwezigheid`), {
        [id]: "onbekend"
      });
    }
  }

  loadData();
}

/* -----------------------------------------------------
   NAAM HELPER
----------------------------------------------------- */
function getNaam(id) {
  if (!id) return "";
  const f = leden.find(l => l.id === id);
  return f ? f.naam : "";
}

/* -----------------------------------------------------
   EINDE BESTAND
----------------------------------------------------- */
