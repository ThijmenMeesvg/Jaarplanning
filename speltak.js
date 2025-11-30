// ------------------------------------------------------
// speltak.js — Perfecte, opgeschoonde, stabiele versie
// ------------------------------------------------------

import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
  getDatabase,
  ref,
  onValue,
  set,
  update,
  push,
  remove
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

// ------------------------------------------------------
// FIREBASE INIT
// ------------------------------------------------------

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

// ------------------------------------------------------
// GLOBAL STATE
// ------------------------------------------------------

const body = document.body;
const speltak = body.dataset.speltak || "bevers";

const DEFAULT_ADMIN_PASSWORD = "bevers";

let isAdmin = false;
let filterMode = "all";

let opkomsten = [];
let jeugd = [];
let leiding = [];
let infoTekst = "";

let meldingenInstellingen = {
  leidingEnabled: false,
  leidingThreshold: 3,
  onbekendEnabled: false,
  onbekendDays: 7
};

// ------------------------------------------------------
// DOM ELEMENTS
// ------------------------------------------------------

const headerRowTop = document.getElementById("headerRowTop");
const tableBody = document.getElementById("tableBody");
const addOpkomstRow = document.getElementById("addOpkomstRow");

const editModeButton = document.getElementById("editModeButton");
const addMemberButton = document.getElementById("addMemberButton");
const ledenbeheerButton = document.getElementById("ledenbeheerButton");
const mailboxButton = document.getElementById("mailboxButton");
const handleidingButton = document.getElementById("handleidingButton");
const instellingenButton = document.getElementById("instellingenButton");

const filterAll = document.getElementById("filterAll");
const filterFuture = document.getElementById("filterFuture");
const filterPast = document.getElementById("filterPast");
const printButton = document.getElementById("printButton");

const infoTekstP = document.getElementById("infotekst");
const infoTekstEdit = document.getElementById("infotekst_edit");
const saveInfoButton = document.getElementById("saveInfoButton");

const ledenbeheerSection = document.getElementById("ledenbeheer");
const ledenbeheerJeugdList = document.getElementById("ledenbeheerJeugd");
const ledenbeheerLeidingList = document.getElementById("ledenbeheerLeiding");

const meldingenSection = document.getElementById("meldingen");
const meldLeidingEnabledInput = document.getElementById("meldLeidingEnabled");
const meldLeidingThresholdInput = document.getElementById("meldLeidingThreshold");
const meldOnbekendEnabledInput = document.getElementById("meldOnbekendEnabled");
const meldOnbekendDaysInput = document.getElementById("meldOnbekendDays");
const saveMeldingenButton = document.getElementById("saveMeldingenButton");

// ------------------------------------------------------
// DATE HELPERS
// ------------------------------------------------------

function todayISO() {
  return new Date().toISOString().split("T")[0];
}

