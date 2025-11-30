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
  push,
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyAZN4QdTuOpk8lEKsyPuhynqZ9-GJLDE0s",
  authDomain: "jaarplanning-ovn.firebaseapp.com",
  databaseURL: "https://jaarplanning-ovn-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "jaarplanning-ovn",
  storageBucket: "jaarplanning-ovn.firebasestorage.app",
  messagingSenderId: "526104562356",
  appId: "1:526104562356:web:ea211e722202d6383f65e1",
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

/* -----------------------------------------------------
   ADMIN WACHTWOORDEN (multi-speltak klaar)
----------------------------------------------------- */
const ADMIN_PASSWORDS = {
  bevers: "bevers2025",
  // later kun je hier bijv. welpen: "welpen2025" toevoegen
};

const DEFAULT_ADMIN_PASSWORD = "bevers2025";

/* -----------------------------------------------------
   VARIABELEN
----------------------------------------------------- */
let speltak = "";
let isAdmin = false;
let filterMode = "all"; // "all" | "future" | "past"

let jeugd = [];   // [{id, naam, volgorde}]
let leiding = []; // [{id, naam, volgorde}]
let leden = [];   // gecombineerde lijst
let opkomsten = [];

const todayISO = new Date().toISOString().split("T")[0];

/* -----------------------------------------------------
   START
----------------------------------------------------- */
document.addEventListener("DOMContentLoaded", () => {
  speltak = document.body.dataset.speltak;

  const editBtn = document.getElementById("editModeButton");
  const addOpkomstRow = document.getElementById("addOpkomstRow");
  const addMemberBtn = document.getElementById("addMemberButton");
  const filterAllBtn = document.getElementById("filterAll");
  const filterFutureBtn = document.getElementById("filterFuture");
  const filterPastBtn = document.getElementById("filterPast");
  const printBtn = document.getElementById("printButton");

  if (editBtn) editBtn.onclick = toggleAdmin;
  if (addOpkomstRow) addOpkomstRow.onclick = addNewOpkomst;
  if (addMemberBtn) addMemberBtn.onclick = addNewMember;

  if (filterAllBtn) {
    filterAllBtn.onclick = () => {
      filterMode = "all";
      updateFilterButtons();
      renderTable();
    };
  }
  if (filterFutureBtn) {
    filterFutureBtn.onclick = () => {
      filterMode = "future";
      updateFilterButtons();
      renderTable();
    };
  }
  if (filterPastBtn) {
    filterPastBtn.onclick = () => {
      filterMode = "past";
      updateFilterButtons();
      renderTable();
    };
  }

  if (printBtn) {
    printBtn.onclick = () => {
      window.print();
    };
  }

  updateFilterButtons();
  loadData();
});

/* -----------------------------------------------------
   ADMIN MODUS
----------------------------------------------------- */
function toggleAdmin() {
  if (!isAdmin) {
    const pw = prompt("Wachtwoord:");
    const requiredPw = ADMIN_PASSWORDS[speltak] || DEFAULT_ADMIN_PASSWORD;
    if (pw !== requiredPw) return;
    isAdmin = true;
  } else {
    isAdmin = false;
  }

  const addOpkomstRow = document.getElementById("addOpkomstRow");
  const addMemberBtn = document.getElementById("addMemberButton");
  const printBtn = document.getElementById("printButton");

  if (addOpkomstRow) {
    addOpkomstRow.classList.toggle("hidden", !isAdmin);
  }
  if (addMemberBtn) {
    addMemberBtn.classList.toggle("hidden", !isAdmin);
  }
  if (printBtn) {
    // Printknop alleen zichtbaar als we niet in bewerkmodus zitten
    printBtn.classList.toggle("hidden", isAdmin);
  }

  renderTable();
}

function updateFilterButtons() {
  const filterAllBtn = document.getElementById("filterAll");
  const filterFutureBtn = document.getElementById("filterFuture");
  const filterPastBtn = document.getElementById("filterPast");

  if (filterAllBtn) {
    filterAllBtn.classList.toggle("active", filterMode === "all");
  }
  if (filterFutureBtn) {
    filterFutureBtn.classList.toggle("active", filterMode === "future");
  }
  if (filterPastBtn) {
    filterPastBtn.classList.toggle("active", filterMode === "past");
  }
}

