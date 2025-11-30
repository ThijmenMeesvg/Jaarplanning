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
   CONST / VARIABELEN
----------------------------------------------------- */
const ADMIN_PASSWORDS = { bevers: "bevers2025" };
const DEFAULT_ADMIN_PASSWORD = "bevers2025";

let speltak = "";
let isAdmin = false;
let filterMode = "all"; // all | future | past

let jeugd = [];
let leiding = [];
let leden = [];
let opkomsten = [];

let infotekst = ""; // Infoblok
const todayISO = new Date().toISOString().split("T")[0];

/* -----------------------------------------------------
   HELPER FUNCTIES
----------------------------------------------------- */

function toISO(dmy) {
  const [dd, mm, yyyy] = dmy.split("-");
  return `${yyyy}-${mm}-${dd}`;
}

function toDMY(iso) {
  const [yyyy, mm, dd] = iso.split("-");
  return `${dd}-${mm}-${yyyy}`;
}

function isBinnen3Dagen(datumISO) {
  const vandaag = new Date();
  const dat = new Date(datumISO);
  const diff = (dat - vandaag) / (1000 * 60 * 60 * 24);
  return diff <= 3 && diff >= 0;
}

function getNaam(id) {
  if (!id) return "";
  const l = leden.find(x => x.id === id);
  return l ? l.naam : "";
}

