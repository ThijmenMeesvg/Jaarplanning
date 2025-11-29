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