/* -----------------------------------------------------
   DATA LADEN
   structuur:
   - /<speltak>/jeugdleden
   - /<speltak>/leiding
   - /<speltak>/opkomsten
----------------------------------------------------- */
async function loadData() {
  try {
    const snap = await get(child(ref(db), speltak));
    const data = snap.exists() ? snap.val() : {};

    const jeugdData = data.jeugdleden || {};
    const leidingData = data.leiding || {};

    jeugd = Object.entries(jeugdData)
      .map(([id, v]) => ({
        id,
        naam: v.naam,
        volgorde: v.volgorde ?? 0,
      }))
      .sort((a, b) => a.volgorde - b.volgorde);

    leiding = Object.entries(leidingData)
      .map(([id, v]) => ({
        id,
        naam: v.naam,
        volgorde: v.volgorde ?? 0,
      }))
      .sort((a, b) => a.volgorde - b.volgorde);

    leden = [
      ...jeugd.map(j => ({ ...j, type: "jeugd" })),
      ...leiding.map(l => ({ ...l, type: "leiding" })),
    ];

    opkomsten = Object.entries(data.opkomsten || {}).map(([id, v]) => ({
      id,
      ...v,
    }));

    // toekomst eerst, dan verleden
    const toekomst = opkomsten.filter(o => o.datum >= todayISO);
    const verleden = opkomsten.filter(o => o.datum < todayISO);
    toekomst.sort((a, b) => a.datum.localeCompare(b.datum));
    verleden.sort((a, b) => a.datum.localeCompare(b.datum));
    opkomsten = [...toekomst, ...verleden];

    renderTable();
  } catch (err) {
    console.error("Fout bij laden van data:", err);
    alert("Het laden van de planning is mislukt. Probeer de pagina te vernieuwen.");
  }
}

/* -----------------------------------------------------
   TABEL RENDEREN
----------------------------------------------------- */
function renderTable() {
  const headTop = document.getElementById("headerRowTop");
  const headBot = document.getElementById("headerRowBottom");
  const body = document.getElementById("tableBody");

  if (!headTop || !headBot || !body) return;

  headTop.innerHTML = "";
  headBot.innerHTML = "";
  body.innerHTML = "";

  /* --- HEADER RIJ 1 --- */
  addTH(headTop, "🗑", 1, 2);
  addTH(headTop, "Datum", 1, 2);
  addTH(headTop, "Thema", 1, 2);
  addTH(headTop, "Bijzonderheden", 1, 2);
  addTH(headTop, "Type", 1, 2);
  addTH(headTop, "Start", 1, 2);
  addTH(headTop, "Eind", 1, 2);
  addTH(headTop, "Procor", 1, 2);
  addTH(headTop, "Bert 🧸", 1, 2);
  addTH(headTop, "Aanw. Leden", 1, 2);   // punt 15
  addTH(headTop, "Aanw. Leiding", 1, 2); // punt 15

  jeugd.forEach(j => {
    const th = document.createElement("th");
    th.textContent = j.naam;
    th.classList.add("col-jeugd", "name-vertical");
    headBot.appendChild(th);
  });

  leiding.forEach(l => {
    const th = document.createElement("th");
    th.textContent = l.naam;
    th.classList.add("col-leiding", "name-vertical");
    headBot.appendChild(th);
  });

  /* --- BODY --- */
  let firstFuture = true;

  let lijst = opkomsten;
  if (filterMode === "future") {
    lijst = opkomsten.filter(o => o.datum >= todayISO);
  } else if (filterMode === "past") {
    lijst = opkomsten.filter(o => o.datum < todayISO);
  }

  lijst.forEach(o => {
    ensurePresence(o);

    const tr = document.createElement("tr");

    // datumkleuren
    if (o.datum < todayISO) {
      tr.classList.add("row-grey");
    } else if (firstFuture && o.datum >= todayISO) {
      tr.classList.add("row-next");
      firstFuture = false;
    }

    // type opkomst
    if (o.typeOpkomst === "bijzonder") tr.classList.add("row-bijzonder");
    if (o.typeOpkomst === "kamp") tr.classList.add("row-kamp");

    addDeleteCell(tr, o);

    addTextCell(tr, o, "datum", "date");
    addTextCell(tr, o, "thema", "text");
    addTextCell(tr, o, "bijzonderheden", "text");
    addTypeCell(tr, o); // NIEUWE kolom voor type opkomst
    addTextCell(tr, o, "starttijd", "time");
    addTextCell(tr, o, "eindtijd", "time");

    addProcorCell(tr, o);
    addBertCell(tr, o);

    // aantallen jeugd / leiding
    const jeugdCount = jeugd.reduce(
      (sum, j) => sum + (o.aanwezigheid[j.id] === "aanwezig" ? 1 : 0),
      0
    );
    const leidingCount = leiding.reduce(
      (sum, l) =>
        sum + (o.aanwezigheid["leiding-" + l.id] === "aanwezig" ? 1 : 0),
      0
    );

    const tdJeugdCnt = document.createElement("td");
    tdJeugdCnt.textContent = jeugdCount;
    tdJeugdCnt.classList.add("col-jeugd");
    tr.appendChild(tdJeugdCnt);

    const tdLeidingCnt = document.createElement("td");
    tdLeidingCnt.textContent = leidingCount;
    tdLeidingCnt.classList.add("col-leiding");
    tr.appendChild(tdLeidingCnt);

    // aanwezigheidsvelden
    jeugd.forEach(j => tr.appendChild(makePresenceCell(o, j.id, "jeugd")));
    leiding.forEach(l => tr.appendChild(makePresenceCell(o, "leiding-" + l.id, "leiding")));

    body.appendChild(tr);
  });
}

