<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="UTF-8">
  <title>Bevers – Jaarplanning</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">

  <link rel="stylesheet" href="style.css">

  <style>
    /* Extra minimale styling boven op jouw OVN style */

    td.editable:hover {
      background: #fff6cc;
      cursor: text;
    }

    .presence-cell {
      cursor: pointer;
      font-size: 18px;
      font-weight: bold;
    }

    .delete-btn {
      cursor:pointer;
      color:#c62828;
      font-size:18px;
      font-weight:bold;
    }

    .add-row {
      text-align:left;
      padding:10px;
      background:#e8fbe8;
      cursor:pointer;
      font-weight:bold;
    }
    .add-row:hover {
      background:#d8f5d8;
    }

    .row-grey { background:#eee !important; }
    .row-next { background:#d9f7d9 !important; }
    .row-bijzonder { background:#fff4bf !important; }
    .row-kamp { background:#ffd9b5 !important; }

    .add-member-btn {
      padding:6px 12px;
      background:#0073e6;
      border:none;
      color:white;
      border-radius:4px;
      cursor:pointer;
    }
  </style>
</head>

<body data-speltak="bevers">

  <header class="topbar">
    <div class="topbar-left">
      <img class="topbar-logo"
           src="https://www.oliviervannoort.nl/images/logo-oliviervannoort-blauw-transparant.png">
      <div class="topbar-title">
        <h1>Bevers – Jaarplanning</h1>
        <span>Planning, aanwezigheid & overzicht</span>
      </div>
    </div>

    <a class="backlink" href="index.html">← Terug</a>
  </header>


  <main class="container">
    <section class="info-block">
      <h2>Planning</h2>
      <p>
        Ouders kunnen aanwezigheid invullen door op een vak te klikken.<br>
        In bewerkmodus kun je opkomsten en leden beheren.
      </p>
    </section>

    <button id="editButton" class="edit-button">Bewerkmodus</button>
    <button id="addMemberButton" class="add-member-btn" style="display:none;">+ Lid toevoegen</button>

    <div class="table-wrapper">
      <table class="planning-table">
        <thead>
          <tr id="headerRowTop"></tr>
          <tr id="headerRowBottom"></tr>
        </thead>

        <tbody id="tableBody"></tbody>

        <tfoot>
          <tr class="add-row" id="addOpkomstRow" style="display:none;">
            <td colspan="999">+ Opkomst toevoegen</td>
          </tr>
        </tfoot>
      </table>
    </div>
  </main>

  <script type="module" src="speltak.js"></script>
</body>
</html>
