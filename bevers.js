/******************************************************
 *  BEVERS – COMPLETE ADMIN & VIEW SYSTEM
 *  Firebase Realtime Database
 ******************************************************/

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

/* ---------------------------------------------------
   CONFIG + INITIALISATIE
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

const ADMIN_PASSWORD = "bevers2025";   // <──── pas zelf aan indien gewenst

/* ---------------------------------------------------
   VARIABELEN
--------------------------------------------------- */

let leden = [];
let jeugdleden = [];
let leidingleden = [];
let opkomsten = [];
let isAdmin = false;

/* ---------------------------------------------------
   START BIJ LADEN
--------------------------------------------------- */

document.addEventListener("DOMContentLoaded", () => {
  isAdmin = localStorage.getItem("beversAdmin") === "true";

  document.getElementById("editModeButton").addEventListener("click", toggleEditMode);

  document.getElementById("btnAddOpkomst").addEventListener("click", () => openModal("modalAddOpkomst"));
  document.getElementById("btnAddLid").addEventListener("click", () => openModal("modalAddLid"));

  document.querySelectorAll(".btn-cancel").forEach(btn => {
    btn.addEventListener("click", e => closeModal(e.target.dataset.close));
  });

  document.getElementById("saveAddOpkomst").addEventListener("click", saveNewOpkomst);
  document.getElementById("saveEditOpkomst").addEventListener("click", saveEditOpkomst);
  document.getElementById("saveAddLid").addEventListener("click", saveNewLid);
  document.getElementById("saveEditLid").addEventListener("click", saveEditLid);

  loadAllData();
  updateAdminUI();
});

/* ---------------------------------------------------
   DATA LADEN
--------------------------------------------------- */

async function loadAllData() {
  const snapshot = await get(child(ref(db), "bevers"));
  if (!snapshot.exists()) return;

  const data = snapshot.val();

  leden = Object.entries(data.leden || {}).map(([id, v]) => ({
    id,
    naam: v.naam,
    type: v.type,
    volgorde: v.volgorde || 0
  }));

  jeugdleden = leden.filter(l => l.type === "jeugd").sort((a, b) => a.volgorde - b.volgorde);
  leidingleden = leden.filter(l => l.type === "leiding").sort((a, b) => a.volgorde - b.volgorde);

  opkomsten = Object.entries(data.opkomsten || {}).map(([id, v]) => ({
    id,
    ...v
  }));

  sortOpkomsten();
  renderTable();
  renderAdminLedenList();
  renderAdminOpkomstenList();
  loadSelectOptions();
}

/* ---------------------------------------------------
   OPNIEUW SORTEREN
--------------------------------------------------- */

function sortOpkomsten() {
  const vandaag = new Date().toISOString().split("T")[0];

  const toekomst = opkomsten.filter(o => o.datum >= vandaag);
  const verleden = opkomsten.filter(o => o.datum < vandaag);

  toekomst.sort((a, b) => a.datum.localeCompare(b.datum));
  verleden.sort((a, b) => a.datum.localeCompare(b.datum));

  opkomsten = [...toekomst, ...verleden];
}

/* ---------------------------------------------------
   TABEL BOUWEN
--------------------------------------------------- */

function renderTable() {
  const head = document.getElementById("planning-head-row");
  const body = document.getElementById("planning-body");

  head.innerHTML = "";
  body.innerHTML = "";

  addHead("Datum");
  addHead("Thema");
  addHead("Bijzonderheden");
  addHead("Start");
  addHead("Eind");
  addHead("Aanw. jeugd");
  addHead("Aanw. leiding");

  jeugdleden.forEach(l => addHead(l.naam));
  leidingleden.forEach(l => addHead(l.naam));

  addHead("Bert");

  opkomsten.forEach(opkomst => {
    const tr = document.createElement("tr");
    colorOpkomstRow(opkomst, tr);

    addCell(tr, formatDate(opkomst.datum));
    addCell(tr, opkomst.thema);
    addCell(tr, opkomst.bijzonderheden || "");
    addCell(tr, opkomst.starttijd);
    addCell(tr, opkomst.eindtijd);

    addCell(tr, countAanwezig(opkomst, jeugdleden));
    addCell(tr, countAanwezig(opkomst, leidingleden));

    jeugdleden.forEach(l => addPresenceCell(tr, opkomst, l.id));
    leidingleden.forEach(l => addPresenceCell(tr, opkomst, "leiding-" + l.id));

    addBertCell(tr, opkomst);

    body.appendChild(tr);
  });
}

function addHead(label) {
  const th = document.createElement("th");
  th.textContent = label;
  document.getElementById("planning-head-row").appendChild(th);
}