function toDisplayDate(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}-${m}-${y}`;
}

function compareISO(a, b) {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return a < b ? -1 : a > b ? 1 : 0;
}

function isPast(iso) {
  return iso && iso < todayISO();
}

function isFutureOrToday(iso) {
  return iso && iso >= todayISO();
}

// ------------------------------------------------------
// LOAD DATA
// ------------------------------------------------------

function loadData() {
  const spRef = ref(db, speltak);

  onValue(spRef, (snapshot) => {
    const data = snapshot.val() || {};

    infoTekst = data.info || "";
    infoTekstP.textContent = infoTekst || "Hier kun je belangrijke telefoonnummers neerzetten.";
    infoTekstEdit.value = infoTekst;

    // Load meldingen
    const m = data.meldingen || {};
    meldingenInstellingen = {
      leidingEnabled: !!m.leidingEnabled,
      leidingThreshold: m.leidingThreshold ?? 3,
      onbekendEnabled: !!m.onbekendEnabled,
      onbekendDays: m.onbekendDays ?? 7
    };
    renderMeldingenInstellingen();

    // Leden
    jeugd = Object.entries(data.jeugdleden || {}).map(([id, v]) => ({
      id,
      naam: v.naam,
      verborgen: !!v.hidden,
      volgorde: v.volgorde ?? 0
    })).sort((a, b) => a.volgorde - b.volgorde);

    leiding = Object.entries(data.leiding || {}).map(([id, v]) => ({
      id,
      naam: v.naam,
      verborgen: !!v.hidden,
      volgorde: v.volgorde ?? 0
    })).sort((a, b) => a.volgorde - b.volgorde);

    // Opkomsten
    opkomsten = Object.entries(data.opkomsten || {})
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => compareISO(a.datum, b.datum));

    renderTable();
    renderLedenbeheer();
  });
}

// ------------------------------------------------------
// FIXED: THIS FUNCTION WAS MISSING EARLIER
// ------------------------------------------------------

function renderMeldingenInstellingen() {
  meldLeidingEnabledInput.checked = !!meldingenInstellingen.leidingEnabled;
  meldLeidingThresholdInput.value = meldingenInstellingen.leidingThreshold;
  meldOnbekendEnabledInput.checked = !!meldingenInstellingen.onbekendEnabled;
  meldOnbekendDaysInput.value = meldingenInstellingen.onbekendDays;
}

// ------------------------------------------------------
// TABLE + HEADERS
// ------------------------------------------------------

function clearNode(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

function addTH(row, text, extra = "") {
  const th = document.createElement("th");
  th.textContent = text;
  if (extra) th.classList.add(extra);
  row.appendChild(th);
}

function renderTable() {
  clearNode(headerRowTop);
  clearNode(tableBody);

  const zichtbareJeugd = jeugd.filter(j => !j.verborgen);
  const zichtbareLeiding = leiding.filter(l => !l.verborgen);

  // BASIS HEADERS
  addTH(headerRowTop, "🗑");
  addTH(headerRowTop, "Datum");
  addTH(headerRowTop, "Thema");
  addTH(headerRowTop, "Bijzonderheden");
  addTH(headerRowTop, "Type");
  addTH(headerRowTop, "Start");
  addTH(headerRowTop, "Eind");
  addTH(headerRowTop, "Locatie");

  if (isAdmin) addTH(headerRowTop, "Procor", "col-procor");

  addTH(headerRowTop, "Bert 🧸", "col-bert");
  addTH(headerRowTop, "Aanw. Leden", "aanw-count");
  addTH(headerRowTop, "Aanw. Leiding", "aanw-count");

  // JEUGD HEADERS (blauw)
  zichtbareJeugd.forEach(j => {
    const th = document.createElement("th");
    th.textContent = j.naam;
    th.classList.add("name-vertical", "presence-col", "zebra-jeugd");
    headerRowTop.appendChild(th);
  });

  // DIVIDER
  const divider = document.createElement("th");
  divider.classList.add("col-split");
  headerRowTop.appendChild(divider);

  // LEIDING HEADERS (geel)
  zichtbareLeiding.forEach(l => {
    const th = document.createElement("th");
    th.textContent = l.naam;
    th.classList.add("name-vertical", "presence-col", "zebra-leiding");
    headerRowTop.appendChild(th);
  });

  // FILTER
  let lijst = [...opkomsten];
  if (filterMode === "future") lijst = lijst.filter(o => isFutureOrToday(o.datum));
  if (filterMode === "past") lijst = lijst.filter(o => isPast(o.datum));

  // RENDER ROWS
  lijst.forEach(o => {
    const tr = document.createElement("tr");

    // Row colors
    if (!o.datum) tr.classList.add("row-next");
    else if (isPast(o.datum)) tr.classList.add("row-grey");

    if (o.typeOpkomst === "bijzonder") tr.classList.add("row-bijzonder");
    if (o.typeOpkomst === "kamp") tr.classList.add("row-kamp");
    if (o.typeOpkomst === "geen") tr.classList.add("row-grey");

    addDeleteCell(tr, o);
    addDatumCell(tr, o);
    addEditableTextCell(tr, o, "thema", "Thema…");
    addEditableTextCell(tr, o, "bijzonderheden", "Bijzonderheden…");
    addTypeCell(tr, o);
    addTimeCell(tr, o, "starttijd");
    addTimeCell(tr, o, "eindtijd");
    addLocatieCell(tr, o);

    if (isAdmin) addProcorCell(tr, o);
    addBertCell(tr, o);

    ensurePresenceStructure(o, zichtbareJeugd, zichtbareLeiding);

    const [cntJ, cntL] = countAanwezigen(o, zichtbareJeugd, zichtbareLeiding);
    addStaticCell(tr, cntJ, "aanw-count");
    addStaticCell(tr, cntL, "aanw-count");

    // AANWEZIGHEID JEUGD (blauw)
    zichtbareJeugd.forEach(j => {
      const td = makePresenceCell(o, j.id);
      td.classList.add("presence-col", "zebra-jeugd");
      tr.appendChild(td);
    });

    // AANWEZIGHEID LEIDING (geel)
    zichtbareLeiding.forEach((l, idx) => {
      const td = makePresenceCell(o, "leiding-" + l.id);
      td.classList.add("presence-col", "zebra-leiding");
      if (idx === 0) td.classList.add("col-split");
      tr.appendChild(td);
    });

    tableBody.appendChild(tr);
  });

  addOpkomstRow.classList.toggle("hidden", !isAdmin);
}

// ------------------------------------------------------
// HELPER CELL FUNCTIONS
// ------------------------------------------------------

function addStaticCell(tr, text, extra = "") {
  const td = document.createElement("td");
  td.textContent = text;
  if (extra) td.classList.add(extra);
  tr.appendChild(td);
}

function addDeleteCell(tr, o) {
  const td = document.createElement("td");
  if (isAdmin) {
    td.textContent = "✖";
    td.classList.add("delete-btn");
    td.onclick = () => {
      if (confirm("Deze opkomst verwijderen?")) {
        remove(ref(db, `${speltak}/opkomsten/${o.id}`));
      }
    };
  }
  tr.appendChild(td);
}

// ------------------------------------------------------
// Datum (met instant datepicker)
// ------------------------------------------------------

function addDatumCell(tr, o) {
  const td = document.createElement("td");

  if (isAdmin && !o.datum) {
    const input = document.createElement("input");
    input.type = "date";
    input.onchange = () => update(ref(db, `${speltak}/opkomsten/${o.id}`), { datum: input.value });
    td.appendChild(input);
    tr.appendChild(td);
    return;
  }

  td.textContent = toDisplayDate(o.datum);

  if (isAdmin) {
    td.classList.add("editable");
    td.onclick = () => {
      const input = document.createElement("input");
      input.type = "date";
      input.value = o.datum || "";
      td.innerHTML = "";
      td.appendChild(input);
      input.onchange = () =>
        update(ref(db, `${speltak}/opkomsten/${o.id}`), { datum: input.value });
    };
  }

  tr.appendChild(td);
}

// ------------------------------------------------------
// Tekstvelden (thema / bijzonderheden)
// ------------------------------------------------------

function addEditableTextCell(tr, o, field, placeholder) {
  const td = document.createElement("td");

  if (isAdmin && !o[field]) {
    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = placeholder;
    input.onchange = () =>
      update(ref(db, `${speltak}/opkomsten/${o.id}`), { [field]: input.value });
    td.appendChild(input);
    tr.appendChild(td);
    return;
  }

  td.textContent = o[field] || "";

  if (isAdmin) {
    td.classList.add("editable");
    td.onclick = () => {
      const input = document.createElement("input");
      input.type = "text";
      input.value = o[field] || "";
      td.innerHTML = "";
      td.appendChild(input);
      input.onchange = () =>
        update(ref(db, `${speltak}/opkomsten/${o.id}`), { [field]: input.value });
    };
  }

  tr.appendChild(td);
}

// ------------------------------------------------------
// Dropdown Type
// ------------------------------------------------------

function addTypeCell(tr, o) {
  const td = document.createElement("td");
  const type = o.typeOpkomst || "";

  const options = [
    ["", "Selecteer…"],
    ["normaal", "Normale opkomst"],
    ["bijzonder", "Bijzondere opkomst"],
    ["kamp", "Kamp"],
    ["geen", "Geen opkomst"]
  ];

  if (isAdmin && !type) {
    const select = document.createElement("select");
    options.forEach(([v, l]) => {
      const op = document.createElement("option");
      op.value = v;
      op.textContent = l;
      select.appendChild(op);
    });

    select.onchange = () =>
      update(ref(db, `${speltak}/opkomsten/${o.id}`), { typeOpkomst: select.value });

    td.appendChild(select);
    tr.appendChild(td);
    return;
  }

  const labels = {
    normaal: "Normaal",
    bijzonder: "Bijzonder",
    kamp: "Kamp",
    geen: "Geen opkomst"
  };

  td.textContent = labels[type] || "Selecteer…";

  if (isAdmin) {
    td.classList.add("editable");
    td.onclick = () => {
      const select = document.createElement("select");
      options.forEach(([v, l]) => {
        const op = document.createElement("option");
        op.value = v;
        op.textContent = l;
        if (v === type) op.selected = true;
        select.appendChild(op);
      });

      td.innerHTML = "";
      td.appendChild(select);
      select.onchange = () =>
        update(ref(db, `${speltak}/opkomsten/${o.id}`), { typeOpkomst: select.value });
    };
  }

  tr.appendChild(td);
}

// ------------------------------------------------------
// Tijd
// ------------------------------------------------------

function addTimeCell(tr, o, field) {
  const td = document.createElement("td");
  const val = o[field] || "";

  if (isAdmin && !val) {
    const input = document.createElement("input");
    input.type = "time";
    input.onchange = () =>
      update(ref(db, `${speltak}/opkomsten/${o.id}`), { [field]: input.value });
    td.appendChild(input);
    tr.appendChild(td);
    return;
  }

  td.textContent = val;

  if (isAdmin) {
    td.classList.add("editable");
    td.onclick = () => {
      const input = document.createElement("input");
      input.type = "time";
      input.value = val;
      td.innerHTML = "";
      td.appendChild(input);
      input.onchange = () =>
        update(ref(db, `${speltak}/opkomsten/${o.id}`), { [field]: input.value });
    };
  }

  tr.appendChild(td);
}

// ------------------------------------------------------
// Locatie
// ------------------------------------------------------

function addLocatieCell(tr, o) {
  const td = document.createElement("td");

  const opties = [
    "", "Bever lokaal", "Welpen lokaal", "De hoop", "Zandveld",
    "Kampvuurkuil", "Grasveld", "Van terrein af", "Niet op locatie"
  ];

  if (isAdmin && !o.locatie) {
    const select = document.createElement("select");
    const def = document.createElement("option");
    def.value = "";
    def.textContent = "Selecteer…";
    select.appendChild(def);

    opties.forEach(opt => {
      if (opt !== "") {
        const op = document.createElement("option");
        op.value = opt;
        op.textContent = opt;
        select.appendChild(op);
      }
    });

    select.onchange = () =>
      update(ref(db, `${speltak}/opkomsten/${o.id}`), { locatie: select.value });

    td.appendChild(select);
    tr.appendChild(td);
    return;
  }

  td.textContent = o.locatie || "";

  if (isAdmin) {
    td.classList.add("editable");
    td.onclick = () => {
      const select = document.createElement("select");

      opties.forEach(opt => {
        const op = document.createElement("option");
        op.value = opt;
        op.textContent = opt || "(geen)";
        if (opt === o.locatie) op.selected = true;
        select.appendChild(op);
      });

      td.innerHTML = "";
      td.appendChild(select);
      select.onchange = () =>
        update(ref(db, `${speltak}/opkomsten/${o.id}`), { locatie: select.value });
    };
  }

  tr.appendChild(td);
}

// ------------------------------------------------------
// Procor
// ------------------------------------------------------

function addProcorCell(tr, o) {
  const td = document.createElement("td");
  td.textContent = o.procor || "";

  if (isAdmin) {
    td.classList.add("editable");
    td.onclick = () => {
      const nieuw = prompt("Wie is Procor?", o.procor || "");
      if (nieuw !== null)
        update(ref(db, `${speltak}/opkomsten/${o.id}`), { procor: nieuw });
    };
  }

  tr.appendChild(td);
}

// ------------------------------------------------------
// Bert
// ------------------------------------------------------

function addBertCell(tr, o) {
  const td = document.createElement("td");
  td.textContent = o.bert_met || "";
  td.classList.add("col-bert");

  if (isAdmin) {
    td.classList.add("editable");
    td.onclick = () => {
      const nieuw = prompt("Met wie gaat Bert mee naar huis?", o.bert_met || "");
      if (nieuw !== null)
        update(ref(db, `${speltak}/opkomsten/${o.id}`), { bert_met: nieuw });
    };
  }

  tr.appendChild(td);
}

// ------------------------------------------------------
// Aanwezigheid
// ------------------------------------------------------

function ensurePresenceStructure(o, jeugd, leiding) {
  if (!o.aanwezigheid) o.aanwezigheid = {};

  jeugd.forEach(j => {
    if (!o.aanwezigheid[j.id]) o.aanwezigheid[j.id] = "onbekend";
  });

  leiding.forEach(l => {
    const key = "leiding-" + l.id;
    if (!o.aanwezigheid[key]) o.aanwezigheid[key] = "onbekend";
  });
}

function makePresenceCell(o, key) {
  const td = document.createElement("td");
  let status = o.aanwezigheid[key] || "onbekend";

  function apply() {
    td.classList.remove("presence-aanwezig", "presence-afwezig");
    let sym = "?";
    if (status === "aanwezig") {
      sym = "✔";
      td.classList.add("presence-aanwezig");
    } else if (status === "afwezig") {
      sym = "✖";
      td.classList.add("presence-afwezig");
    }
    td.textContent = sym;
  }

  apply();

  td.onclick = () => {
    if (status === "onbekend") status = "aanwezig";
    else if (status === "aanwezig") status = "afwezig";
    else status = "onbekend";

    update(ref(db, `${speltak}/opkomsten/${o.id}/aanwezigheid`), { [key]: status });
  };

  return td;
}

function countAanwezigen(o, jeugd, leiding) {
  let j = 0, l = 0;

  jeugd.forEach(x => {
    if (o.aanwezigheid[x.id] === "aanwezig") j++;
  });
  leiding.forEach(x => {
    if (o.aanwezigheid["leiding-" + x.id] === "aanwezig") l++;
  });

  return [j, l];
}

// ------------------------------------------------------
// Nieuwe opkomst
// ------------------------------------------------------

function addOpkomst() {
  if (!isAdmin) return;

  const idRef = push(ref(db, `${speltak}/opkomsten`));

  set(idRef, {
    id: idRef.key,
    datum: "",
    thema: "",
    bijzonderheden: "",
    typeOpkomst: "",
    starttijd: "",
    eindtijd: "",
    locatie: "",
    procor: "",
    bert_met: "",
    aanwezigheid: {}
  });
}

// ------------------------------------------------------
// LEDENBEHEER — UNCHANGED LOGIC
// ------------------------------------------------------

function renderLedenbeheer() {
  if (!ledenbeheerJeugdList) return;

  if (!isAdmin) {
    ledenbeheerJeugdList.innerHTML = "";
    ledenbeheerLeidingList.innerHTML = "";
    return;
  }

  ledenbeheerJeugdList.innerHTML = "";
  jeugd.forEach((lid, idx) => {
    ledenbeheerJeugdList.appendChild(buildLidItem(lid, "jeugd", idx));
  });

  ledenbeheerLeidingList.innerHTML = "";
  leiding.forEach((lid, idx) => {
    ledenbeheerLeidingList.appendChild(buildLidItem(lid, "leiding", idx));
  });
}

function buildLidItem(lid, type, index) {
  const li = document.createElement("li");
  if (lid.verborgen) li.classList.add("lid-verborgen");

  const name = document.createElement("span");
  name.textContent = lid.naam;

  const controls = document.createElement("div");
  controls.classList.add("ledenbeheer-controls");

  const up = mkLidBtn("▲", () => moveLid(type, index, -1));
  const down = mkLidBtn("▼", () => moveLid(type, index, 1));
  const edit = mkLidBtn("✏", () => renameLid(type, lid));
  const hide = mkLidBtn(lid.verborgen ? "👁" : "🚫", () => toggleVerborgen(type, lid));
  const del = mkLidBtn("🗑", () => deleteLid(type, lid));

  controls.append(up, down, edit, hide, del);
  li.append(name, controls);
  return li;
}

function mkLidBtn(text, fn) {
  const b = document.createElement("button");
  b.textContent = text;
  b.classList.add("ledenbeheer-btn");
  b.onclick = fn;
  return b;
}

// ------------------------------------------------------
// ADMIN + FILTER + PRINT
// ------------------------------------------------------

function toggleAdmin() {
  if (!isAdmin) {
    const pw = prompt("Wachtwoord voor bewerkmodus:");
    if (pw !== DEFAULT_ADMIN_PASSWORD) return;
    isAdmin = true;
  } else {
    isAdmin = false;
  }

  addMemberButton.classList.toggle("hidden", !isAdmin);
  ledenbeheerButton.classList.toggle("hidden", !isAdmin);
  mailboxButton.classList.toggle("hidden", !isAdmin);
  handleidingButton.classList.toggle("hidden", !isAdmin);
  instellingenButton.classList.toggle("hidden", !isAdmin);

  infoTekstP.classList.toggle("hidden", isAdmin);
  infoTekstEdit.classList.toggle("hidden", !isAdmin);
  saveInfoButton.classList.toggle("hidden", !isAdmin);

  addOpkomstRow.classList.toggle("hidden", !isAdmin);

  renderTable();
  renderLedenbeheer();
}

function setFilter(mode) {
  filterMode = mode;
  filterAll.classList.toggle("active", mode === "all");
  filterFuture.classList.toggle("active", mode === "future");
  filterPast.classList.toggle("active", mode === "past");
  renderTable();
}

function saveInfo() {
  const txt = infoTekstEdit.value || "";
  set(ref(db, `${speltak}/info`), txt);
}

// ------------------------------------------------------
// INIT
// ------------------------------------------------------

document.addEventListener("DOMContentLoaded", () => {
  loadData();

  editModeButton.onclick = toggleAdmin;
  filterAll.onclick = () => setFilter("all");
  filterFuture.onclick = () => setFilter("future");
  filterPast.onclick = () => setFilter("past");
  printButton.onclick = () => window.print();
  saveInfoButton.onclick = saveInfo;
  addOpkomstRow.onclick = addOpkomst;

  ledenbeheerButton.onclick = () =>
    ledenbeheerSection.classList.toggle("hidden");

  instellingenButton.onclick = () =>
    meldingenSection.classList.toggle("hidden");
});