/* -----------------------------------------------------
   START
----------------------------------------------------- */
document.addEventListener("DOMContentLoaded", () => {
  speltak = document.body.dataset.speltak;

  const editBtn = document.getElementById("editModeButton");
  const addOpkomstRow = document.getElementById("addOpkomstRow");
  const addMemberBtn = document.getElementById("addMemberButton");
  const ledenbeheerBtn = document.getElementById("ledenbeheerButton");
  const filterAllBtn = document.getElementById("filterAll");
  const filterFutureBtn = document.getElementById("filterFuture");
  const filterPastBtn = document.getElementById("filterPast");
  const printBtn = document.getElementById("printButton");

  if (editBtn) editBtn.onclick = toggleAdmin;
  if (addOpkomstRow) addOpkomstRow.onclick = addNewOpkomst;
  if (addMemberBtn) addMemberBtn.onclick = addNewMember;
  if (ledenbeheerBtn) ledenbeheerBtn.onclick = toggleLedenbeheer;

  if (filterAllBtn) filterAllBtn.onclick = () => { filterMode="all"; updateFilterButtons(); renderTable(); };
  if (filterFutureBtn) filterFutureBtn.onclick = () => { filterMode="future"; updateFilterButtons(); renderTable(); };
  if (filterPastBtn) filterPastBtn.onclick = () => { filterMode="past"; updateFilterButtons(); renderTable(); };

  if (printBtn) printBtn.onclick = () => window.print();

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

  document.getElementById("addOpkomstRow").classList.toggle("hidden", !isAdmin);
  document.getElementById("addMemberButton").classList.toggle("hidden", !isAdmin);
  document.getElementById("ledenbeheerButton").classList.toggle("hidden", !isAdmin);

  // Info-edit modus
  document.getElementById("infotekst").classList.toggle("hidden", isAdmin);
  document.getElementById("infotekst_edit").classList.toggle("hidden", !isAdmin);
  document.getElementById("saveInfoButton").classList.toggle("hidden", !isAdmin);

  renderTable();
  renderLedenbeheer();
}

function updateFilterButtons() {
  document.getElementById("filterAll").classList.toggle("active", filterMode==="all");
  document.getElementById("filterFuture").classList.toggle("active", filterMode==="future");
  document.getElementById("filterPast").classList.toggle("active", filterMode==="past");
}

/* -----------------------------------------------------
   DATA LADEN
----------------------------------------------------- */
async function loadData() {
  const snap = await get(child(ref(db), speltak));
  const data = snap.exists() ? snap.val() : {};

  // Infotekst
  infotekst = data.info || "";
  document.getElementById("infotekst").textContent = infotekst;
  document.getElementById("infotekst_edit").value = infotekst;
  document.getElementById("saveInfoButton").onclick = saveInfo;

  // Leden
  jeugd = Object.entries(data.jeugdleden || {}).map(([id, v]) => ({
    id,
    naam: v.naam,
    volgorde: v.volgorde || 0,
    hidden: v.hidden || false
  })).sort((a,b)=>a.volgorde-b.volgorde);

  leiding = Object.entries(data.leiding || {}).map(([id, v])=>({
    id,
    naam: v.naam,
    volgorde: v.volgorde||0,
    hidden: v.hidden || false
  })).sort((a,b)=>a.volgorde-b.volgorde);

  leden = [...jeugd.map(j=>({...j,type:"jeugd"})), ...leiding.map(l=>({...l,type:"leiding"}))];

  // Opkomsten
  opkomsten = Object.entries(data.opkomsten || {}).map(([id,v])=>({ id,...v }));

  // Sorteren
  const toekomst = opkomsten.filter(o=>o.datum>=todayISO).sort((a,b)=>a.datum.localeCompare(b.datum));
  const verleden = opkomsten.filter(o=>o.datum<todayISO).sort((a,b)=>a.datum.localeCompare(b.datum));
  opkomsten = [...toekomst,...verleden];

  renderTable();
  renderLedenbeheer();
}

/* -----------------------------------------------------
   SAVE INFO
----------------------------------------------------- */
async function saveInfo() {
  const txt = document.getElementById("infotekst_edit").value;
  await update(ref(db, speltak), { info: txt });
  normalizeOrder(type);
  infotekst = txt;
  document.getElementById("infotekst").textContent = txt;
}
async function normalizeOrder(type) {
    const lijst = type === "jeugd" ? jeugd : leiding;
    lijst
        .sort((a,b)=>a.volgorde-b.volgorde)
        .forEach((l,i)=> {
            update(ref(db, `${speltak}/${type==="jeugd"?"jeugdleden":"leiding"}/${l.id}`), {
                volgorde: i+1
            });
        });
}

/* -----------------------------------------------------
   RENDER TABEL
----------------------------------------------------- */
function renderTable() {
  const headTop = document.getElementById("headerRowTop");
  const headBot = document.getElementById("headerRowBottom");
  const body = document.getElementById("tableBody");

  headTop.innerHTML="";
  headBot.innerHTML="";
  body.innerHTML="";

  /* --- HEADER 1 --- */
  addTH(headTop, "🗑",1,2);
  addTH(headTop, "Datum",1,2);
  addTH(headTop, "Thema",1,2);
  addTH(headTop, "Bijzonderheden",1,2);
  addTH(headTop, "Type",1,2);
  addTH(headTop, "Start",1,2);
  addTH(headTop, "Eind",1,2);
  addTH(headTop, "Locatie",1,2);

  if (isAdmin) addTH(headTop, "Procor",1,2);

  addTH(headTop, "Bert 🧸",1,2);
  addTH(headTop, "Aanw. Leden",1,2, "aanw-column");
  addTH(headTop, "Aanw. Leiding",1,2, "aanw-column");

  /* HEADER2 Namen */
  jeugd.forEach((j,idx)=>{
    if (!j.hidden){
      const th=document.createElement("th");
      th.textContent=j.naam;
      th.classList.add("col-jeugd","name-vertical");
      headBot.appendChild(th);
    }
  });

      const zichtbareLeiding = leiding.filter(l => !l.hidden);
      
      if (zichtbareLeiding.length > 0) {
          const first = zichtbareLeiding[0];
      
          const th = document.createElement("th");
          th.textContent = first.naam;
          th.classList.add("col-leiding", "name-vertical", "col-split");
          headBot.appendChild(th);
      
          zichtbareLeiding.slice(1).forEach(l => {
              const th2 = document.createElement("th");
              th2.textContent = l.naam;
              th2.classList.add("col-leiding", "name-vertical");
              headBot.appendChild(th2);
          });
      }
      }
    });
  }

  let lijst = [...opkomsten];
  if (filterMode==="future") lijst=lijst.filter(o=>o.datum>=todayISO);
  if (filterMode==="past") lijst=lijst.filter(o=>o.datum<todayISO);

  let firstFuture=true;

  lijst.forEach(o=>{
    ensurePresence(o);

    const tr=document.createElement("tr");
    if (o.datum<todayISO) tr.classList.add("row-grey");
    else if (firstFuture) { tr.classList.add("row-next"); firstFuture=false; }

    if (o.typeOpkomst==="bijzonder") tr.classList.add("row-bijzonder");
    if (o.typeOpkomst==="kamp") tr.classList.add("row-kamp");

    addDeleteCell(tr,o);

    addDateCell(tr,o);
    addTextCell(tr,o,"thema","text");
    addTextCell(tr,o,"bijzonderheden","text");
    addTypeCell(tr,o);
    addTextCell(tr,o,"starttijd","time");
    addTextCell(tr,o,"eindtijd","time");
    addLocatieCell(tr,o);

    if (isAdmin) addProcorCell(tr,o);

    addBertCell(tr,o);

    // Aantallen
    const jeugdCount=jeugd.filter(j=>!j.hidden)
      .reduce((s,j)=>s+(o.aanwezigheid[j.id]==="aanwezig"?1:0),0);
    const leidingCount=leiding.filter(l=>!l.hidden)
      .reduce((s,l)=>s+(o.aanwezigheid["leiding-"+l.id]==="aanwezig"?1:0),0);

    addStaticCell(tr, jeugdCount, "col-jeugd");
    addStaticCell(tr, leidingCount, "col-leiding");

    // Aanwezigheidscellen
    jeugd.forEach(j=>{
      if (!j.hidden){
        tr.appendChild(makePresenceCell(o,j.id,"jeugd"));
        td.classList.add("presence-col");
          }
    });

    leiding.forEach((l,idx)=>{
      if (!l.hidden){
        const key="leiding-"+l.id;
        const td=makePresenceCell(o,key,"leiding");
        if (idx===0) td.classList.add("col-split");
        tr.appendChild(td);
        if (display !== "!" && td.classList.contains("presence-reminder")) {
        td.classList.remove("presence-reminder");
}

      }
    });

    body.appendChild(tr);
  });
}

