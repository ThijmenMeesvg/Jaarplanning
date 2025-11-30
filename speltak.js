// speltak.js – gedeeld voor alle speltak-pagina's

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
let filterMode = "all"; // all | future | past

let opkomsten = [];   // [{id,...}]
let jeugd = [];       // [{id,naam,verborgen,volgorde}]
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
const headerRowBottom = document.getElementById("headerRowBottom");
const tableBody       = document.getElementById("tableBody");
const addOpkomstRow   = document.getElementById("addOpkomstRow");

const editModeButton  = document.getElementById("editModeButton");
const addMemberButton = document.getElementById("addMemberButton");
const ledenbeheerButton = document.getElementById("ledenbeheerButton");
const mailboxButton   = document.getElementById("mailboxButton");
const handleidingButton = document.getElementById("handleidingButton");
const instellingenButton = document.getElementById("instellingenButton");

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

const meldingenSection        = document.getElementById("meldingen");
const meldLeidingEnabledInput   = document.getElementById("meldLeidingEnabled");
const meldLeidingThresholdInput = document.getElementById("meldLeidingThreshold");
const meldOnbekendEnabledInput  = document.getElementById("meldOnbekendEnabled");
const meldOnbekendDaysInput     = document.getElementById("meldOnbekendDays");
const saveMeldingenButton       = document.getElementById("saveMeldingenButton");
const testMeldingenButton       = document.getElementById("testMeldingenButton");

/* -----------------------------------------------------
   DATUM HELPERS
----------------------------------------------------- */