function addCell(tr, text) {
  const td = document.createElement("td");
  td.textContent = text;
  tr.appendChild(td);
}

/* ---------------------------------------------------
   KLEURCODERING PER OPNKOMST
--------------------------------------------------- */

function colorOpkomstRow(opkomst, tr) {
  const vandaag = new Date().toISOString().split("T")[0];

  if (opkomst.datum < vandaag) {
    tr.style.background = "#e8e8e8"; 
    return;
  }

  const eerste = opkomsten[0];

  if (opkomst.id === eerste.id) {
    tr.style.background = "#d9f7d9";
  }

  if (opkomst.typeOpkomst === "bijzonder") {
    tr.style.background = "#fff4bf";
  }

  if (opkomst.typeOpkomst === "kamp") {
    tr.style.background = "#ffd9b5";
  }
}

/* ---------------------------------------------------
   AANWEZIGHEID PER CEL
--------------------------------------------------- */

function addPresenceCell(tr, opkomst, lidId) {
  const td = document.createElement("td");
  td.classList.add("presence-cell");

  const state = opkomst.aanwezigheid?.[lidId] || "onbekend";
  td.dataset.state = state;
  td.dataset.opkomstId = opkomst.id;
  td.dataset.lidId = lidId;

  updatePresenceAppearance(td);
  td.addEventListener("click", () => togglePresence(td));

  tr.appendChild(td);
}

function updatePresenceAppearance(td) {
  const state = td.dataset.state;

  td.classList.remove("presence-aanwezig", "presence-afwezig");

  if (state === "aanwezig") {
    td.textContent = "✔";
    td.classList.add("presence-aanwezig");
  } else if (state === "afwezig") {
    td.textContent = "✖";
    td.classList.add("presence-afwezig");
  } else {
    td.textContent = "–";
  }
}

async function togglePresence(td) {
  const current = td.dataset.state;
  let next = "onbekend";

  if (current === "onbekend") next = "aanwezig";
  else if (current === "aanwezig") next = "afwezig";

  td.dataset.state = next;
  updatePresenceAppearance(td);

  const opkomstId = td.dataset.opkomstId;
  const lidId = td.dataset.lidId;

  await update(ref(db, `bevers/opkomsten/${opkomstId}/aanwezigheid`), {
    [lidId]: next
  });
}

/* ---------------------------------------------------
   TELLERS
--------------------------------------------------- */

function countAanwezig(opkomst, groep) {
  return groep.filter(l => opkomst.aanwezigheid?.[l.id] === "aanwezig").length;
}

/* ---------------------------------------------------
   BERT LOGICA
--------------------------------------------------- */

function addBertCell(tr, opkomst) {
  const td = document.createElement("td");
  td.textContent = opkomst.bert_met ? getLidNaam(opkomst.bert_met) : "–";

  if (isAdmin) {
    td.style.cursor = "pointer";
    td.addEventListener("click", () => openBertSelect(opkomst));
  }

  tr.appendChild(td);
}

function getLidNaam(id) {
  const found = leden.find(l => l.id === id);
  return found ? found.naam : id;
}

function openBertSelect(opkomst) {
  const keuze = prompt(
    "Met wie gaat Bert mee?\n" +
    jeugdleden.map(l => `${l.id} — ${l.naam}`).join("\n") +
    "\n\nLaat leeg om Bert te verwijderen."
  );

  const val = keuze?.trim() || "";

  update(ref(db, `bevers/opkomsten/${opkomst.id}`), { bert_met: val }).then(loadAllData);
}

/* ---------------------------------------------------
   MODALS
--------------------------------------------------- */

function openModal(id) {
  document.getElementById(id).style.display = "flex";
}

function closeModal(id) {
  document.getElementById(id).style.display = "none";
}

/* ---------------------------------------------------
   ADMIN MODE
--------------------------------------------------- */

function toggleEditMode() {
  if (isAdmin) {
    isAdmin = false;
    localStorage.removeItem("beversAdmin");
    updateAdminUI();
    return;
  }

  const pw = prompt("Voer wachtwoord in:");
  if (pw === ADMIN_PASSWORD) {
    isAdmin = true;
    localStorage.setItem("beversAdmin", "true");
    updateAdminUI();
  } else {
    alert("Onjuist wachtwoord.");
  }
}

function updateAdminUI() {
  document.getElementById("adminPanel").style.display = isAdmin ? "block" : "none";
}

/* ---------------------------------------------------
   ADMIN: LEDENLIJST
--------------------------------------------------- */