/* -----------------------------------------------------
   CEL BUILDERS
----------------------------------------------------- */

function addTH(row,text,col=1,rowsp=1,extra=null){
  const th=document.createElement("th");
  th.colSpan=col; th.rowSpan=rowsp; th.textContent=text;
  if (extra) th.classList.add(extra);
  row.appendChild(th);
}

function addStaticCell(tr,text,className){
  const td=document.createElement("td");
  td.textContent=text;
  td.classList.add(className);
  tr.appendChild(td);
}

function addDeleteCell(tr,o){
  const td=document.createElement("td");
  td.textContent=isAdmin?"🗑":"";
  td.className="delete-btn";
  if (isAdmin){
    td.onclick=async()=>{
      if (!confirm("Opkomst verwijderen?")) return;
      await remove(ref(db,`${speltak}/opkomsten/${o.id}`));
      loadData();
    };
  }
  tr.appendChild(td);
}

function addDateCell(tr,o){
  const td=document.createElement("td");
  td.textContent = toDMY(o.datum);

  if (isAdmin){
    td.classList.add("editable");
    td.onclick=()=>{
      const input=document.createElement("input");
      input.type="date";
      input.value=o.datum;
      td.innerHTML="";
      td.appendChild(input);
      input.focus();

      input.onblur=async()=>{
        const iso=input.value;
        await update(ref(db,`${speltak}/opkomsten/${o.id}`),{ datum: iso });

        await loadData(); // auto sort

      };
    };
  }
  tr.appendChild(td);
}

function addTextCell(tr,o,field,type){
  const td=document.createElement("td");
  td.textContent=o[field]||"";

  if (isAdmin){
    td.classList.add("editable");
    td.onclick=()=>{
      const input=document.createElement("input");
      input.type=type;
      input.value=o[field]||"";
      td.innerHTML="";
      td.appendChild(input);
      input.focus();

      input.onblur=async()=>{
        await update(ref(db,`${speltak}/opkomsten/${o.id}`),{ [field]: input.value });
        loadData();
      };
    };
  }

  tr.appendChild(td);
}

function addTypeCell(tr,o){
  const td=document.createElement("td");
  const t=o.typeOpkomst||"normaal";
  td.textContent = t==="normaal"?"Normaal":t==="bijzonder"?"Bijzonder":"Kamp";

  if (isAdmin){
    td.classList.add("editable");
    td.onclick=async()=>{
      const next = t==="normaal"?"bijzonder":t==="bijzonder"?"kamp":"normaal";
      await update(ref(db,`${speltak}/opkomsten/${o.id}`),{ typeOpkomst: next });
      loadData();
    };
  }
  tr.appendChild(td);
}

