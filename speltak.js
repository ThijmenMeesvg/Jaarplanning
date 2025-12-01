// speltak.js – verbeterde versie met directe dropdowns, datepickers & betere headerlogica

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

/* -----------------------------------------------------
   FIREBASE INIT
----------------------------------------------------- */

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
   GLOBALE STATE
----------------------------------------------------- */

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

/* -----------------------------------------------------
   DOM ELEMENTEN
----------------------------------------------------- */

const headerRowTop    = document.getElementById("headerRowTop");
const tableBody       = document.getElementById("tableBody");
const addOpkomstRow   = document.getElementById("addOpkomstRow");

const editModeButton    = document.getElementById("editModeButton");
const addMemberButton   = document.getElementById("addMemberButton");
const ledenbeheerButton = document.getElementById("ledenbeheerButton");
const mailboxButton     = document.getElementById("mailboxButton");
const handleidingButton = document.getElementById("handleidingButton");
const instellingenButton= document.getElementById("instellingenButton");

const filterAll    = document.getElementById("filterAll");
const filterFuture = document.getElementById("filterFuture");
const filterPast   = document.getElementById("filterPast");
const printButton  = document.getElementById("printButton");

const infoTekstP     = document.getElementById("infotekst");
const infoTekstEdit  = document.getElementById("infotekst_edit");
const saveInfoButton = document.getElementById("saveInfoButton");

const ledenbeheerSection     = document.getElementById("ledenbeheer");
const ledenbeheerJeugdList   = document.getElementById("ledenbeheerJeugd");
const ledenbeheerLeidingList = document.getElementById("ledenbeheerLeiding");

const meldLeidingEnabledInput   = document.getElementById("meldLeidingEnabled");
const meldLeidingThresholdInput = document.getElementById("meldLeidingThreshold");
const meldOnbekendEnabledInput  = document.getElementById("meldOnbekendEnabled");
const meldOnbekendDaysInput     = document.getElementById("meldOnbekendDays");
const meldingenSaveButton       = document.getElementById("meldingenSaveButton");

/* -----------------------------------------------------
   HANDIGE DATUMFUNCTIES
----------------------------------------------------- */

function todayISO() {
  return new Date().toISOString().slice(0, 10);
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

function isBinnenNDagen(iso, n) {
  if (!iso) return false;
  const doel = new Date(iso + "T00:00:00");
  const nu = new Date();
  const diff = doel.getTime() - nu.getTime();
  const dagen = diff / (1000 * 60 * 60 * 24);
  return dagen >= 0 && dagen <= n;
}

/* -----------------------------------------------------
   DATA LADEN
----------------------------------------------------- */

function loadData() {
  const rootRef = ref(db, speltak);

  onValue(rootRef, snapshot => {
    const data = snapshot.val() || {};

    infoTekst = data.infotekst || "";

    meldingenInstellingen = {
      leidingEnabled: !!(data.meldingen && data.meldingen.leidingEnabled),
      leidingThreshold: data.meldingen?.leidingThreshold ?? 3,
      onbekendEnabled: !!(data.meldingen && data.meldingen.onbekendEnabled),
      onbekendDays: data.meldingen?.onbekendDays ?? 7
    };

    jeugd = Object.entries(data.jeugdleden || {}).map(([id, v]) => ({
      id,
      naam: v.naam,
      verborgen: !!v.hidden,
      volgorde: v.volgorde ?? 0
    })).sort((a, b) => a.volgorde - b.volgorde || a.naam.localeCompare(b.naam));

    leiding = Object.entries(data.leiding || {}).map(([id, v]) => ({
      id,
      naam: v.naam,
      verborgen: !!v.hidden,
      volgorde: v.volgorde ?? 0
    })).sort((a, b) => a.volgorde - b.volgorde || a.naam.localeCompare(b.naam));

    opkomsten = Object.entries(data.opkomsten || {})
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => compareISO(a.datum, b.datum));

    renderInfoTekst();
    renderMeldingenInstellingen();
    renderTable();
    renderLedenbeheer();
  });
}

/* -----------------------------------------------------
   INFOTEKST
----------------------------------------------------- */

function renderInfoTekst() {
  if (infoTekstP) infoTekstP.textContent = infoTekst;
  if (infoTekstEdit) infoTekstEdit.value = infoTekst;
}

function saveInfoTekst() {
  const nieuwe = infoTekstEdit.value;
  update(ref(db, speltak), { infotekst: nieuwe });
}

/* -----------------------------------------------------
   RENDER MELDINGEN INSTELLINGEN
----------------------------------------------------- */

