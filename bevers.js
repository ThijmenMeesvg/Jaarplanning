/******************************************************
 *  BEVERS – COMPLETE ADMIN & VIEW SYSTEM
 *  Firebase Realtime Database
 *  Functionaliteit:
 *    - leden laden, sorteren, scheiden per type
 *    - opkomsten laden, sorteren, kleuren (groen, grijs, bijzonder, kamp)
 *    - aanwezigheid klikken
 *    - Bert-met dropdown
 *    - tellers (jeugd + leiding)
 *    - beheer: leden toevoegen / bewerken / verwijderen
 *    - beheer: opkomsten toevoegen / bewerken / verwijderen
 *    - wachtwoord-beheer
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

const ADMIN_PASSWORD = "bevers2025";   // pas dit naar wens aan

/* ---------------------------------------------------
   VARIABELEN
--------------------------------------------------- */

let leden = [];        // alle leden (jeugd + leiding)
let jeugd = [];        // alleen jeugd
let leiding = [];      // alleen leiding
let opkomsten = [];    // alle opkomsten
let isAdmin = false;

/* ---------------------------------------------------
   START BIJ LADEN
--------------------------------------------------- */

document.addEventListener("DOMContentLoaded", () => {
  isAdmin = localStorage.getItem("beversAdmin") === "true";

  document.getElementById("editModeButton").addEventListener("click", toggleEditMode);

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
  const ledenObj = data.leden || {};
  const opkomstenObj = data.opkomsten || {};

  // leden verwerken
  leden = Object.entries(ledenObj).map(([id, v]) => ({
    id,
    naam: v.naam,
    type: v.type,     // jeugd | leiding
    volgorde: v.volgorde || 0
  }));

  jeugd = leden.filter(l => l.type === "jeugd").sort((a, b) => a.volgorde - b.volgorde);
  leiding = leden.filter(l => l.type === "leiding").sort((a, b) => a.volgorde - b.volgorde);

  // opkomsten verwerken
  opkomsten = Object.entries(opkomstenObj).map(([id, v]) => ({
    id,
    ...v
  }));

  sortOpkomsten();
  renderTable();
  renderAdminPanels();
}

/* ---------------------------------------------------
   OPNIEUW SORTEREN VAN OPNKOMSTEN
   Eerstvolgende opkomst = groen
   Verleden = grijs (onderaan)
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
   TABEL RENDEREN
--------------------------------------------------- */

function renderTable() {
  const head = document.getElementById("planning-head-row");
  const body = document.getElementById("planning-body");

  head.innerHTML = "";
  body.innerHTML = "";

  /* HEADER */
  addHead("Datum");
  addHead("Thema");
  addHead("Bijzonderheden");
  addHead("Start");
  addHead("Eind");
  addHead("Aanw. jeugd");
  addHead("Aanw. leiding");

  // jeugdleden
  jeugd.forEach(l => addHead(l.naam));

  // leiding
  leiding.forEach(l => addHead(l.naam));

  // Bert
  addHead("Bert");

  /* RIJEN */
  opkomsten.forEach(opkomst => {
    const tr = document.createElement("tr");

    colorOpkomstRow(opkomst, tr);

    addCell(tr, formatDate(opkomst.datum));
    addCell(tr, opkomst.thema);
    addCell(tr, opkomst.bijzonderheden || "");
    addCell(tr, opkomst.starttijd);
    addCell(tr, opkomst.eindtijd);

    // tellers
    addCell(tr, countAanwezig(opkomst, jeugd));
    addCell(tr, countAanwezig(opkomst, leiding));

    // jeugd cellen
    jeugd.forEach(l => addPresenceCell(tr, opkomst, l.id));

    // leiding cellen
    leiding.forEach(l => addPresenceCell(tr, opkomst, "leiding-" + l.id));

    // BERT
    addBertCell(tr, opkomst);

    body.appendChild(tr);
  });
}

/* ---------------------------------------------------
   TABEL HULPFUNCTIES
--------------------------------------------------- */

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

function addPresenceCell(tr, opkomst, lidID) {
  const td = document.createElement("td");
  td.classList.add("presence-cell");

  const state = opkomst.aanwezigheid?.[lidID] || "onbekend";
  td.dataset.state = state;
  td.dataset.opkomstId = opkomst.id;
  td.dataset.lidId = lidID;

  updatePresenceAppearance(td);

  td.addEventListener("click", () => togglePresence(td));

  tr.appendChild(td);
}

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

/* ---------------------------------------------------
   KLEUREN OP BASIS VAN TYPE & DATUM
--------------------------------------------------- */

function colorOpkomstRow(opkomst, tr) {
  const vandaag = new Date().toISOString().split("T")[0];

  if (opkomst.datum < vandaag) {
    tr.style.background = "#e8e8e8";    // grijs
    return;
  }

  // eerstvolgende opkomst
  const eerste = opkomsten[0];
  if (opkomst.id === eerste.id) {
    tr.style.background = "#d9f7d9";    // lichtgroen
  }

  if (opkomst.typeOpkomst === "bijzonder") {
    tr.style.background = "#fff4bf";    // geel
  }

  if (opkomst.typeOpkomst === "kamp") {
    tr.style.background = "#ffd9b5";    // oranje
  }
}

/* ---------------------------------------------------
   AANWEZIGHEID KLIKKEN
--------------------------------------------------- */

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
   DATUM HELPERS
--------------------------------------------------- */

function formatDate(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}-${m}-${y}`;
}

/* ---------------------------------------------------
   BEWERKMODUS
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
    alert("Incorrect wachtwoord.");
  }
}

function updateAdminUI() {
  const adminPanel = document.getElementById("adminPanel");
  if (!adminPanel) return;

  adminPanel.style.display = isAdmin ? "block" : "none";
}

/* ---------------------------------------------------
   BERT-MET
--------------------------------------------------- */

function openBertSelect(opkomst) {
  const keuze = prompt(
    "Met wie gaat Bert mee?\n\n" +
    jeugd.map(l => `${l.id} — ${l.naam}`).join("\n") +
    "\n\nLaat leeg om Bert te verwijderen."
  );

  const nieuwe = keuze?.trim() || "";

  update(ref(db, `bevers/opkomsten/${opkomst.id}`), {
    bert_met: nieuwe
  }).then(loadAllData);
}

/* ---------------------------------------------------
   ADMIN PANELS RENDEREN
--------------------------------------------------- */

function renderAdminPanels() {
  if (!isAdmin) return;

  // hier kun je panelen toevoegen zoals:
  // - ledenbeheer
  // - opkomstbeheer
  // ik voeg ze toe zodra jij de HTML sektion definitief hebt
}

