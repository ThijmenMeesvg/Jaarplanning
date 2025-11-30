// speltak.js
// Logica voor alle speltak-pagina's (Bevers, etc.)

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
const speltak = body.dataset.speltak || "bevers";   // bv. "bevers"

const DEFAULT_ADMIN_PASSWORD = "bevers";            // eventueel later per speltak aanpassen

let isAdmin = false;
let filterMode = "all";  // all | future | past

let opkomsten = {};      // { id: { ... } }
let jeugd = [];          // [{id, naam, verborgen, volgorde}]
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

const editModeButton   = document.getElementById("editModeButton");
const addMemberButton  = document.getElementById("addMemberButton");
const ledenbeheerButton = document.getElementById("ledenbeheerButton");
const printButton      = document.getElementById("printButton");

const mailboxButton     = document.getElementById("mailboxButton");
const handleidingButton = document.getElementById("handleidingButton");
const instellingenButton = document.getElementById("instellingenButton");

const filterAll    = document.getElementById("filterAll");
const filterFuture = document.getElementById("filterFuture");
const filterPast   = document.getElementById("filterPast");

const infoTekstP     = document.getElementById("infotekst");
const infoTekstEdit  = document.getElementById("infotekst_edit");
const saveInfoButton = document.getElementById("saveInfoButton");

const ledenbeheerSection      = document.getElementById("ledenbeheer");
const ledenbeheerJeugdList    = document.getElementById("ledenbeheerJeugd");
const ledenbeheerLeidingList  = document.getElementById("ledenbeheerLeiding");

const meldingenSection        = document.getElementById("meldingen");
const meldLeidingEnabledInput = document.getElementById("meldLeidingEnabled");
const meldLeidingThresholdInput = document.getElementById("meldLeidingThreshold");
const meldOnbekendEnabledInput  = document.getElementById("meldOnbekendEnabled");
const meldOnbekendDaysInput     = document.getElementById("meldOnbekendDays");
const saveMeldingenButton       = document.getElementById("saveMeldingenButton");