function addLocatieCell(tr,o){
  const td=document.createElement("td");
  td.textContent = o.locatie || "";

  if (isAdmin){
    td.classList.add("editable");
    td.onclick=()=>{
      const sel=document.createElement("select");
      const opties=[
        "Bever lokaal", "Welpen lokaal","De hoop","Zandveld",
        "Kampvuurkuil","Grasveld","Van terrein af","Niet op locatie"
      ];
      sel.innerHTML = `<option value=""></option>` +
        opties.map(x=>`<option value="${x}">${x}</option>`).join("");

      sel.value=o.locatie||"";
      td.innerHTML=""; td.appendChild(sel); sel.focus();

      sel.onblur=async()=>{
        await update(ref(db,`${speltak}/opkomsten/${o.id}`),{ locatie: sel.value });
        loadData();
      };
    };
  }

  tr.appendChild(td);
}

function addProcorCell(tr,o){
  const td=document.createElement("td");
  td.textContent = getNaam(o.procor);

  if (isAdmin){
    td.classList.add("editable");
    td.onclick=()=>{
      const sel=document.createElement("select");
      sel.innerHTML=`<option value=""></option>`+
      leiding.filter(l=>!l.hidden).map(l=>`<option value="${l.id}">${l.naam}</option>`).join("");

      sel.value=o.procor||"";
      td.innerHTML=""; td.appendChild(sel); sel.focus();

      sel.onblur=async()=>{
        await update(ref(db,`${speltak}/opkomsten/${o.id}`),{ procor: sel.value });
        loadData();
      };
    };
  }

  tr.appendChild(td);
}

function addBertCell(tr,o){
  const td=document.createElement("td");
  td.textContent=getNaam(o.bert_met);

  if (isAdmin){
    td.classList.add("editable");
    td.onclick=()=>{
      const sel=document.createElement("select");
      sel.innerHTML=`<option value=""></option>`+
      jeugd.filter(j=>!j.hidden).map(j=>`<option value="${j.id}">${j.naam}</option>`).join("");

      sel.value=o.bert_met||"";
      td.innerHTML=""; td.appendChild(sel); sel.focus();

      sel.onblur=async()=>{
        await update(ref(db,`${speltak}/opkomsten/${o.id}`),{ bert_met: sel.value });
        loadData();
      };
    };
  }

  tr.appendChild(td);
}

/* -----------------------------------------------------
   AANWEZIGHEID
----------------------------------------------------- */

function ensurePresence(o){
  if (!o.aanwezigheid) o.aanwezigheid={};

  jeugd.forEach(j=>{
    if (!o.aanwezigheid[j.id]) o.aanwezigheid[j.id]="onbekend";
  });

  leiding.forEach(l=>{
    const key="leiding-"+l.id;
    if (!o.aanwezigheid[key]) o.aanwezigheid[key]="onbekend";
  });
}

function makePresenceCell(o,key,groep){
  const state=o.aanwezigheid[key]||"onbekend";
  const td=document.createElement("td");
  td.classList.add("presence-cell");
  td.classList.add(groep==="leiding"?"col-leiding":"col-jeugd");

  // Speciale reminder (!) binnen 3 dagen
  let display = "?";
  if (state==="aanwezig") display="✔";
  else if (state==="afwezig") display="✖";
  else if (state==="onbekend" && isBinnen3Dagen(o.datum)) display="!";

  if (state==="aanwezig") td.classList.add("presence-aanwezig");
  if (state==="afwezig") td.classList.add("presence-afwezig");
  if (display==="!") td.classList.add("presence-reminder");

  td.textContent=display;

  td.onclick=async()=>{
    if (!o.aanwezigheid) o.aanwezigheid={};
    const current=o.aanwezigheid[key]||"onbekend";
    const next=current==="onbekend"?"aanwezig":current==="aanwezig"?"afwezig":"onbekend";
    await update(ref(db,`${speltak}/opkomsten/${o.id}/aanwezigheid`),{ [key]: next });
    loadData();
  };

  return td;
}

/* -----------------------------------------------------
   NIEUWE OPKOMST
----------------------------------------------------- */

async function addNewOpkomst(){
  if (!isAdmin) return;

  const id = "opkomst-"+Date.now();

  const nieuw={
    datum: todayISO,
    thema:"",
    bijzonderheden:"",
    typeOpkomst:"normaal",
    starttijd:"10:30",
    eindtijd:"12:30",
    locatie:"",
    procor:"",
    bert_met:"",
    aanwezigheid:{}
  };

  jeugd.forEach(j=> nieuw.aanwezigheid[j.id]="onbekend");
  leiding.forEach(l=> nieuw.aanwezigheid["leiding-"+l.id]="onbekend");

  await set(ref(db,`${speltak}/opkomsten/${id}`),nieuw);
  loadData();
}