function renderAdminLedenList() {
  if (!isAdmin) return;

  const container = document.getElementById("adminLedenList");
  container.innerHTML = "";

  leden.forEach(l => {
    const div = document.createElement("div");
    div.style.margin = "0.4rem 0";

    div.innerHTML = `
      <strong>${l.naam}</strong> (${l.type})
      <button data-id="${l.id}" class="editLidBtn">✏️</button>
      <button data-id="${l.id}" class="deleteLidBtn">🗑</button>
    `;

    container.appendChild(div);
  });

  document.querySelectorAll(".editLidBtn")
    .forEach(btn => btn.addEventListener("click", () => openEditLid(btn.dataset.id)));

  document.querySelectorAll(".deleteLidBtn")
    .forEach(btn => btn.addEventListener("click", () => deleteLid(btn.dataset.id)));
}

/* ---------------------------------------------------
   ADMIN: OPNKOMSTEN LIJST
--------------------------------------------------- */

function renderAdminOpkomstenList() {
  if (!isAdmin) return;

  const container = document.getElementById("adminOpkomstenList");
  container.innerHTML = "";

  opkomsten.forEach(o => {
    const div = document.createElement("div");
    div.style.margin = "0.4rem 0";

    div.innerHTML = `
      ${formatDate(o.datum)} – ${o.thema}
      <button data-id="${o.id}" class="editOpkomstBtn">✏️</button>
      <button data-id="${o.id}" class="deleteOpkomstBtn">🗑</button>
    `;

    container.appendChild(div);
  });

  document.querySelectorAll(".editOpkomstBtn")
    .forEach(btn => btn.addEventListener("click", () => openEditOpkomst(btn.dataset.id)));

  document.querySelectorAll(".deleteOpkomstBtn")
    .forEach(btn => btn.addEventListener("click", () => deleteOpkomst(btn.dataset.id)));
}

/* ---------------------------------------------------
   ADMIN: OPNKOMST TOEVOEGEN
--------------------------------------------------- */

function loadSelectOptions() {
  // leiding select (multiple)
  const addSel = document.getElementById("addOpkomst_leiding");
  const editSel = document.getElementById("editOpkomst_leiding");
  addSel.innerHTML = "";
  editSel.innerHTML = "";

  leidingleden.forEach(l => {
    const opt = document.createElement("option");
    opt.value = l.id;
    opt.textContent = l.naam;
    addSel.appendChild(opt);

    const opt2 = document.createElement("option");
    opt2.value = l.id;
    opt2.textContent = l.naam;
    editSel.appendChild(opt2);
  });

  // Bert select → jeugdleden
  const bertAdd = document.getElementById("addOpkomst_bert");
  const bertEdit = document.getElementById("editOpkomst_bert");

  bertAdd.innerHTML = `<option value="">Niemand</option>`;
  bertEdit.innerHTML = `<option value="">Niemand</option>`;

  jeugdleden.forEach(l => {
    const opt = document.createElement("option");
    opt.value = l.id;
    opt.textContent = l.naam;
    bertAdd.appendChild(opt);

    const opt2 = document.createElement("option");
    opt2.value = l.id;
    opt2.textContent = l.naam;
    bertEdit.appendChild(opt2);
  });
}

async function saveNewOpkomst() {
  const datum = document.getElementById("addOpkomst_datum").value;
  const start = document.getElementById("addOpkomst_start").value;
  const eind = document.getElementById("addOpkomst_eind").value;
  const thema = document.getElementById("addOpkomst_thema").value;
  const bijz = document.getElementById("addOpkomst_bijzonderheden").value;
  const type = document.getElementById("addOpkomst_type").value;
  const leidingSel = [...document.getElementById("addOpkomst_leiding").selectedOptions].map(o => o.value);
  const bert = document.getElementById("addOpkomst_bert").value;

  if (!datum) return alert("Datum is verplicht.");

  const leidingObj = {};
  leidingSel.forEach(id => leidingObj[id] = true);

  const aanwezigObj = {};

  jeugdleden.forEach(j => aanwezigObj[j.id] = "onbekend");
  leidingleden.forEach(l => aanwezigObj["leiding-" + l.id] = "onbekend");

  await set(ref(db, `bevers/opkomsten/${datum}`), {
    datum,
    starttijd: start,
    eindtijd: eind,
    thema,
    bijzonderheden: bijz,
    typeOpkomst: type,
    leiding: leidingObj,
    bert_met: bert,
    aanwezigheid: aanwezigObj
  });

  closeModal("modalAddOpkomst");
  loadAllData();
}

/* ---------------------------------------------------
   ADMIN: OPNKOMST BEWERKEN
--------------------------------------------------- */