function renderMeldingenInstellingen() {
  if (!meldLeidingEnabledInput) return;

  meldLeidingEnabledInput.checked   = !!meldingenInstellingen.leidingEnabled;
  meldLeidingThresholdInput.value   = meldingenInstellingen.leidingThreshold;
  meldOnbekendEnabledInput.checked  = !!meldingenInstellingen.onbekendEnabled;
  meldOnbekendDaysInput.value       = meldingenInstellingen.onbekendDays;
}

function saveMeldingenInstellingen() {
  const obj = {
    leidingEnabled: !!meldLeidingEnabledInput.checked,
    leidingThreshold: Number(meldLeidingThresholdInput.value || 3),
    onbekendEnabled: !!meldOnbekendEnabledInput.checked,
    onbekendDays: Number(meldOnbekendDaysInput.value || 7)
  };
  update(ref(db, speltak + "/meldingen"), obj);
}

/* -----------------------------------------------------
   HEADER / TABEL
----------------------------------------------------- */

function clearNode(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

function addTH(row, text, rowSpan = 1, colSpan = 1, extra = "") {
  const th = document.createElement("th");
  th.textContent = text;
  th.rowSpan = rowSpan;
  th.colSpan = colSpan;
  if (extra) th.classList.add(extra);
  row.appendChild(th);
}

function renderTable() {
  clearNode(headerRowTop);
  clearNode(tableBody);

  const zichtbareJeugd = jeugd.filter(j => !j.verborgen);
  const zichtbareLeiding = leiding.filter(l => !l.verborgen);

  // Bovenste rij
  addTH(headerRowTop, "🗑");
  addTH(headerRowTop, "Datum");
  addTH(headerRowTop, "Thema");
  addTH(headerRowTop, "Bijzonderheden");
  addTH(headerRowTop, "Type");
  addTH(headerRowTop, "Start");
  addTH(headerRowTop, "Eind");
  addTH(headerRowTop, "Locatie", 1, 1, "col-locatie");

  if (isAdmin) addTH(headerRowTop, "Procor", 1, 1, "col-procor");

      addTH(headerRowTop, "Bert 🧸", 1, 1, "col-bert");
      addTH(headerRowTop, "Aanw. Leden", 1, 1, "aanw-count");
      addTH(headerRowTop, "Aanw. Leiding", 1, 1, "aanw-count");
    
      // --- JEUGD NAMEN ---
      zichtbareJeugd.forEach(j => {
        const th = document.createElement("th");
        th.textContent = j.naam;
        th.classList.add("name-vertical", "presence-col");
        headerRowTop.appendChild(th);
      });
    
      // --- KIJKERS ---
      const kijkersTh = document.createElement("th");
      kijkersTh.textContent = "Kijkers";
      kijkersTh.classList.add("presence-col");
      headerRowTop.appendChild(kijkersTh);
    
      // --- LEIDING NAMEN ---
      zichtbareLeiding.forEach((l, index) => {
        const th = document.createElement("th");
        th.textContent = l.naam;
        th.classList.add("name-vertical", "presence-col");
        if (index === 0) th.classList.add("col-split"); // dikke lijn voor eerste leiding
        headerRowTop.appendChild(th);
      });
    
      // --- EXTRA LEIDING ---
      const extraTh = document.createElement("th");
      extraTh.textContent = "Extra";
      extraTh.classList.add("presence-col");
      headerRowTop.appendChild(extraTh);

  // Filter
  let lijst = [...opkomsten];
  if (filterMode === "future") lijst = lijst.filter(o => isFutureOrToday(o.datum));
  if (filterMode === "past")   lijst = lijst.filter(o => isPast(o.datum));

  lijst.forEach(o => {
    const tr = document.createElement("tr");

    if (!o.datum) {
      tr.classList.add("row-next");
    } else if (isPast(o.datum)) {
      tr.classList.add("row-grey");
    }

    if (o.typeOpkomst === "bijzonder") tr.classList.add("row-bijzonder");
    if (o.typeOpkomst === "kamp")      tr.classList.add("row-kamp");
    if (o.typeOpkomst === "geen")      tr.classList.add("row-grey");

    addDeleteCell(tr, o);
    addDatumCell(tr, o);
    addEditableTextCell(tr, o, "thema", "Typ thema…");
    addEditableTextCell(tr, o, "bijzonderheden", "Typ bijzonderheden…");
    addTypeCell(tr, o);
    addTimeCell(tr, o, "starttijd");
    addTimeCell(tr, o, "eindtijd");
    addLocatieCell(tr, o);

    if (isAdmin) addProcorCell(tr, o);
    addBertCell(tr, o);

    ensurePresenceStructure(o, zichtbareJeugd, zichtbareLeiding);

    const [cntJ, cntL] = countAanwezigen(o, zichtbareJeugd, zichtbareLeiding);

    // Extra aantallen uit de numerieke kolommen
    const kijkersCount = Number(o.kijkers || 0);
    const extraCount   = Number(o.extraLeiding || 0);

    const totaalLeden   = cntJ + kijkersCount;
    const totaalLeiding = cntL + extraCount;

    addStaticCell(tr, totaalLeden,   "aanw-count");
    addStaticCell(tr, totaalLeiding, "aanw-count");

    // Jeugd-aanwezigheid
    zichtbareJeugd.forEach(j => {
      const td = makePresenceCell(o, j.id);
      td.classList.add("presence-col");
      tr.appendChild(td);
    });

    // Kolom "Kijkers"
    addKijkersCell(tr, o);

    // Leiding-aanwezigheid
    zichtbareLeiding.forEach((l, idx) => {
      const td = makePresenceCell(o, "leiding-" + l.id);
      td.classList.add("presence-col");
      if (idx === 0) td.classList.add("col-split");
      tr.appendChild(td);
    });

    // Kolom "Extra" voor extra leiding
    addExtraLeidingCell(tr, o);

    tableBody.appendChild(tr);
  });

  addOpkomstRow.classList.toggle("hidden", !isAdmin);
}

function addStaticCell(tr, text, extra) {
  const td = document.createElement("td");
  td.textContent = text;
  if (extra) td.classList.add(extra);
  tr.appendChild(td);
}

// Generieke helper voor numerieke kolommen (Kijkers / Extra)
function addNumberCell(tr, o, field) {
  const td = document.createElement("td");
  td.classList.add("presence-col");

  const value = Number(o[field] || 0);

  if (isAdmin) {
    const input = document.createElement("input");
    input.type = "number";
    input.min = "0";
    input.step = "1";
    input.value = value ? String(value) : "";
    input.placeholder = "0";

    input.addEventListener("change", () => {
      const num = parseInt(input.value, 10) || 0;
      const obj = {};
      obj[field] = num;
      update(ref(db, `${speltak}/opkomsten/${o.id}`), obj);
    });

    td.appendChild(input);
  } else {
    td.textContent = value ? String(value) : "";
  }

  tr.appendChild(td);
}

function addKijkersCell(tr, o) {
  addNumberCell(tr, o, "kijkers");
}

function addExtraLeidingCell(tr, o) {
  addNumberCell(tr, o, "extraLeiding");
}

/* -----------------------------------------------------
   DELETE
----------------------------------------------------- */

function addDeleteCell(tr, o) {
  const td = document.createElement("td");
  if (isAdmin) {
    td.textContent = "✖";
    td.classList.add("delete-btn");
    td.addEventListener("click", () => {
      if (confirm("Deze opkomst verwijderen?")) {
        remove(ref(db, `${speltak}/opkomsten/${o.id}`));
      }
    });
  }
  tr.appendChild(td);
}

/* -----------------------------------------------------
   DATUM — nieuw: direct datepicker bij lege datum
----------------------------------------------------- */

function addDatumCell(tr, o) {
  const td = document.createElement("td");

  if (isAdmin && !o.datum) {
    const input = document.createElement("input");
    input.type = "date";
    input.placeholder = "Datum";
    td.appendChild(input);

    input.addEventListener("change", () => {
      update(ref(db, `${speltak}/opkomsten/${o.id}`), { datum: input.value });
    });

    tr.appendChild(td);
    return;
  }

  td.textContent = toDisplayDate(o.datum);

  if (isAdmin) {
    td.classList.add("editable");
    td.addEventListener("click", () => {
      const input = document.createElement("input");
      input.type = "date";
      input.value = o.datum || "";
      td.innerHTML = "";
      td.appendChild(input);
      input.focus();

      input.addEventListener("change", () => {
        update(ref(db, `${speltak}/opkomsten/${o.id}`), { datum: input.value });
      });
    });
  }

  tr.appendChild(td);
}

/* -----------------------------------------------------
   DIRECT EDIT FOR THEMA / BIJZONDERHEDEN
----------------------------------------------------- */

function addEditableTextCell(tr, o, field, placeholder) {
  const td = document.createElement("td");

  if (isAdmin && !o[field]) {
    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = placeholder;

    input.addEventListener("change", () => {
      update(ref(db, `${speltak}/opkomsten/${o.id}`), { [field]: input.value });
    });

    td.appendChild(input);
    tr.appendChild(td);
    return;
  }

  td.textContent = o[field] || "";

  if (isAdmin) {
    td.classList.add("editable");
    td.addEventListener("click", () => {
      const input = document.createElement("input");
      input.type = "text";
      input.value = o[field] || "";
      td.innerHTML = "";
      td.appendChild(input);
      input.focus();

      input.addEventListener("change", () => {
        update(ref(db, `${speltak}/opkomsten/${o.id}`), { [field]: input.value });
      });
    });
  }

  tr.appendChild(td);
}

/* -----------------------------------------------------
   TYPE OPKOMST — direct dropdown
----------------------------------------------------- */

function addTypeCell(tr, o) {
  const td = document.createElement("td");
  const type = o.typeOpkomst || "";

  if (isAdmin && !type) {
    const select = document.createElement("select");
    [
      { value: "",         label: "Selecteer…" },
      { value: "normaal",  label: "Normale opkomst" },
      { value: "bijzonder",label: "Bijzondere opkomst" },
      { value: "kamp",     label: "Kamp" },
      { value: "geen",     label: "Geen opkomst" }
    ].forEach(opt => {
      const el = document.createElement("option");
      el.value = opt.value;
      el.textContent = opt.label;
      select.appendChild(el);
    });

    select.addEventListener("change", () => {
      update(ref(db, `${speltak}/opkomsten/${o.id}`), { typeOpkomst: select.value });
    });

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
    td.addEventListener("click", () => {
      const select = document.createElement("select");

      [
        { value: "",         label: "Selecteer…" },
        { value: "normaal",  label: "Normale opkomst" },
        { value: "bijzonder",label: "Bijzondere opkomst" },
        { value: "kamp",     label: "Kamp" },
        { value: "geen",     label: "Geen opkomst" }
      ].forEach(opt => {
        const el = document.createElement("option");
        el.value = opt.value;
        el.textContent = opt.label;
        if (opt.value === type) el.selected = true;
        select.appendChild(el);
      });

      td.innerHTML = "";
      td.appendChild(select);
      select.focus();

      select.addEventListener("change", () => {
        update(ref(db, `${speltak}/opkomsten/${o.id}`), { typeOpkomst: select.value });
      });
    });
  }

  tr.appendChild(td);
}

/* -----------------------------------------------------
   TIJD / LOCATIE / PROCoR / BERT
----------------------------------------------------- */

function addTimeCell(tr, o, field) {
  const td = document.createElement("td");
  const val = o[field] || "";

  if (isAdmin) {
    const input = document.createElement("input");
    input.type = "time";
    input.value = val;
    td.appendChild(input);

    input.addEventListener("change", () => {
      const obj = {};
      obj[field] = input.value;
      update(ref(db, `${speltak}/opkomsten/${o.id}`), obj);
    });
  } else {
    td.textContent = val;
  }

  tr.appendChild(td);
}

function addLocatieCell(tr, o) {
  const td = document.createElement("td");
  td.classList.add("col-locatie");
  const val = o.locatie || "";


  if (isAdmin) {
    const input = document.createElement("input");
    input.type = "text";
    input.value = val;
    td.appendChild(input);

    input.addEventListener("change", () => {
      update(ref(db, `${speltak}/opkomsten/${o.id}`), { locatie: input.value });
    });
  } else {
    td.textContent = val;
  }

  tr.appendChild(td);
}

function addProcorCell(tr, o) {
  const td = document.createElement("td");
  const val = o.procor || "";

  if (isAdmin) {
    const input = document.createElement("input");
    input.type = "text";
    input.value = val;
    td.appendChild(input);

    input.addEventListener("change", () => {
      update(ref(db, `${speltak}/opkomsten/${o.id}`), { procor: input.value });
    });
  } else {
    td.textContent = val;
  }

  td.classList.add("col-procor");
  tr.appendChild(td);
}

function addBertCell(tr, o) {
  const td = document.createElement("td");
  const val = o.bert_met || "";

  if (isAdmin) {
    const input = document.createElement("input");
    input.type = "text";
    input.value = val;
    td.appendChild(input);

    input.addEventListener("change", () => {
      update(ref(db, `${speltak}/opkomsten/${o.id}`), { bert_met: input.value });
    });
  } else {
    td.textContent = val;
  }

  td.classList.add("col-bert");
  tr.appendChild(td);
}

/* -----------------------------------------------------
   AANWEZIGHEID
----------------------------------------------------- */

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
  const state = o.aanwezigheid[key] || "onbekend";

  const symbolen = {
    aanwezig: "✔",
    afwezig:  "✖",
    onbekend: "?"
  };

  td.textContent = symbolen[state];

  if (isAdmin) {
    td.classList.add("presence-editable");
    td.addEventListener("click", () => {
      const next = state === "aanwezig"
        ? "afwezig"
        : state === "afwezig"
        ? "onbekend"
        : "aanwezig";

      o.aanwezigheid[key] = next;
      update(ref(db, `${speltak}/opkomsten/${o.id}`), { aanwezigheid: o.aanwezigheid });
    });
  }

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

/* -----------------------------------------------------
   NIEUWE OPKOMST
----------------------------------------------------- */

function addOpkomst() {
  if (!isAdmin) return;

  const idRef = push(ref(db, `${speltak}/opkomsten`));
  const id = idRef.key;

  const nieuw = {
    id,
    datum: "",
    thema: "",
    bijzonderheden: "",
    typeOpkomst: "",
    starttijd: "",
    eindtijd: "",
    locatie: "",
    procor: "",
    bert_met: "",
    kijkers: 0,
    extraLeiding: 0,
    aanwezigheid: {}
  };

  set(idRef, nieuw);
}

/* -----------------------------------------------------
   LEDENBEHEER
----------------------------------------------------- */

function renderLedenbeheer() {
  if (!ledenbeheerJeugdList || !ledenbeheerLeidingList) return;

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

  const up   = mkLidBtn("▲", () => moveLid(type, index, -1));
  const down = mkLidBtn("▼", () => moveLid(type, index, 1));
  const edit = mkLidBtn("✏", () => renameLid(type, lid));
  const hide = mkLidBtn(lid.verborgen ? "👁" : "🚫", () => toggleVerborgen(type, lid));
  const del  = mkLidBtn("🗑", () => deleteLid(type, lid));

  controls.append(up, down, edit, hide, del);
  li.append(name, controls);
  return li;
}

function mkLidBtn(text, fn) {
  const b = document.createElement("button");
  b.textContent = text;
  b.classList.add("ledenbeheer-btn");
  b.addEventListener("click", fn);
  return b;
}

function moveLid(type, index, delta) {
  const lijst = type === "jeugd" ? [...jeugd] : [...leiding];
  const nieuwIndex = index + delta;
  if (nieuwIndex < 0 || nieuwIndex >= lijst.length) return;

  const item = lijst.splice(index, 1)[0];
  lijst.splice(nieuwIndex, 0, item);

  lijst.forEach((l, i) => l.volgorde = i);

  const path = type === "jeugd" ? "jeugdleden" : "leiding";
  const updates = {};
  lijst.forEach(l => {
    updates[`${path}/${l.id}/volgorde`] = l.volgorde;
  });
  update(ref(db, speltak), updates);
}

function renameLid(type, lid) {
  const nieuw = prompt("Nieuwe naam:", lid.naam);
  if (!nieuw) return;
  const path = type === "jeugd" ? "jeugdleden" : "leiding";
  update(ref(db, `${speltak}/${path}/${lid.id}`), { naam: nieuw });
}

function toggleVerborgen(type, lid) {
  const path = type === "jeugd" ? "jeugdleden" : "leiding";
  update(ref(db, `${speltak}/${path}/${lid.id}`), { hidden: !lid.verborgen });
}

function deleteLid(type, lid) {
  if (!confirm(`Lid ${lid.naam} verwijderen?`)) return;
  const path = type === "jeugd" ? "jeugdleden" : "leiding";
  remove(ref(db, `${speltak}/${path}/${lid.id}`));
}

/* -----------------------------------------------------
   ADMIN, FILTER, PRINT
----------------------------------------------------- */

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

function doPrint() {
  window.print();
}

/* -----------------------------------------------------
   INIT
----------------------------------------------------- */

if (editModeButton)    editModeButton.addEventListener("click", toggleAdmin);
if (addOpkomstRow)     addOpkomstRow.addEventListener("click", addOpkomst);
if (saveInfoButton)    saveInfoButton.addEventListener("click", saveInfoTekst);
if (meldingenSaveButton) meldingenSaveButton.addEventListener("click", saveMeldingenInstellingen);

if (filterAll)    filterAll.addEventListener("click", () => setFilter("all"));
if (filterFuture) filterFuture.addEventListener("click", () => setFilter("future"));
if (filterPast)   filterPast.addEventListener("click", () => setFilter("past"));
if (printButton)  printButton.addEventListener("click", doPrint);

loadData();