/* -----------------------------------------------------
   LEDENBEHEER
----------------------------------------------------- */

function toggleLedenbeheer(){
  const sec=document.getElementById("ledenbeheer");
  sec.classList.toggle("hidden");
}

function renderLedenbeheer(){
  const ulJ=document.getElementById("ledenbeheerJeugd");
  const ulL=document.getElementById("ledenbeheerLeiding");

  if (!isAdmin){
    ulJ.innerHTML="";
    ulL.innerHTML="";
    return;
  }

  ulJ.innerHTML="";
  ulL.innerHTML="";

  jeugd.forEach(j=> ulJ.appendChild(buildLidItem(j,"jeugd")));
  leiding.forEach(l=> ulL.appendChild(buildLidItem(l,"leiding")));
}

function buildLidItem(lid,type){
  const li=document.createElement("li");
  if (lid.hidden) li.classList.add("lid-verborgen");

  const name=document.createElement("span");
  name.textContent=lid.naam;

  const controls=document.createElement("div");
  controls.classList.add("ledenbeheer-controls");

  // ▲
  const up=document.createElement("button");
  up.textContent="▲";
  up.classList.add("ledenbeheer-btn");
  up.onclick=()=> moveLid(lid,type,-1);

  // ▼
  const down=document.createElement("button");
  down.textContent="▼";
  down.classList.add("ledenbeheer-btn");
  down.onclick=()=> moveLid(lid,type,1);

  // ✏ naam
  const edit=document.createElement("button");
  edit.textContent="✏";
  edit.classList.add("ledenbeheer-btn");
  edit.onclick=()=> editLidNaam(lid,type);

  // 👁/🚫 verbergen
  const hide=document.createElement("button");
  hide.textContent=lid.hidden?"👁":"🚫";
  hide.classList.add("ledenbeheer-btn");
  hide.onclick=()=> toggleHideLid(lid,type);

  // 🗑 verwijderen
  const del=document.createElement("button");
  del.textContent="🗑";
  del.classList.add("ledenbeheer-btn");
  del.onclick=()=> deleteLid(lid,type);

  controls.append(up,down,edit,hide,del);
  li.append(name,controls);
  return li;
}

async function moveLid(lid,type,delta){
  const lijst = type==="jeugd"?jeugd:leiding;

  const idx=lijst.findIndex(x=>x.id===lid.id);
  if (idx<0) return;

  const nieuwIdx=idx+delta;
  if (nieuwIdx<0 || nieuwIdx>=lijst.length) return;

  const tmp=lijst[idx].volgorde;
  lijst[idx].volgorde=lijst[nieuwIdx].volgorde;
  lijst[nieuwIdx].volgorde=tmp;

  await update(ref(db,`${speltak}/${type==="jeugd"?"jeugdleden":"leiding"}/${lid.id}`),
               { volgorde: lijst[idx].volgorde });

  await update(ref(db,`${speltak}/${type==="jeugd"?"jeugdleden":"leiding"}/${lijst[nieuwIdx].id}`),
               { volgorde: lijst[nieuwIdx].volgorde });

  loadData();
}

async function editLidNaam(lid,type){
  const nieuw=prompt("Nieuwe naam:", lid.naam);
  if (!nieuw) return;

  await update(ref(db,`${speltak}/${type==="jeugd"?"jeugdleden":"leiding"}/${lid.id}`),
               { naam: nieuw });
  loadData();
}

async function toggleHideLid(lid,type){
  const nieuw = !lid.hidden;

  await update(ref(db,`${speltak}/${type==="jeugd"?"jeugdleden":"leiding"}/${lid.id}`),
               { hidden: nieuw });

  loadData();
}

async function deleteLid(lid,type){
  if (!confirm("Lid verwijderen?")) return;

  // Verwijder uit ledenlijst
  await remove(ref(db,`${speltak}/${type==="jeugd"?"jeugdleden":"leiding"}/${lid.id}`));

  // Verwijder uit alle opkomsten
  for (const o of opkomsten){
    const key = type==="jeugd"? lid.id : `leiding-${lid.id}`;
    await update(ref(db,`${speltak}/opkomsten/${o.id}/aanwezigheid`),{ [key]: null });
  }

  loadData();
}

/* -----------------------------------------------------
   EINDE
----------------------------------------------------- */