function openEditOpkomst(id) {
  const o = opkomsten.find(x => x.id === id);
  if (!o) return;

  openModal("modalEditOpkomst");

  document.getElementById("editOpkomst_id").value = id;
  document.getElementById("editOpkomst_datum").value = o.datum;
  document.getElementById("editOpkomst_start").value = o.starttijd;
  document.getElementById("editOpkomst_eind").value = o.eindtijd;
  document.getElementById("editOpkomst_thema").value = o.thema;
  document.getElementById("editOpkomst_bijzonderheden").value = o.bijzonderheden || "";
  document.getElementById("editOpkomst_type").value = o.typeOpkomst || "normaal";

  const leidingSel = document.getElementById("editOpkomst_leiding");
  [...leidingSel.options].forEach(opt => {
    opt.selected = o.leiding?.[opt.value] || false;
  });

  const bertSel = document.getElementById("editOpkomst_bert");
  bertSel.value = o.bert_met || "";
}

async function saveEditOpkomst() {
  const oldId = document.getElementById("editOpkomst_id").value;
  const datum = document.getElementById("editOpkomst_datum").value;

  const obj = {
    datum,
    starttijd: document.getElementById("editOpkomst_start").value,
    eindtijd: document.getElementById("editOpkomst_eind").value,
    thema: document.getElementById("editOpkomst_thema").value,
    bijzonderheden: document.getElementById("editOpkomst_bijzonderheden").value,
    typeOpkomst: document.getElementById("editOpkomst_type").value,
    leiding: {},
    bert_met: document.getElementById("editOpkomst_bert").value
  };

  [...document.getElementById("editOpkomst_leiding").selectedOptions].forEach(opt => {
    obj.leiding[opt.value] = true;
  });

  // datum veranderd = ID moet verplaatst worden
  if (oldId !== datum) {
    const oldData = (await get(ref(db, `bevers/opkomsten/${oldId}`))).val();
    obj.aanwezigheid = oldData.aanwezigheid || {};
    await remove(ref(db, `bevers/opkomsten/${oldId}`));
  } else {
    const existing = (await get(ref(db, `bevers/opkomsten/${oldId}`))).val();
    obj.aanwezigheid = existing.aanwezigheid;
  }

  await set(ref(db, `bevers/opkomsten/${datum}`), obj);

  closeModal("modalEditOpkomst");
  loadAllData();
}

/* ---------------------------------------------------
   ADMIN: OPNKOMST VERWIJDEREN
--------------------------------------------------- */

async function deleteOpkomst(id) {
  if (!confirm("Weet je zeker dat je deze opkomst wilt verwijderen?")) return;

  await remove(ref(db, `bevers/opkomsten/${id}`));
  loadAllData();
}

/* ---------------------------------------------------
   ADMIN: LEDEN
--------------------------------------------------- */

async function saveNewLid() {
  const naam = document.getElementById("addLid_naam").value;
  const type = document.getElementById("addLid_type").value;

  if (!naam) return alert("Naam is verplicht");

  const newId = push(ref(db, "bevers/leden")).key;

  await set(ref(db, `bevers/leden/${newId}`), {
    naam,
    type,
    volgorde: leden.length + 1
  });

  // toevoeging attendance voor alle opkomsten
  for (const o of opkomsten) {
    await update(ref(db, `bevers/opkomsten/${o.id}/aanwezigheid`), {
      [type === "leiding" ? "leiding-" + newId : newId]: "onbekend"
    });
  }

  closeModal("modalAddLid");
  loadAllData();
}

function openEditLid(id) {
  const lid = leden.find(l => l.id === id);
  if (!lid) return;

  openModal("modalEditLid");

  document.getElementById("editLid_id").value = id;
  document.getElementById("editLid_naam").value = lid.naam;
  document.getElementById("editLid_type").value = lid.type;
}

async function saveEditLid() {
  const id = document.getElementById("editLid_id").value;
  const naam = document.getElementById("editLid_naam").value;
  const type = document.getElementById("editLid_type").value;

  await update(ref(db, `bevers/leden/${id}`), { naam, type });

  closeModal("modalEditLid");
  loadAllData();
}

async function deleteLid(id) {
  if (!confirm("Lid verwijderen?")) return;

  await remove(ref(db, `bevers/leden/${id}`));

  // Verwijder uit aanwezigheid
  for (const o of opkomsten) {
    const key = o.type === "leiding" ? "leiding-" + id : id;
    await update(ref(db, `bevers/opkomsten/${o.id}/aanwezigheid`), {
      [key]: null
    });
  }

  loadAllData();
}
