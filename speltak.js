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
   DATE HELPERS
----------------------------------------------------- */

function todayISO() {
  const d = new Date();
  return d.toISOString().split("T")[0];
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
  const spRef = ref(db, speltak);

  onValue(spRef, (snapshot) => {
    const data = snapshot.val() || {};

    infoTekst = data.info || "";
    infoTekstP.textContent = infoTekst || "Hier kun je belangrijke telefoonnummers en taken van de leiding kwijt.";
    infoTekstEdit.value = infoTekst;

    const m = data.meldingen || {};
    meldingenInstellingen = {
      leidingEnabled: !!m.leidingEnabled,
      leidingThreshold: m.leidingThreshold ?? 3,
      onbekendEnabled: !!m.onbekendEnabled,
      onbekendDays: m.onbekendDays ?? 7
    };
    renderMeldingenInstellingen();

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

    renderTable();
    renderLedenbeheer();
  });
}
/* -----------------------------------------------------
   RENDER MELDINGEN INSTELLINGEN
----------------------------------------------------- */
function renderMeldingenInstellingen() {
  meldLeidingEnabledInput.checked = !!meldingenInstellingen.leidingEnabled;
  meldLeidingThresholdInput.value = meldingenInstellingen.leidingThreshold;
  meldOnbekendEnabledInput.checked = !!meldingenInstellingen.onbekendEnabled;
  meldOnbekendDaysInput.value = meldingenInstellingen.onbekendDays;
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
  clearNode(headerRowBottom);
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
  addTH(headerRowTop, "Locatie");

  if (isAdmin) addTH(headerRowTop, "Procor", 1, 1, "col-procor");

  addTH(headerRowTop, "Bert 🧸", 1, 1, "col-bert");
  addTH(headerRowTop, "Aanw. Leden", 1, 1, "aanw-count");
  addTH(headerRowTop, "Aanw. Leiding", 1, 1, "aanw-count");

  /* ---- JEUGD-KOLOMMEN + ZEBRA ---- */
      zichtbareJeugd.forEach(j => {
        const th = document.createElement("th");
        th.textContent = j.naam;
        th.classList.add("name-vertical", "presence-col", "zebra-jeugd");
        headerRowTop.appendChild(th);
      });
      
      /* ---- DIVIDER ---- */
      const divider = document.createElement("th");
      divider.classList.add("col-split");
      divider.textContent = "";
      headerRowTop.appendChild(divider);
      
      /* ---- LEIDING-KOLOMMEN + ZEBRA ---- */
      zichtbareLeiding.forEach(l => {
        const th = document.createElement("th");
        th.textContent = l.naam;
        th.classList.add("name-vertical", "presence-col", "zebra-leiding");
        headerRowTop.appendChild(th);
      });


  // Filter
  let lijst = [...opkomsten];
  if (filterMode === "future") lijst = lijst.filter(o => isFutureOrToday(o.datum));
  if (filterMode === "past") lijst = lijst.filter(o => isPast(o.datum));

  lijst.forEach(o => {
    const tr = document.createElement("tr");

    if (!o.datum) {
      tr.classList.add("row-next");
    }
    else if (isPast(o.datum)) {
      tr.classList.add("row-grey");
    }

    if (o.typeOpkomst === "bijzonder") tr.classList.add("row-bijzonder");
    if (o.typeOpkomst === "kamp") tr.classList.add("row-kamp");
    if (o.typeOpkomst === "geen") tr.classList.add("row-grey");

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
    addStaticCell(tr, cntJ, "aanw-count");
    addStaticCell(tr, cntL, "aanw-count");

    /* JEUGD → blauw */
    zichtbareJeugd.forEach(j => {
      const td = makePresenceCell(o, j.id);
      td.classList.add("zebra-jeugd");
      tr.appendChild(td);
    });
    
    /* LEIDING → geel */
    zichtbareLeiding.forEach((l, idx) => {
      const td = makePresenceCell(o, "leiding-" + l.id);
      td.classList.add("zebra-leiding");
      if (idx === 0) td.classList.add("col-split");
      tr.appendChild(td);
    });


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
   BEGIN/EIND TIJD
----------------------------------------------------- */

function addTimeCell(tr, o, field) {
  const td = document.createElement("td");
  const val = o[field] || "";

  if (isAdmin && !val) {
    const input = document.createElement("input");
    input.type = "time";

    input.addEventListener("change", () => {
      update(ref(db, `${speltak}/opkomsten/${o.id}`), { [field]: input.value });
    });

    td.appendChild(input);
    tr.appendChild(td);
    return;
  }

  td.textContent = val;

  if (isAdmin) {
    td.classList.add("editable");
    td.addEventListener("click", () => {
      const input = document.createElement("input");
      input.type = "time";
      input.value = val;
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
   LOCATIE — direct dropdown
----------------------------------------------------- */

function addLocatieCell(tr, o) {
  const td = document.createElement("td");

  if (isAdmin && !o.locatie) {
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

    select.addEventListener("change", () => {
      update(ref(db, `${speltak}/opkomsten/${o.id}`), { locatie: select.value });
    });

    td.appendChild(select);
    tr.appendChild(td);
    return;
  }

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
        if (opt === o.locatie) op.selected = true;
        select.appendChild(op);
      });

      td.innerHTML = "";
      td.appendChild(select);
      select.focus();

      select.addEventListener("change", () => {
        update(ref(db, `${speltak}/opkomsten/${o.id}`), { locatie: select.value });
      });
    });
  }

  tr.appendChild(td);
}

/* -----------------------------------------------------
   PROCOR
----------------------------------------------------- */

function addProcorCell(tr, o) {
  const td = document.createElement("td");
  td.textContent = o.procor || "";

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

/* -----------------------------------------------------
   BERT
----------------------------------------------------- */

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
  let status = o.aanwezigheid[key] || "onbekend";

  function apply() {
    td.classList.remove("presence-aanwezig", "presence-afwezig", "presence-reminder");
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

  td.addEventListener("click", () => {
    if (status === "onbekend") status = "aanwezig";
    else if (status === "aanwezig") status = "afwezig";
    else status = "onbekend";

    update(ref(db, `${speltak}/opkomsten/${o.id}/aanwezigheid`), { [key]: status });
  });

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
   NIEUWE OPKOMST (volledig vernieuwd)
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
    aanwezigheid: {}
  };

  set(idRef, nieuw);
}

/* -----------------------------------------------------
   LEDENBEHEER (ongewijzigd)
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

function saveInfo() {
  const txt = infoTekstEdit.value || "";
  set(ref(db, `${speltak}/info`), txt);
}

/* -----------------------------------------------------
   INIT
----------------------------------------------------- */

document.addEventListener("DOMContentLoaded", () => {
  loadData();

  editModeButton?.addEventListener("click", toggleAdmin);
  addMemberButton?.addEventListener("click", addLidPopup);
  ledenbeheerButton?.addEventListener("click", () => ledenbeheerSection.classList.toggle("hidden"));
  instellingenButton?.addEventListener("click", () => meldingenSection.classList.toggle("hidden"));

  filterAll?.addEventListener("click", () => setFilter("all"));
  filterFuture?.addEventListener("click", () => setFilter("future"));
  filterPast?.addEventListener("click", () => setFilter("past"));

  printButton?.addEventListener("click", () => window.print());

  saveInfoButton?.addEventListener("click", saveInfo);
  addOpkomstRow?.addEventListener("click", addOpkomst);
});