/* -----------------------------------------------------
   HEADER HELPER
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
      if (!confirm("Weet je zeker dat je deze opkomst wilt verwijderen?")) return;
      try {
        await remove(ref(db, `${speltak}/opkomsten/${o.id}`));
        loadData();
      } catch (err) {
        console.error("Kon opkomst niet verwijderen:", err);
        alert("Verwijderen mislukt. Probeer het opnieuw.");
      }
    };
  }

  tr.appendChild(td);
}

/* -----------------------------------------------------
   INLINE TEKSTCELLEN
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
  const oldVal = td.textContent;
  const input = document.createElement("input");
  input.type = type;
  input.value = oldVal;

  td.innerHTML = "";
  td.appendChild(input);
  input.focus();

  input.onblur = async () => {
    const val = input.value;
    try {
      await update(ref(db, `${speltak}/opkomsten/${o.id}`), {
        [field]: val,
      });
      loadData();
    } catch (err) {
      console.error("Kon veld niet opslaan:", err);
      alert("Opslaan mislukt. Probeer het opnieuw.");
    }
  };

  input.onkeydown = e => {
    if (e.key === "Enter") input.blur();
  };
}

/* -----------------------------------------------------
   TYPE OPKOMST (normaal/bijzonder/kamp)
----------------------------------------------------- */
function addTypeCell(tr, o) {
  const td = document.createElement("td");

  const type = o.typeOpkomst || "normaal";
  let label = "Normaal";
  if (type === "bijzonder") label = "Bijzonder";
  if (type === "kamp") label = "Kamp";

  td.textContent = label;

  if (isAdmin) {
    td.classList.add("editable");
    td.onclick = async () => {
      const next =
        type === "normaal"
          ? "bijzonder"
          : type === "bijzonder"
          ? "kamp"
          : "normaal";

      try {
        await update(ref(db, `${speltak}/opkomsten/${o.id}`), {
          typeOpkomst: next,
        });
        loadData();
      } catch (err) {
        console.error("Kon type opkomst niet opslaan:", err);
        alert("Opslaan mislukt. Probeer het opnieuw.");
      }
    };
  }

  tr.appendChild(td);
}

/* -----------------------------------------------------
   PROCOR / BERT
----------------------------------------------------- */
function addProcorCell(tr, o) {
  const td = document.createElement("td");
  td.textContent = getNaam(o.procor);

  if (isAdmin) {
    td.classList.add("editable");
    td.onclick = () => editProcor(td, o);
  }

  tr.appendChild(td);
}

function editProcor(td, o) {
  const sel = document.createElement("select");
  sel.innerHTML =
    `<option value=""></option>` +
    leiding.map(l => `<option value="${l.id}">${l.naam}</option>`).join("");

  sel.value = o.procor || "";
  td.innerHTML = "";
  td.appendChild(sel);
  sel.focus();

  sel.onblur = async () => {
    try {
      await update(ref(db, `${speltak}/opkomsten/${o.id}`), {
        procor: sel.value,
      });
      loadData();
    } catch (err) {
      console.error("Kon Procor niet opslaan:", err);
      alert("Opslaan mislukt. Probeer het opnieuw.");
    }
  };
}

function addBertCell(tr, o) {
  const td = document.createElement("td");
  td.textContent = getNaam(o.bert_met);

  if (isAdmin) {
    td.classList.add("editable");
    td.onclick = () => editBert(td, o);
  }

  tr.appendChild(td);
}