function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function toDisplayDate(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}-${m}-${y}`;
}

function fromDisplayDate(display) {
  if (!display) return "";
  const [d, m, y] = display.split("-");
  if (!d || !m || !y) return "";
  return `${y}-${m}-${d}`;
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
   LOAD DATA
----------------------------------------------------- */

function loadData() {
  const spRef = ref(db, speltak);

  onValue(spRef, (snapshot) => {
    const data = snapshot.val() || {};

    // info
    infoTekst = data.info || "";
    infoTekstP.textContent = infoTekst || "Hier kun je belangrijke telefoonnummers en taken van de leiding kwijt.";
    infoTekstEdit.value = infoTekst;

    // meldingen
    const m = data.meldingen || {};
    meldingenInstellingen = {
      leidingEnabled: !!m.leidingEnabled,
      leidingThreshold: m.leidingThreshold ?? 3,
      onbekendEnabled: !!m.onbekendEnabled,
      onbekendDays: m.onbekendDays ?? 7
    };
    renderMeldingenInstellingen();

    // leden
    jeugd = Object.entries(data.jeugdleden || {}).map(([id, v]) => ({
      id,
      naam: v.naam || "",
      verborgen: !!v.hidden,
      volgorde: v.volgorde ?? 0
    })).sort((a, b) => a.volgorde - b.volgorde || a.naam.localeCompare(b.naam, "nl"));

    leiding = Object.entries(data.leiding || {}).map(([id, v]) => ({
      id,
      naam: v.naam || "",
      verborgen: !!v.hidden,
      volgorde: v.volgorde ?? 0
    })).sort((a, b) => a.volgorde - b.volgorde || a.naam.localeCompare(b.naam, "nl"));

    // opkomsten
    opkomsten = Object.entries(data.opkomsten || {})
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => compareISO(a.datum || "", b.datum || ""));

    renderTable();
    renderLedenbeheer();
  });
}

/* -----------------------------------------------------
   RENDER MELDINGEN INSTELLINGEN
----------------------------------------------------- */

function renderMeldingenInstellingen() {
  meldLeidingEnabledInput.checked = meldingenInstellingen.leidingEnabled;
  meldLeidingThresholdInput.value = meldingenInstellingen.leidingThreshold;
  meldOnbekendEnabledInput.checked = meldingenInstellingen.onbekendEnabled;
  meldOnbekendDaysInput.value = meldingenInstellingen.onbekendDays;
}

/* -----------------------------------------------------
   TABEL
----------------------------------------------------- */

function clearNode(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

function renderTable() {
  clearNode(headerRowTop);
  clearNode(headerRowBottom);
  clearNode(tableBody);

  // HEADER 1
  addTH(headerRowTop, "🗑", 1, 2);
  addTH(headerRowTop, "Datum", 1, 2);
  addTH(headerRowTop, "Thema", 1, 2);
  addTH(headerRowTop, "Bijzonderheden", 1, 2);
  addTH(headerRowTop, "Type", 1, 2);
  addTH(headerRowTop, "Start", 1, 2);
  addTH(headerRowTop, "Eind", 1, 2);
  addTH(headerRowTop, "Locatie", 1, 2);

  if (isAdmin) addTH(headerRowTop, "Procor", 1, 2, "col-procor");

  addTH(headerRowTop, "Bert 🧸", 1, 2, "col-bert");
  addTH(headerRowTop, "Aanw. Leden", 1, 2, "aanw-count");
  addTH(headerRowTop, "Aanw. Leiding", 1, 2, "aanw-count");

  const zichtbareJeugd = jeugd.filter(j => !j.verborgen);
  const zichtbareLeiding = leiding.filter(l => !l.verborgen);

  // HEADER 2: namen
  zichtbareJeugd.forEach(j => {
    const th = document.createElement("th");
    th.textContent = j.naam;
    th.classList.add("name-vertical", "col-jeugd");
    headerRowBottom.appendChild(th);
  });

  zichtbareLeiding.forEach((l, idx) => {
    const th = document.createElement("th");
    th.textContent = l.naam;
    th.classList.add("name-vertical", "col-leiding");
    if (idx === 0) th.classList.add("col-split");
    headerRowBottom.appendChild(th);
  });

  // filter + volgorde
  let lijst = [...opkomsten];
  if (filterMode === "future") lijst = lijst.filter(o => isFutureOrToday(o.datum));
  if (filterMode === "past") lijst = lijst.filter(o => isPast(o.datum));

  const future = lijst.filter(o => isFutureOrToday(o.datum));
  const nextId = future.length ? future[0].id : null;

  lijst.forEach(o => {
    ensurePresenceStructure(o, zichtbareJeugd, zichtbareLeiding);

    const tr = document.createElement("tr");

    if (isPast(o.datum)) tr.classList.add("row-grey");
    else if (o.id === nextId) tr.classList.add("row-next");

    if (o.typeOpkomst === "bijzonder") tr.classList.add("row-bijzonder");
    if (o.typeOpkomst === "kamp") tr.classList.add("row-kamp");

    addDeleteCell(tr, o);
    addDatumCell(tr, o);
    addTextCell(tr, o, "thema");
    addTextCell(tr, o, "bijzonderheden");
    addTypeCell(tr, o);
    addTimeCell(tr, o, "starttijd", "10:30");
    addTimeCell(tr, o, "eindtijd", "12:30");
    addLocatieCell(tr, o);

    if (isAdmin) addProcorCell(tr, o);

    addBertCell(tr, o);

    // aantallen
    const [cntJ, cntL] = countAanwezigen(o, zichtbareJeugd, zichtbareLeiding);
    addStaticCell(tr, String(cntJ), "aanw-count");
    addStaticCell(tr, String(cntL), "aanw-count");

    // jeugd aanwezigheid
    zichtbareJeugd.forEach(j => {
      const key = j.id;
      const status = o.aanwezigheid && o.aanwezigheid[key] ? o.aanwezigheid[key] : "onbekend";
      const td = makePresenceCell(o, key, status, "jeugd");
      tr.appendChild(td);
    });

    // leiding aanwezigheid
    zichtbareLeiding.forEach((l, idx) => {
      const key = "leiding-" + l.id;
      const status = o.aanwezigheid && o.aanwezigheid[key] ? o.aanwezigheid[key] : "onbekend";
      const td = makePresenceCell(o, key, status, "leiding");
      if (idx === 0) td.classList.add("col-split");
      tr.appendChild(td);
    });

    tableBody.appendChild(tr);
  });

  // + opkomst rij
  addOpkomstRow.classList.toggle("hidden", !isAdmin);
}

/* helpers header / cellen */

function addTH(row, text, rowSpan = 1, colSpan = 1, extra = "") {
  const th = document.createElement("th");
  th.textContent = text;
  if (rowSpan) th.rowSpan = rowSpan;
  if (colSpan) th.colSpan = colSpan;
  if (extra) extra.split(" ").forEach(c => th.classList.add(c));
  row.appendChild(th);
}

function addStaticCell(tr, text, extra = "") {
  const td = document.createElement("td");
  td.textContent = text;
  if (extra) extra.split(" ").forEach(c => td.classList.add(c));
  tr.appendChild(td);
}

/* delete */

function addDeleteCell(tr, o) {
  const td = document.createElement("td");
  td.classList.add("delete-btn");
  if (isAdmin) {
    td.textContent = "✖";
    td.addEventListener("click", () => {
      if (confirm("Deze opkomst verwijderen?")) {
        remove(ref(db, `${speltak}/opkomsten/${o.id}`));
      }
    });
  } else {
    td.textContent = "";
  }
  tr.appendChild(td);
}

/* datum */

function addDatumCell(tr, o) {
  const td = document.createElement("td");
  td.textContent = toDisplayDate(o.datum);
  if (isAdmin) {
    td.classList.add("editable");
    td.addEventListener("click", () => {
      const input = document.createElement("input");
      input.type = "date";
      input.value = o.datum || todayISO();
      td.innerHTML = "";
      td.appendChild(input);
      input.focus();

      input.addEventListener("blur", () => {
        const newVal = input.value;
        if (newVal) {
          update(ref(db, `${speltak}/opkomsten/${o.id}`), { datum: newVal });
        }
      });
    });
  }
  tr.appendChild(td);
}

/* tekstvelden */

function addTextCell(tr, o, field) {
  const td = document.createElement("td");
  td.textContent = o[field] || "";
  if (isAdmin) {
    td.classList.add("editable");
    td.addEventListener("click", () => {
      const nieuw = prompt(`Nieuwe waarde voor ${field}:`, o[field] || "");
      if (nieuw !== null) {
        const obj = {};
        obj[field] = nieuw;
        update(ref(db, `${speltak}/opkomsten/${o.id}`), obj);
      }
    });
  }
  tr.appendChild(td);
}

/* type */

function addTypeCell(tr, o) {
  const td = document.createElement("td");
  const labels = { normaal: "Normaal", bijzonder: "Bijzonder", kamp: "Kamp" };
  const type = o.typeOpkomst || "normaal";
  td.textContent = labels[type] || "Normaal";

  if (isAdmin) {
    td.classList.add("editable");
    td.addEventListener("click", () => {
      const select = document.createElement("select");
      [
        { value: "normaal", label: "Normale opkomst" },
        { value: "bijzonder", label: "Bijzondere opkomst" },
        { value: "kamp", label: "Kamp" }
      ].forEach(opt => {
        const op = document.createElement("option");
        op.value = opt.value;
        op.textContent = opt.label;
        if (opt.value === type) op.selected = true;
        select.appendChild(op);
      });

      td.innerHTML = "";
      td.appendChild(select);
      select.focus();

      select.addEventListener("blur", () => {
        update(ref(db, `${speltak}/opkomsten/${o.id}`), { typeOpkomst: select.value });
      });
    });
  }

  tr.appendChild(td);
}

/* tijden */

function addTimeCell(tr, o, field, def) {
  const td = document.createElement("td");
  td.textContent = o[field] || def;
  if (isAdmin) {
    td.classList.add("editable");
    td.addEventListener("click", () => {
      const nieuw = prompt(`Nieuwe tijd voor ${field} (hh:mm):`, td.textContent || def);
      if (nieuw !== null) {
        const obj = {};
        obj[field] = nieuw;
        update(ref(db, `${speltak}/opkomsten/${o.id}`), obj);
      }
    });
  }
  tr.appendChild(td);
}

/* locatie */

function addLocatieCell(tr, o) {
  const td = document.createElement("td");
  td.textContent = o.locatie || "";
  if (isAdmin) {
    td.classList.add("editable");
    td.addEventListener("click", () => {
      const select = document.createElement("select");
      const opties = [
        "",
        "Bever lokaal",
        "Welpen lokaal",
        "De hoop",
        "Zandveld",
        "Kampvuurkuil",
        "Grasveld",
        "Van terrein af",
        "Niet op locatie"
      ];
      opties.forEach(opt => {
        const op = document.createElement("option");
        op.value = opt;
        op.textContent = opt || "(geen)";
        if (opt === (o.locatie || "")) op.selected = true;
        select.appendChild(op);
      });

      td.innerHTML = "";
      td.appendChild(select);
      select.focus();

      select.addEventListener("blur", () => {
        update(ref(db, `${speltak}/opkomsten/${o.id}`), { locatie: select.value });
      });
    });
  }
  tr.appendChild(td);
}

/* procor – alleen admin */

function addProcorCell(tr, o) {
  const td = document.createElement("td");
  td.textContent = o.procor || "";
  td.classList.add("col-procor");
  if (isAdmin) {
    td.classList.add("editable");
    td.addEventListener("click", () => {
      const nieuw = prompt("Wie is Procor/juf voor deze opkomst?", o.procor || "");
      if (nieuw !== null) {
        update(ref(db, `${speltak}/opkomsten/${o.id}`), { procor: nieuw });
      }
    });
  }
  tr.appendChild(td);
}

/* Bert */

function addBertCell(tr, o) {
  const td = document.createElement("td");
  td.textContent = o.bert_met || "";
  td.classList.add("col-bert");
  if (isAdmin) {
    td.classList.add("editable");
    td.addEventListener("click", () => {
      const nieuw = prompt("Met welk lid gaat Bert mee naar huis?", o.bert_met || "");
      if (nieuw !== null) {
        update(ref(db, `${speltak}/opkomsten/${o.id}`), { bert_met: nieuw });
      }
    });
  }
  tr.appendChild(td);
}

/* aanwezigheid */

function ensurePresenceStructure(o, zichtbareJeugd, zichtbareLeiding) {
  if (!o.aanwezigheid) o.aanwezigheid = {};
  zichtbareJeugd.forEach(j => {
    if (!o.aanwezigheid[j.id]) o.aanwezigheid[j.id] = "onbekend";
  });
  zichtbareLeiding.forEach(l => {
    const key = "leiding-" + l.id;
    if (!o.aanwezigheid[key]) o.aanwezigheid[key] = "onbekend";
  });
}

function countAanwezigen(o, zichtbareJeugd, zichtbareLeiding) {
  let j = 0, l = 0;
  zichtbareJeugd.forEach(x => {
    if (o.aanwezigheid && o.aanwezigheid[x.id] === "aanwezig") j++;
  });
  zichtbareLeiding.forEach(x => {
    if (o.aanwezigheid && o.aanwezigheid["leiding-" + x.id] === "aanwezig") l++;
  });
  return [j, l];
}

function makePresenceCell(o, key, status, groep) {
  const td = document.createElement("td");
  td.classList.add("presence-cell", "presence-col");

  function apply() {
    td.classList.remove("presence-aanwezig", "presence-afwezig", "presence-reminder");
    let sym = "?";
    if (status === "aanwezig") {
      sym = "✔";
      td.classList.add("presence-aanwezig");
    } else if (status === "afwezig") {
      sym = "✖";
      td.classList.add("presence-afwezig");
    } else {
      sym = "?";
      if (meldingenInstellingen.onbekendEnabled &&
          isBinnenNDagen(o.datum, 3)) {
        sym = "!";
        td.classList.add("presence-reminder");
      }
    }
    td.textContent = sym;
  }

  apply();

  td.addEventListener("click", () => {
    if (!o.aanwezigheid) o.aanwezigheid = {};
    if (status === "onbekend") status = "aanwezig";
    else if (status === "aanwezig") status = "afwezig";
    else status = "onbekend";

    update(ref(db, `${speltak}/opkomsten/${o.id}/aanwezigheid`), { [key]: status });
  });

  return td;
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
  b.addEventListener("click", fn);
  return b;
}

function moveLid(type, index, delta) {
  const list = type === "jeugd" ? [...jeugd] : [...leiding];
  const nieuwIndex = index + delta;
  if (nieuwIndex < 0 || nieuwIndex >= list.length) return;

  const tmp = list[index].volgorde;
  list[index].volgorde = list[nieuwIndex].volgorde;
  list[nieuwIndex].volgorde = tmp;

  list.forEach((lid) => {
    update(ref(db, `${speltak}/${type === "jeugd" ? "jeugdleden" : "leiding"}/${lid.id}`),
      { volgorde: lid.volgorde });
  });
}

function renameLid(type, lid) {
  const nieuw = prompt("Nieuwe naam:", lid.naam);
  if (!nieuw) return;
  update(ref(db, `${speltak}/${type === "jeugd" ? "jeugdleden" : "leiding"}/${lid.id}`),
    { naam: nieuw });
}

function toggleVerborgen(type, lid) {
  update(ref(db, `${speltak}/${type === "jeugd" ? "jeugdleden" : "leiding"}/${lid.id}`),
    { hidden: !lid.verborgen });
}

function deleteLid(type, lid) {
  if (!confirm(`Lid "${lid.naam}" verwijderen?`)) return;

  remove(ref(db, `${speltak}/${type === "jeugd" ? "jeugdleden" : "leiding"}/${lid.id}`));

  // verwijder aanwezigheid
  opkomsten.forEach(o => {
    const key = type === "jeugd" ? lid.id : "leiding-" + lid.id;
    remove(ref(db, `${speltak}/opkomsten/${o.id}/aanwezigheid/${key}`));
  });
}

/* lid toevoegen */

function addLidPopup() {
  const naam = prompt("Naam van het lid:");
  if (!naam) return;

  const keuze = prompt("Typ J voor jeugdlid of L voor leiding:", "J");
  const type = !keuze ? "" : keuze.toLowerCase() === "l" ? "leiding" : "jeugd";
  if (!type) {
    alert("Gebruik J of L.");
    return;
  }

  const path = `${speltak}/${type === "jeugd" ? "jeugdleden" : "leiding"}`;
  const nieuwRef = push(ref(db, path));
  const volgorde = type === "jeugd" ? jeugd.length : leiding.length;

  set(nieuwRef, {
    naam,
    hidden: false,
    volgorde
  });
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
    datum: todayISO(),
    thema: "",
    bijzonderheden: "",
    typeOpkomst: "normaal",
    starttijd: "10:30",
    eindtijd: "12:30",
    locatie: "",
    procor: "",
    bert_met: "",
    aanwezigheid: {}
  };

  set(idRef, nieuw);
}

/* -----------------------------------------------------
   MELDINGEN OPSLAAN + TEST
----------------------------------------------------- */

function saveMeldingen() {
  const leidingEnabled = !!meldLeidingEnabledInput.checked;
  const leidingThreshold = parseInt(meldLeidingThresholdInput.value, 10) || 3;
  const onbekendEnabled = !!meldOnbekendEnabledInput.checked;
  const onbekendDays = parseInt(meldOnbekendDaysInput.value, 10) || 7;

  set(ref(db, `${speltak}/meldingen`), {
    leidingEnabled,
    leidingThreshold,
    onbekendEnabled,
    onbekendDays
  }).then(() => {
    alert("Meldingen opgeslagen.");
  });
}

function testMeldingen() {
  const problemen = [];

  opkomsten.forEach(o => {
    if (!o.datum) return;

    // te weinig leiding
    if (meldingenInstellingen.leidingEnabled) {
      let afwezig = 0;
      leiding.forEach(l => {
        const key = "leiding-" + l.id;
        if (o.aanwezigheid && o.aanwezigheid[key] === "afwezig") afwezig++;
      });
      if (afwezig >= meldingenInstellingen.leidingThreshold) {
        problemen.push(
          `Opkomst ${toDisplayDate(o.datum)} "${o.thema || ""}": ${afwezig} leiding afwezig.`
        );
      }
    }

    // onbekend
    if (meldingenInstellingen.onbekendEnabled &&
        isBinnenNDagen(o.datum, meldingenInstellingen.onbekendDays)) {

      let onbekend = 0;
      jeugd.forEach(j => {
        if (o.aanwezigheid && o.aanwezigheid[j.id] === "onbekend") onbekend++;
      });
      leiding.forEach(l => {
        const key = "leiding-" + l.id;
        if (o.aanwezigheid && o.aanwezigheid[key] === "onbekend") onbekend++;
      });

      if (onbekend > 0) {
        problemen.push(
          `Opkomst ${toDisplayDate(o.datum)} "${o.thema || ""}": ${onbekend} personen nog onbekend.`
        );
      }
    }
  });

  if (!problemen.length) {
    alert("Geen meldingen nodig op basis van de huidige instellingen.");
    return;
  }

  const subject = encodeURIComponent("Bevers – meldingen aanwezigheid");
  const body =
    encodeURIComponent("Overzicht meldingen:\n\n" + problemen.join("\n"));

  window.location.href =
    `mailto:ovnscouting+bevers@gmail.com?subject=${subject}&body=${body}`;
}

/* -----------------------------------------------------
   ADMIN MODUS / FILTER
----------------------------------------------------- */

function setFilter(mode) {
  filterMode = mode;
  filterAll.classList.toggle("active", mode === "all");
  filterFuture.classList.toggle("active", mode === "future");
  filterPast.classList.toggle("active", mode === "past");
  renderTable();
}

function toggleAdmin() {
  if (!isAdmin) {
    const pw = prompt("Wachtwoord voor bewerkmodus:");
    if (pw !== DEFAULT_ADMIN_PASSWORD) return;
    isAdmin = true;
  } else {
    isAdmin = false;
  }

  // knoppen alleen in admin
  addMemberButton.classList.toggle("hidden", !isAdmin);
  ledenbeheerButton.classList.toggle("hidden", !isAdmin);
  mailboxButton.classList.toggle("hidden", !isAdmin);
  handleidingButton.classList.toggle("hidden", !isAdmin);
  instellingenButton.classList.toggle("hidden", !isAdmin);

  // info-blok
  infoTekstP.classList.toggle("hidden", isAdmin);
  infoTekstEdit.classList.toggle("hidden", !isAdmin);
  saveInfoButton.classList.toggle("hidden", !isAdmin);

  // opkomst toevoegen
  addOpkomstRow.classList.toggle("hidden", !isAdmin);

  if (!isAdmin) {
    ledenbeheerSection.classList.add("hidden");
    meldingenSection.classList.add("hidden");
  }

  renderTable();
  renderLedenbeheer();
}

function toggleLedenbeheer() {
  if (!isAdmin) return;
  ledenbeheerSection.classList.toggle("hidden");
}

function toggleMeldingen() {
  if (!isAdmin) return;
  meldingenSection.classList.toggle("hidden");
}

/* -----------------------------------------------------
   INFO OPSLAAN
----------------------------------------------------- */

function saveInfo() {
  const txt = infoTekstEdit.value || "";
  set(ref(db, `${speltak}/info`), txt);
}

/* -----------------------------------------------------
   INIT
----------------------------------------------------- */

document.addEventListener("DOMContentLoaded", () => {
  loadData();

  if (editModeButton)   editModeButton.addEventListener("click", toggleAdmin);
  if (addMemberButton)  addMemberButton.addEventListener("click", addLidPopup);
  if (ledenbeheerButton) ledenbeheerButton.addEventListener("click", toggleLedenbeheer);
  if (instellingenButton) instellingenButton.addEventListener("click", toggleMeldingen);

  if (filterAll)    filterAll.addEventListener("click", () => setFilter("all"));
  if (filterFuture) filterFuture.addEventListener("click", () => setFilter("future"));
  if (filterPast)   filterPast.addEventListener("click", () => setFilter("past"));

  if (printButton)  printButton.addEventListener("click", () => window.print());

  if (saveInfoButton)       saveInfoButton.addEventListener("click", saveInfo);
  if (addOpkomstRow)        addOpkomstRow.addEventListener("click", addOpkomst);
  if (saveMeldingenButton)  saveMeldingenButton.addEventListener("click", saveMeldingen);
  if (testMeldingenButton)  testMeldingenButton.addEventListener("click", testMeldingen);
});