/* -----------------------------------------------------
   HULPFUNCTIES DATUM / STATUS
----------------------------------------------------- */

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function toDisplayDate(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}-${m}-${y}`;
}

function fromDisplayDate(display) {
  if (!display) return "";
  const [d, m, y] = display.split("-");
  if (!y || !m || !d) return "";
  return `${y}-${m}-${d}`;
}

function compareISO(a, b) {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

function isPast(iso) {
  const today = todayISO();
  return iso && iso < today;
}

function isFutureOrToday(iso) {
  const today = todayISO();
  return iso && iso >= today;
}

function isBinnen3Dagen(iso) {
  if (!iso) return false;
  const d = new Date(iso + "T00:00:00");
  const now = new Date();
  const diff = d.getTime() - now.getTime();
  const dagen = diff / (1000 * 60 * 60 * 24);
  return dagen >= 0 && dagen <= 3;
}

/* -----------------------------------------------------
   FIREBASE LADEN
----------------------------------------------------- */

function loadData() {
  const spRef = ref(db, speltak);

  onValue(spRef, (snapshot) => {
    const data = snapshot.val() || {};

    opkomsten = data.opkomsten || {};
    const ledenData = data.leden || { jeugd: {}, leiding: {} };

    jeugd = Object.entries(ledenData.jeugd || {}).map(([id, v]) => ({
      id,
      naam: v.naam || "",
      verborgen: !!v.verborgen,
      volgorde: v.volgorde ?? 0
    })).sort((a, b) => a.volgorde - b.volgorde || a.naam.localeCompare(b.naam, "nl"));

    leiding = Object.entries(ledenData.leiding || {}).map(([id, v]) => ({
      id,
      naam: v.naam || "",
      verborgen: !!v.verborgen,
      volgorde: v.volgorde ?? 0
    })).sort((a, b) => a.volgorde - b.volgorde || a.naam.localeCompare(b.naam, "nl"));

    infoTekst = data.infoTekst || "";

    const m = data.meldingen || {};
    meldingenInstellingen = {
      leidingEnabled: !!m.leidingEnabled,
      leidingThreshold: m.leidingThreshold ?? 3,
      onbekendEnabled: !!m.onbekendEnabled,
      onbekendDays: m.onbekendDays ?? 7
    };

    renderInfo();
    renderMeldingenInstellingen();
    renderTable();
    renderLedenbeheer();
  });
}

/* -----------------------------------------------------
   RENDER INFO BLOK
----------------------------------------------------- */

function renderInfo() {
  infoTekstP.textContent = infoTekst || "Hier kun je belangrijke telefoonnummers en taken van de leiding kwijt.";
  infoTekstEdit.value = infoTekst;
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
   RENDER TABEL
----------------------------------------------------- */

function clearNode(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

function renderTable() {
  clearNode(headerRowTop);
  clearNode(headerRowBottom);
  clearNode(tableBody);

  // --- HEADER 1 ---
  addTH(headerRowTop, "🗑", 1, 2);

  addTH(headerRowTop, "Datum", 1, 2);
  addTH(headerRowTop, "Thema", 1, 2);
  addTH(headerRowTop, "Bijzonderheden", 1, 2);
  addTH(headerRowTop, "Type", 1, 2);
  addTH(headerRowTop, "Start", 1, 2);
  addTH(headerRowTop, "Eind", 1, 2);
  addTH(headerRowTop, "Locatie", 1, 2);

  if (isAdmin) {
    addTH(headerRowTop, "Procor", 1, 2, "col-procor aanw-column");
  }

  addTH(headerRowTop, "Bert 🧸", 1, 2, "col-bert aanw-column");
  addTH(headerRowTop, "Aanw. Leden", 1, 2, "aanw-column");
  addTH(headerRowTop, "Aanw. Leiding", 1, 2, "aanw-column");

  // --- HEADER 2: namen ---
  const visibleJeugd = jeugd.filter(l => !l.verborgen);
  const visibleLeiding = leiding.filter(l => !l.verborgen);

  // JEUGD namen
  visibleJeugd.forEach(lid => {
    const th = document.createElement("th");
    th.textContent = lid.naam;
    th.classList.add("name-vertical", "col-jeugd");
    headerRowBottom.appendChild(th);
  });

  // LEIDING namen
  visibleLeiding.forEach((lid, idx) => {
    const th = document.createElement("th");
    th.textContent = lid.naam;
    th.classList.add("name-vertical", "col-leiding");
    if (idx === 0) th.classList.add("col-split");
    headerRowBottom.appendChild(th);
  });

  // --- BODY ---
  const today = todayISO();

  let lijst = Object.values(opkomsten)
    .map(o => ({ ...o }))
    .sort((a, b) => compareISO(a.datum || "", b.datum || ""));

  if (filterMode === "future") {
    lijst = lijst.filter(o => isFutureOrToday(o.datum));
  } else if (filterMode === "past") {
    lijst = lijst.filter(o => isPast(o.datum));
  }

  // bepaal eerstvolgende opkomst
  const future = lijst.filter(o => isFutureOrToday(o.datum));
  const nextId = future.length ? future[0].id : null;

  lijst.forEach(o => {
    ensurePresenceStructure(o, visibleJeugd, visibleLeiding);

    const tr = document.createElement("tr");

    // basis kleur
    if (isPast(o.datum)) {
      tr.classList.add("row-grey");
    } else if (o.id === nextId) {
      tr.classList.add("row-next");
    }

    if (o.typeOpkomst === "bijzonder") {
      tr.classList.add("row-bijzonder");
    } else if (o.typeOpkomst === "kamp") {
      tr.classList.add("row-kamp");
    }

    // kolommen
    addDeleteCell(tr, o);
    addDatumCell(tr, o);
    addTextCell(tr, o, "thema");
    addTextCell(tr, o, "bijzonderheden");
    addTypeCell(tr, o);
    addTimeCell(tr, o, "starttijd");
    addTimeCell(tr, o, "eindtijd");
    addLocatieCell(tr, o);

    if (isAdmin) {
      addProcorCell(tr, o);
    }

    addBertCell(tr, o);

    // aantallen
    const [cntJeugd, cntLeiding] = countAanwezigen(o, visibleJeugd, visibleLeiding);
    addStaticCell(tr, String(cntJeugd), "aanw-count");
    addStaticCell(tr, String(cntLeiding), "aanw-count");

    // aanwezigheid jeugd
    visibleJeugd.forEach(lid => {
      const status = (o.aanwezigheidJeugd && o.aanwezigheidJeugd[lid.id]) || "onbekend";
      const td = makePresenceCell(o, "jeugd", lid.id, status);
      tr.appendChild(td);
    });

    // aanwezigheid leiding
    visibleLeiding.forEach((lid, idx) => {
      const status = (o.aanwezigheidLeiding && o.aanwezigheidLeiding[lid.id]) || "onbekend";
      const td = makePresenceCell(o, "leiding", lid.id, status);
      if (idx === 0) td.classList.add("col-split");
      tr.appendChild(td);
    });

    tableBody.appendChild(tr);
  });

  // + opkomst toevoegen rij (alleen in admin)
  if (isAdmin) {
    addOpkomstRow.classList.remove("hidden");
  } else {
    addOpkomstRow.classList.add("hidden");
  }
}

/* -----------------------------------------------------
   CELHULPERS
----------------------------------------------------- */

function addTH(row, text, rowSpan = 1, colSpan = 1, extraClass = "") {
  const th = document.createElement("th");
  th.textContent = text;
  if (rowSpan) th.rowSpan = rowSpan;
  if (colSpan) th.colSpan = colSpan;
  if (extraClass) {
    extraClass.split(" ").forEach(c => th.classList.add(c));
  }
  row.appendChild(th);
}

function addStaticCell(tr, text, extraClass = "") {
  const td = document.createElement("td");
  td.textContent = text;
  if (extraClass) td.classList.add(...extraClass.split(" "));
  tr.appendChild(td);
}

/* Delete */
function addDeleteCell(tr, o) {
  const td = document.createElement("td");
  td.classList.add("delete-btn");
  td.textContent = isAdmin ? "✖" : "";
  if (isAdmin) {
    td.addEventListener("click", () => {
      if (confirm("Deze opkomst verwijderen?")) {
        remove(ref(db, `${speltak}/opkomsten/${o.id}`));
      }
    });
  }
  tr.appendChild(td);
}

/* Datum */
function addDatumCell(tr, o) {
  const td = document.createElement("td");
  td.classList.add("editable");
  td.textContent = toDisplayDate(o.datum);

  if (isAdmin) {
    td.addEventListener("click", () => {
      const input = document.createElement("input");
      input.type = "date";
      input.value = o.datum || todayISO();
      input.addEventListener("blur", () => {
        const val = input.value;
        const nieuw = val || o.datum;
        update(ref(db, `${speltak}/opkomsten/${o.id}`), { datum: nieuw });
      });
      td.innerHTML = "";
      td.appendChild(input);
      input.focus();
    });
  }

  tr.appendChild(td);
}

/* Tekstvelden (thema, bijzonderheden) */
function addTextCell(tr, o, field) {
  const td = document.createElement("td");
  td.classList.add("editable");
  td.textContent = o[field] || "";

  if (isAdmin) {
    td.addEventListener("click", () => {
      const val = prompt(`Nieuwe waarde voor ${field}:`, o[field] || "");
      if (val !== null) {
        const updateObj = {};
        updateObj[field] = val;
        update(ref(db, `${speltak}/opkomsten/${o.id}`), updateObj);
      }
    });
  }

  tr.appendChild(td);
}

/* Type (normaal / bijzonder / kamp) */
function addTypeCell(tr, o) {
  const td = document.createElement("td");
  td.classList.add("editable");
  const type = o.typeOpkomst || "normaal";

  const labels = {
    normaal: "Normaal",
    bijzonder: "Bijzonder",
    kamp: "Kamp"
  };

  td.textContent = labels[type] || "Normaal";

  if (isAdmin) {
    td.addEventListener("click", () => {
      const select = document.createElement("select");
      [
        { value: "normaal", label: "Normale opkomst" },
        { value: "bijzonder", label: "Bijzondere opkomst" },
        { value: "kamp", label: "Kamp" }
      ].forEach(opt => {
        const oEl = document.createElement("option");
        oEl.value = opt.value;
        oEl.textContent = opt.label;
        if (opt.value === type) oEl.selected = true;
        select.appendChild(oEl);
      });

      select.addEventListener("change", () => {
        update(ref(db, `${speltak}/opkomsten/${o.id}`), {
          typeOpkomst: select.value
        });
      });

      td.innerHTML = "";
      td.appendChild(select);
      select.focus();
    });
  }

  tr.appendChild(td);
}

/* Tijden */
function addTimeCell(tr, o, field) {
  const td = document.createElement("td");
  td.classList.add("editable");
  td.textContent = o[field] || (field === "starttijd" ? "10:30" : "12:30");

  if (isAdmin) {
    td.addEventListener("click", () => {
      const val = prompt(`Nieuwe tijd voor ${field} (hh:mm):`, td.textContent || "");
      if (val !== null) {
        const updateObj = {};
        updateObj[field] = val;
        update(ref(db, `${speltak}/opkomsten/${o.id}`), updateObj);
      }
    });
  }

  tr.appendChild(td);
}

/* Locatie */
function addLocatieCell(tr, o) {
  const td = document.createElement("td");
  td.classList.add("editable");
  const loc = o.locatie || "";

  td.textContent = loc || "";

  if (isAdmin) {
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
        const oEl = document.createElement("option");
        oEl.value = opt;
        oEl.textContent = opt || "(geen)";
        if (opt === loc) oEl.selected = true;
        select.appendChild(oEl);
      });

      select.addEventListener("change", () => {
        update(ref(db, `${speltak}/opkomsten/${o.id}`), { locatie: select.value });
      });

      td.innerHTML = "";
      td.appendChild(select);
      select.focus();
    });
  }

  tr.appendChild(td);
}

/* Procor (alleen admin) */
function addProcorCell(tr, o) {
  const td = document.createElement("td");
  td.classList.add("editable", "col-procor");
  td.textContent = o.procor || "";

  if (isAdmin) {
    td.addEventListener("click", () => {
      const val = prompt("Wie is Procor/juf voor deze opkomst?", o.procor || "");
      if (val !== null) {
        update(ref(db, `${speltak}/opkomsten/${o.id}`), { procor: val });
      }
    });
  }

  tr.appendChild(td);
}

/* Bert 🧸 */
function addBertCell(tr, o) {
  const td = document.createElement("td");
  td.classList.add("editable", "col-bert");
  td.textContent = o.bert_met || "";

  if (isAdmin) {
    td.addEventListener("click", () => {
      const val = prompt("Met welk jeugdlid gaat Bert mee naar huis?", o.bert_met || "");
      if (val !== null) {
        update(ref(db, `${speltak}/opkomsten/${o.id}`), { bert_met: val });
      }
    });
  }

  tr.appendChild(td);
}

/* Aanwezigheid tellen */
function countAanwezigen(o, visibleJeugd, visibleLeiding) {
  let j = 0;
  let l = 0;

  visibleJeugd.forEach(lid => {
    const s = (o.aanwezigheidJeugd && o.aanwezigheidJeugd[lid.id]) || "onbekend";
    if (s === "aanwezig") j++;
  });

  visibleLeiding.forEach(lid => {
    const s = (o.aanwezigheidLeiding && o.aanwezigheidLeiding[lid.id]) || "onbekend";
    if (s === "aanwezig") l++;
  });

  return [j, l];
}

/* Aanwezigheidscel */
function makePresenceCell(o, groep, lidId, status) {
  const td = document.createElement("td");
  td.classList.add("presence-cell", "presence-col");

  function renderSymbol() {
    td.classList.remove("presence-aanwezig", "presence-afwezig", "presence-reminder");

    let sym = "?";
    if (status === "aanwezig") {
      sym = "✔";
      td.classList.add("presence-aanwezig");
    } else if (status === "afwezig") {
      sym = "✖";
      td.classList.add("presence-afwezig");
    } else {
      // onbekend
      if (isBinnen3Dagen(o.datum)) {
        sym = "!";
        td.classList.add("presence-reminder");
      } else {
        sym = "?";
      }
    }
    td.textContent = sym;
  }

  renderSymbol();

  td.addEventListener("click", () => {
    // cyclus: onbekend -> aanwezig -> afwezig -> onbekend
    if (status === "onbekend") {
      status = "aanwezig";
    } else if (status === "aanwezig") {
      status = "afwezig";
    } else {
      status = "onbekend";
    }

    const path = `${speltak}/opkomsten/${o.id}/${groep === "jeugd" ? "aanwezigheidJeugd" : "aanwezigheidLeiding"}/${lidId}`;
    set(ref(db, path), status);
  });

  return td;
}

/* -----------------------------------------------------
   STRUCTURELE HULP VOOR OPKOMST
----------------------------------------------------- */

function ensurePresenceStructure(o, visibleJeugd, visibleLeiding) {
  if (!o.aanwezigheidJeugd) o.aanwezigheidJeugd = {};
  if (!o.aanwezigheidLeiding) o.aanwezigheidLeiding = {};

  visibleJeugd.forEach(lid => {
    if (!o.aanwezigheidJeugd[lid.id]) {
      o.aanwezigheidJeugd[lid.id] = "onbekend";
    }
  });
  visibleLeiding.forEach(lid => {
    if (!o.aanwezigheidLeiding[lid.id]) {
      o.aanwezigheidLeiding[lid.id] = "onbekend";
    }
  });
}

/* -----------------------------------------------------
   LEDENBEHEER
----------------------------------------------------- */

function renderLedenbeheer() {
  if (!ledenbeheerJeugdList || !ledenbeheerLeidingList) return;

  ledenbeheerJeugdList.innerHTML = "";
  jeugd.forEach((lid, index) => {
    const li = document.createElement("li");
    if (lid.verborgen) li.classList.add("lid-verborgen");

    const span = document.createElement("span");
    span.textContent = lid.naam;

    const controls = document.createElement("div");
    controls.classList.add("ledenbeheer-controls");

    const btnUp = document.createElement("button");
    btnUp.textContent = "↑";
    btnUp.classList.add("ledenbeheer-btn");
    btnUp.addEventListener("click", () => moveLid("jeugd", index, -1));

    const btnDown = document.createElement("button");
    btnDown.textContent = "↓";
    btnDown.classList.add("ledenbeheer-btn");
    btnDown.addEventListener("click", () => moveLid("jeugd", index, 1));

    const btnEdit = document.createElement("button");
    btnEdit.textContent = "✎";
    btnEdit.classList.add("ledenbeheer-btn");
    btnEdit.addEventListener("click", () => renameLid("jeugd", lid));

    const btnHide = document.createElement("button");
    btnHide.textContent = lid.verborgen ? "Toon" : "Verberg";
    btnHide.classList.add("ledenbeheer-btn");
    btnHide.addEventListener("click", () => toggleVerborgen("jeugd", lid));

    const btnDel = document.createElement("button");
    btnDel.textContent = "Verwijder";
    btnDel.classList.add("ledenbeheer-btn");
    btnDel.addEventListener("click", () => deleteLid("jeugd", lid));

    controls.append(btnUp, btnDown, btnEdit, btnHide, btnDel);
    li.append(span, controls);
    ledenbeheerJeugdList.appendChild(li);
  });

  ledenbeheerLeidingList.innerHTML = "";
  leiding.forEach((lid, index) => {
    const li = document.createElement("li");
    if (lid.verborgen) li.classList.add("lid-verborgen");

    const span = document.createElement("span");
    span.textContent = lid.naam;

    const controls = document.createElement("div");
    controls.classList.add("ledenbeheer-controls");

    const btnUp = document.createElement("button");
    btnUp.textContent = "↑";
    btnUp.classList.add("ledenbeheer-btn");
    btnUp.addEventListener("click", () => moveLid("leiding", index, -1));

    const btnDown = document.createElement("button");
    btnDown.textContent = "↓";
    btnDown.classList.add("ledenbeheer-btn");
    btnDown.addEventListener("click", () => moveLid("leiding", index, 1));

    const btnEdit = document.createElement("button");
    btnEdit.textContent = "✎";
    btnEdit.classList.add("ledenbeheer-btn");
    btnEdit.addEventListener("click", () => renameLid("leiding", lid));

    const btnHide = document.createElement("button");
    btnHide.textContent = lid.verborgen ? "Toon" : "Verberg";
    btnHide.classList.add("ledenbeheer-btn");
    btnHide.addEventListener("click", () => toggleVerborgen("leiding", lid));

    const btnDel = document.createElement("button");
    btnDel.textContent = "Verwijder";
    btnDel.classList.add("ledenbeheer-btn");
    btnDel.addEventListener("click", () => deleteLid("leiding", lid));

    controls.append(btnUp, btnDown, btnEdit, btnHide, btnDel);
    li.append(span, controls);
    ledenbeheerLeidingList.appendChild(li);
  });
}

function moveLid(type, index, delta) {
  const arr = type === "jeugd" ? [...jeugd] : [...leiding];
  const nieuwIndex = index + delta;
  if (nieuwIndex < 0 || nieuwIndex >= arr.length) return;

  const tmp = arr[index];
  arr[index] = arr[nieuwIndex];
  arr[nieuwIndex] = tmp;

  arr.forEach((lid, i) => {
    const path = `${speltak}/leden/${type}/${lid.id}`;
    update(ref(db, path), { volgorde: i });
  });
}

function renameLid(type, lid) {
  const nieuw = prompt("Nieuwe naam:", lid.naam);
  if (!nieuw) return;
  const path = `${speltak}/leden/${type}/${lid.id}`;
  update(ref(db, path), { naam: nieuw });
}

function toggleVerborgen(type, lid) {
  const path = `${speltak}/leden/${type}/${lid.id}`;
  update(ref(db, path), { verborgen: !lid.verborgen });
}

function deleteLid(type, lid) {
  if (!confirm(`Lid "${lid.naam}" echt verwijderen?`)) return;
  const path = `${speltak}/leden/${type}/${lid.id}`;
  remove(ref(db, path));
}

/* -----------------------------------------------------
   OPKOMST TOEVOEGEN
----------------------------------------------------- */

function addOpkomst() {
  const today = todayISO();
  const idRef = push(ref(db, `${speltak}/opkomsten`));
  const id = idRef.key;

  const nieuw = {
    id,
    datum: today,
    starttijd: "10:30",
    eindtijd: "12:30",
    thema: "",
    bijzonderheden: "",
    typeOpkomst: "normaal",
    locatie: "",
    procor: "",
    bert_met: "",
    aanwezigheidJeugd: {},
    aanwezigheidLeiding: {}
  };

  set(idRef, nieuw);
}

/* -----------------------------------------------------
   LEDEN TOEVOEGEN
----------------------------------------------------- */

function addLidPopup() {
  const naam = prompt("Naam van het lid:");
  if (!naam) return;

  const type = prompt("Typ 'J' voor jeugdlid of 'L' voor leiding:", "J");
  let groep = null;
  if (!type) return;

  if (type.toLowerCase() === "j") groep = "jeugd";
  else if (type.toLowerCase() === "l") groep = "leiding";
  else {
    alert("Ongeldige keuze. Gebruik J of L.");
    return;
  }

  const refLeden = ref(db, `${speltak}/leden/${groep}`);
  const nieuwRef = push(refLeden);
  const id = nieuwRef.key;

  // volgorde = huidige lengte
  const volgorde = groep === "jeugd" ? jeugd.length : leiding.length;

  set(nieuwRef, {
    naam,
    verborgen: false,
    volgorde
  });
}

/* -----------------------------------------------------
   MELDINGEN INSTELLINGEN OPSLAAN
----------------------------------------------------- */

function saveMeldingen() {
  const leidingEnabled = !!meldLeidingEnabledInput.checked;
  const leidingThreshold = parseInt(meldLeidingThresholdInput.value, 10) || 3;
  const onbekendEnabled = !!meldOnbekendEnabledInput.checked;
  const onbekendDays = parseInt(meldOnbekendDaysInput.value, 10) || 7;

  const data = {
    leidingEnabled,
    leidingThreshold,
    onbekendEnabled,
    onbekendDays
  };

  set(ref(db, `${speltak}/meldingen`), data)
    .then(() => {
      alert("Meldingen opgeslagen.");
    })
    .catch((err) => {
      console.error(err);
      alert("Opslaan van meldingen is mislukt.");
    });
}

/* -----------------------------------------------------
   EDIT MODE / UI EVENTS
----------------------------------------------------- */

function setFilter(mode) {
  filterMode = mode;
  filterAll.classList.remove("active");
  filterFuture.classList.remove("active");
  filterPast.classList.remove("active");

  if (mode === "all") filterAll.classList.add("active");
  else if (mode === "future") filterFuture.classList.add("active");
  else if (mode === "past") filterPast.classList.add("active");

  renderTable();
}

function toggleAdmin() {
  if (!isAdmin) {
    const pw = prompt("Wachtwoord voor bewerkmodus:");
    if (pw !== DEFAULT_ADMIN_PASSWORD) {
      alert("Onjuist wachtwoord.");
      return;
    }
    isAdmin = true;
  } else {
    isAdmin = false;
  }

  // knoppen
  if (isAdmin) {
    addMemberButton.classList.remove("hidden");
    ledenbeheerButton.classList.remove("hidden");
    saveInfoButton.classList.remove("hidden");
    infoTekstEdit.classList.remove("hidden");

    mailboxButton.classList.remove("hidden");
    handleidingButton.classList.remove("hidden");
    instellingenButton.classList.remove("hidden");
  } else {
    addMemberButton.classList.add("hidden");
    ledenbeheerButton.classList.add("hidden");
    saveInfoButton.classList.add("hidden");
    infoTekstEdit.classList.add("hidden");

    mailboxButton.classList.add("hidden");
    handleidingButton.classList.add("hidden");
    instellingenButton.classList.add("hidden");

    ledenbeheerSection.classList.add("hidden");
    meldingenSection.classList.add("hidden");
  }

  // info-blok
  if (isAdmin) {
    infoTekstEdit.value = infoTekst;
    infoTekstP.classList.add("hidden");
  } else {
    infoTekstP.classList.remove("hidden");
  }

  renderTable();
  renderLedenbeheer();
}

function toggleLedenbeheer() {
  if (!isAdmin) return;
  const hidden = ledenbeheerSection.classList.contains("hidden");
  if (hidden) ledenbeheerSection.classList.remove("hidden");
  else ledenbeheerSection.classList.add("hidden");
}

function toggleMeldingen() {
  if (!isAdmin) return;
  const hidden = meldingenSection.classList.contains("hidden");
  if (hidden) meldingenSection.classList.remove("hidden");
  else meldingenSection.classList.add("hidden");
}

/* -----------------------------------------------------
   INFO OPSLAAN
----------------------------------------------------- */

function saveInfo() {
  const text = infoTekstEdit.value || "";
  set(ref(db, `${speltak}/infoTekst`), text);
}

/* -----------------------------------------------------
   INIT
----------------------------------------------------- */

document.addEventListener("DOMContentLoaded", () => {
  loadData();

  if (editModeButton) {
    editModeButton.addEventListener("click", toggleAdmin);
  }
  if (addMemberButton) {
    addMemberButton.addEventListener("click", addLidPopup);
  }
  if (ledenbeheerButton) {
    ledenbeheerButton.addEventListener("click", toggleLedenbeheer);
  }
  if (instellingenButton) {
    instellingenButton.addEventListener("click", toggleMeldingen);
  }

  if (filterAll)    filterAll.addEventListener("click", () => setFilter("all"));
  if (filterFuture) filterFuture.addEventListener("click", () => setFilter("future"));
  if (filterPast)   filterPast.addEventListener("click", () => setFilter("past"));

  if (printButton) {
    printButton.addEventListener("click", () => window.print());
  }

  if (saveInfoButton) {
    saveInfoButton.addEventListener("click", saveInfo);
  }

  if (addOpkomstRow) {
    addOpkomstRow.addEventListener("click", () => {
      if (!isAdmin) return;
      addOpkomst();
    });
  }

  if (saveMeldingenButton) {
    saveMeldingenButton.addEventListener("click", saveMeldingen);
  }
});