function editBert(td, o) {
  const sel = document.createElement("select");
  sel.innerHTML =
    `<option value=""></option>` +
    jeugd.map(j => `<option value="${j.id}">${j.naam}</option>`).join("");

  sel.value = o.bert_met || "";
  td.innerHTML = "";
  td.appendChild(sel);
  sel.focus();

  sel.onblur = async () => {
    try {
      await update(ref(db, `${speltak}/opkomsten/${o.id}`), {
        bert_met: sel.value,
      });
      loadData();
    } catch (err) {
      console.error("Kon Bert niet opslaan:", err);
      alert("Opslaan mislukt. Probeer het opnieuw.");
    }
  };
}

/* -----------------------------------------------------
   AANWEZIGHEID
----------------------------------------------------- */
function ensurePresence(o) {
  if (!o.aanwezigheid) o.aanwezigheid = {};
  let changed = false;

  jeugd.forEach(j => {
    if (!o.aanwezigheid[j.id]) {
      o.aanwezigheid[j.id] = "onbekend";
      changed = true;
    }
  });

  leiding.forEach(l => {
    const key = "leiding-" + l.id;
    if (!o.aanwezigheid[key]) {
      o.aanwezigheid[key] = "onbekend";
      changed = true;
    }
  });

  if (changed) {
    try {
      update(ref(db, `${speltak}/opkomsten/${o.id}`), {
        aanwezigheid: o.aanwezigheid,
      });
    } catch (err) {
      console.error("Kon aanwezigheid niet bijwerken:", err);
    }
  }
}

function makePresenceCell(o, key, groep) {
  const state = o.aanwezigheid[key] || "onbekend";
  const td = document.createElement("td");
  td.classList.add("presence-cell");
  td.classList.add(groep === "leiding" ? "col-leiding" : "col-jeugd");

  td.classList.remove("presence-aanwezig", "presence-afwezig");
  if (state === "aanwezig") td.classList.add("presence-aanwezig");
  if (state === "afwezig") td.classList.add("presence-afwezig");

  td.textContent =
    state === "aanwezig" ? "✔" :
    state === "afwezig" ? "✖" : "?";

  // altijd klikbaar (ouders kunnen wijzigen)
  td.onclick = async () => {
    const current = o.aanwezigheid[key] || "onbekend";
    const next =
      current === "onbekend"
        ? "aanwezig"
        : current === "aanwezig"
        ? "afwezig"
        : "onbekend";

    try {
      await update(ref(db, `${speltak}/opkomsten/${o.id}/aanwezigheid`), {
        [key]: next,
      });
      loadData();
    } catch (err) {
      console.error("Kon aanwezigheid niet opslaan:", err);
    }
  };

  return td;
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
    aanwezigheid: {},
  };

  jeugd.forEach(j => (nieuw.aanwezigheid[j.id] = "onbekend"));
  leiding.forEach(l => (nieuw.aanwezigheid["leiding-" + l.id] = "onbekend"));

  try {
    await set(ref(db, `${speltak}/opkomsten/${id}`), nieuw);
    loadData();
  } catch (err) {
    console.error("Kon opkomst niet opslaan:", err);
    alert("Opslaan mislukt. Probeer het opnieuw.");
  }
}

/* -----------------------------------------------------
   LIDTYPE KIEZEN (overlay)
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
        <button type="button" id="cancelTypeBtn" style="margin-right:8px;">Annuleren</button>
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

  const branch = type === "leiding" ? "leiding" : "jeugdleden";
  const listRef = ref(db, `${speltak}/${branch}`);
  const id = push(listRef).key;

  const volgorde = branch === "leiding" ? leiding.length + 1 : jeugd.length + 1;

  try {
    await set(ref(db, `${speltak}/${branch}/${id}`), {
      naam,
      volgorde,
    });

    // aanwezigheid bij alle opkomsten aanvullen
    for (const o of opkomsten) {
      const key = type === "leiding" ? `leiding-${id}` : id;
      const aanwRef = ref(db, `${speltak}/opkomsten/${o.id}/aanwezigheid`);
      await update(aanwRef, { [key]: "onbekend" });
    }

    loadData();
  } catch (err) {
    console.error("Kon nieuw lid niet opslaan:", err);
    alert("Opslaan mislukt. Probeer het opnieuw.");
  }
}

/* -----------------------------------------------------
   HELPER: NAAM OPZOEKEN
----------------------------------------------------- */
function getNaam(id) {
  if (!id) return "";
  const l = leden.find(x => x.id === id);
  return l ? l.naam : "";
}

