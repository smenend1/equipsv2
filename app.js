import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";

import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  where,
  orderBy,
  runTransaction,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCTJQavGjQzQPtjGn1Ev6QVL78-Hs2Sr10",
  authDomain: "assistencia-basquet.firebaseapp.com",
  projectId: "assistencia-basquet",
  storageBucket: "assistencia-basquet.firebasestorage.app",
  messagingSenderId: "1047941126045",
  appId: "1:1047941126045:web:c0113a5e46a3620e3ec174"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const META_DOC_ID = "_meta";
const STORAGE_KEY = "assistenciaBasquetConfigV2";

const STATUS = {
  present: {
    label: "Present",
    short: "P",
    className: "present"
  },
  absent: {
    label: "Absent",
    short: "A",
    className: "absent"
  },
  justified: {
    label: "Justificat",
    short: "J",
    className: "justified"
  }
};

const state = {
  config: loadConfig(),
  entityId: "",
  teamName: "",
  teamId: "",
  date: getTodayISO(),
  locked: false,
  players: new Map(),
  reportRows: [],
  unsubscribePlayers: null,
  unsubscribeAttendance: null,
  unsubscribeLock: null
};

const $ = (selector) => document.querySelector(selector);

const screenHome = $("#screen-home");
const screenAttendance = $("#screen-attendance");
const screenReport = $("#screen-report");

const entitySelect = $("#entity-select");
const teamSelect = $("#team-select");

const entityLogoInput = $("#entity-logo-input");
const entityLogoPreview = $("#entity-logo-preview");
const removeLogoBtn = $("#remove-logo-btn");
const attendanceLogo = $("#attendance-logo");

const newEntityInput = $("#new-entity-id");
const newTeamInput = $("#new-team-name");

const addEntityBtn = $("#add-entity-btn");
const addTeamBtn = $("#add-team-btn");
const deleteEntityBtn = $("#delete-entity-btn");
const deleteTeamBtn = $("#delete-team-btn");
const openAttendanceBtn = $("#open-attendance-btn");

const backHomeBtn = $("#back-home-btn");
const backAttendanceBtn = $("#back-attendance-btn");
const attendanceDateInput = $("#attendance-date");

const teamTitle = $("#team-title");
const contextTitle = $("#context-title");

const csvInput = $("#csv-input");
const closeDayBtn = $("#close-day-btn");
const monthlyReportBtn = $("#monthly-report-btn");
const lockedBanner = $("#locked-banner");

const reportMonthInput = $("#report-month");
const reportContext = $("#report-context");
const reportLogo = $("#report-logo");
const loadReportBtn = $("#load-report-btn");
const exportReportBtn = $("#export-report-btn");
const monthlyReportList = $("#monthly-report-list");
const summaryPlayers = $("#summary-players");
const summaryPresent = $("#summary-present");
const summaryAbsent = $("#summary-absent");
const summaryJustified = $("#summary-justified");

const playersList = $("#players-list");
const toast = $("#toast");

attendanceDateInput.value = state.date;
reportMonthInput.value = state.date.slice(0, 7);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch((error) => {
      console.warn("No s'ha pogut registrar el Service Worker:", error);
    });
  });
}

migrateOldSingleEntityConfig();
renderHomeSelectors();

entitySelect.addEventListener("change", () => {
  state.config.selectedEntityId = entitySelect.value;
  state.config.selectedTeamIdByEntity[state.config.selectedEntityId] =
    getCurrentEntity()?.teams?.[0]?.id || "";

  saveConfig();
  renderHomeSelectors();
});

teamSelect.addEventListener("change", () => {
  const entityId = entitySelect.value;

  if (!entityId) return;

  state.config.selectedTeamIdByEntity[entityId] = teamSelect.value;
  saveConfig();
});

entityLogoInput.addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  const entity = getCurrentEntity();

  if (!entity) {
    showToast("Primer escull o afegeix una entitat.");
    entityLogoInput.value = "";
    return;
  }

  if (!file) return;

  try {
    const dataUrl = await imageFileToDataUrl(file);

    entity.logoDataUrl = dataUrl;

    saveConfig();
    renderEntityLogo();
    showToast("Escut guardat en aquest dispositiu.");
  } catch (error) {
    console.error(error);
    showToast("No s'ha pogut carregar l'escut.");
  } finally {
    entityLogoInput.value = "";
  }
});

removeLogoBtn.addEventListener("click", () => {
  const entity = getCurrentEntity();

  if (!entity) {
    showToast("No hi ha cap entitat seleccionada.");
    return;
  }

  delete entity.logoDataUrl;

  saveConfig();
  renderEntityLogo();

  showToast("Escut eliminat d'aquest dispositiu.");
});

addEntityBtn.addEventListener("click", () => {
  const entityId = normalizeId(newEntityInput.value);

  if (!entityId) {
    showToast("Escriu un ID d’entitat vàlid.");
    return;
  }

  if (!state.config.entities.some((entity) => entity.id === entityId)) {
    state.config.entities.push({
      id: entityId,
      name: entityId,
      teams: []
    });
  }

  state.config.selectedEntityId = entityId;
  state.config.selectedTeamIdByEntity[entityId] ||= "";

  newEntityInput.value = "";

  saveConfig();
  renderHomeSelectors();

  showToast("Entitat afegida.");
});

addTeamBtn.addEventListener("click", () => {
  const entity = getCurrentEntity();

  if (!entity) {
    showToast("Primer escull o afegeix una entitat.");
    return;
  }

  const teamName = newTeamInput.value.trim();

  if (!teamName) {
    showToast("Escriu el nom de l’equip.");
    return;
  }

  const teamId = normalizeId(teamName);

  if (!entity.teams.some((team) => team.id === teamId)) {
    entity.teams.push({
      id: teamId,
      name: teamName
    });
  }

  state.config.selectedTeamIdByEntity[entity.id] = teamId;
  newTeamInput.value = "";

  saveConfig();
  renderHomeSelectors();

  showToast("Equip afegit.");
});

deleteEntityBtn.addEventListener("click", () => {
  const entity = getCurrentEntity();

  if (!entity) {
    showToast("No hi ha cap entitat seleccionada.");
    return;
  }

  const confirmed = window.confirm(
    `Vols esborrar "${entity.id}" d’aquest dispositiu? No s’esborren dades de Firebase.`
  );

  if (!confirmed) return;

  state.config.entities = state.config.entities.filter((item) => item.id !== entity.id);
  delete state.config.selectedTeamIdByEntity[entity.id];

  state.config.selectedEntityId = state.config.entities[0]?.id || "";

  saveConfig();
  renderHomeSelectors();

  showToast("Entitat esborrada d’aquest dispositiu.");
});

deleteTeamBtn.addEventListener("click", () => {
  const entity = getCurrentEntity();
  const team = getCurrentTeam();

  if (!entity || !team) {
    showToast("No hi ha cap equip seleccionat.");
    return;
  }

  const confirmed = window.confirm(
    `Vols esborrar "${team.name}" d’aquest dispositiu? No s’esborren dades de Firebase.`
  );

  if (!confirmed) return;

  entity.teams = entity.teams.filter((item) => item.id !== team.id);
  state.config.selectedTeamIdByEntity[entity.id] = entity.teams[0]?.id || "";

  saveConfig();
  renderHomeSelectors();

  showToast("Equip esborrat d’aquest dispositiu.");
});

openAttendanceBtn.addEventListener("click", () => {
  const entity = getCurrentEntity();
  const team = getCurrentTeam();

  if (!entity) {
    showToast("Afegeix o selecciona una entitat.");
    return;
  }

  if (!team) {
    showToast("Afegeix o selecciona un equip.");
    return;
  }

  state.entityId = entity.id;
  state.teamId = team.id;
  state.teamName = team.name;

  openAttendance();
});

backHomeBtn.addEventListener("click", () => {
  cleanupSubscriptions();
  showHome();
});

backAttendanceBtn.addEventListener("click", () => {
  showAttendance();
});

monthlyReportBtn.addEventListener("click", () => {
  openMonthlyReport();
});

loadReportBtn.addEventListener("click", () => {
  loadMonthlyReport();
});

exportReportBtn.addEventListener("click", () => {
  exportMonthlyReportCSV();
});

attendanceDateInput.addEventListener("change", () => {
  state.date = attendanceDateInput.value || getTodayISO();

  if (state.entityId && state.teamId) {
    openAttendance();
  }
});

csvInput.addEventListener("change", async (event) => {
  const file = event.target.files?.[0];

  if (!file) return;

  try {
    if (state.locked) {
      showToast("No es pot importar: el dia està tancat.");
      csvInput.value = "";
      return;
    }

    const text = await readFileAsUTF8(file);
    const rows = parseCSV(text);
    const players = rowsToPlayers(rows);

    if (!players.length) {
      showToast("No s’han trobat alumnes vàlids al CSV.");
      return;
    }

    await importPlayers(players);

    showToast(`${players.length} alumne/s importats.`);
  } catch (error) {
    console.error(error);
    showToast("Error important el CSV.");
  } finally {
    csvInput.value = "";
  }
});

closeDayBtn.addEventListener("click", async () => {
  if (state.locked) {
    showToast("El dia ja està tancat.");
    return;
  }

  const confirmed = window.confirm(
    "Segur que vols tancar el dia? Després no es podrà modificar l’assistència des de l’app."
  );

  if (!confirmed) return;

  try {
    await closeDay();
    showToast("Dia tancat correctament.");
  } catch (error) {
    console.error(error);
    showToast("No s’ha pogut tancar el dia.");
  }
});

function renderHomeSelectors() {
  const entities = state.config.entities;

  entitySelect.innerHTML = "";

  if (!entities.length) {
    entitySelect.innerHTML = `<option value="">Cap entitat guardada</option>`;
  } else {
    for (const entity of entities) {
      const option = document.createElement("option");
      option.value = entity.id;
      option.textContent = entity.id;
      entitySelect.appendChild(option);
    }

    if (!entities.some((entity) => entity.id === state.config.selectedEntityId)) {
      state.config.selectedEntityId = entities[0].id;
    }

    entitySelect.value = state.config.selectedEntityId;
  }

  renderTeamSelector();
  renderEntityLogo();
}

function renderTeamSelector() {
  const entity = getCurrentEntity();

  teamSelect.innerHTML = "";

  if (!entity) {
    teamSelect.innerHTML = `<option value="">Primer escull una entitat</option>`;
    return;
  }

  if (!entity.teams.length) {
    teamSelect.innerHTML = `<option value="">Cap equip guardat</option>`;
    return;
  }

  for (const team of entity.teams) {
    const option = document.createElement("option");
    option.value = team.id;
    option.textContent = team.name;
    teamSelect.appendChild(option);
  }

  const selectedTeamId = state.config.selectedTeamIdByEntity[entity.id];

  if (!entity.teams.some((team) => team.id === selectedTeamId)) {
    state.config.selectedTeamIdByEntity[entity.id] = entity.teams[0].id;
  }

  teamSelect.value = state.config.selectedTeamIdByEntity[entity.id];
}

function getCurrentEntity() {
  const selectedId = state.config.selectedEntityId || entitySelect.value;

  return state.config.entities.find((entity) => entity.id === selectedId) || null;
}

function getCurrentTeam() {
  const entity = getCurrentEntity();

  if (!entity) return null;

  const selectedTeamId = state.config.selectedTeamIdByEntity[entity.id] || teamSelect.value;

  return entity.teams.find((team) => team.id === selectedTeamId) || null;
}

function loadConfig() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      return {
        entities: [],
        selectedEntityId: "",
        selectedTeamIdByEntity: {}
      };
    }

    const parsed = JSON.parse(raw);

    return {
      entities: Array.isArray(parsed.entities) ? parsed.entities : [],
      selectedEntityId: parsed.selectedEntityId || "",
      selectedTeamIdByEntity: parsed.selectedTeamIdByEntity || {}
    };
  } catch {
    return {
      entities: [],
      selectedEntityId: "",
      selectedTeamIdByEntity: {}
    };
  }
}

function saveConfig() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.config));
}

function migrateOldSingleEntityConfig() {
  const oldEntityId = localStorage.getItem("entityId");

  if (!oldEntityId) return;

  const normalized = normalizeId(oldEntityId);

  if (!normalized) return;

  if (!state.config.entities.some((entity) => entity.id === normalized)) {
    state.config.entities.push({
      id: normalized,
      name: normalized,
      teams: []
    });

    state.config.selectedEntityId = normalized;
    state.config.selectedTeamIdByEntity[normalized] ||= "";

    saveConfig();
  }
}


function renderEntityLogo() {
  const entity = getCurrentEntity();

  if (!entityLogoPreview) return;

  if (entity?.logoDataUrl) {
    entityLogoPreview.classList.remove("empty");
    entityLogoPreview.innerHTML = `<img src="${escapeAttribute(entity.logoDataUrl)}" alt="Escut de l'entitat">`;
    return;
  }

  entityLogoPreview.classList.add("empty");
  entityLogoPreview.textContent = "🏀";
}

function renderAttendanceLogo() {
  const entity = getCurrentEntity();

  if (!attendanceLogo) return;

  if (entity?.logoDataUrl) {
    attendanceLogo.classList.remove("empty");
    attendanceLogo.innerHTML = `<img src="${escapeAttribute(entity.logoDataUrl)}" alt="Escut de l'entitat">`;
    return;
  }

  attendanceLogo.classList.add("empty");
  attendanceLogo.textContent = "🏀";
}

async function imageFileToDataUrl(file) {
  if (!file.type.startsWith("image/")) {
    throw new Error("INVALID_IMAGE");
  }

  if (file.type === "image/svg+xml") {
    const svgText = await readFileAsUTF8(file);
    const encoded = btoa(unescape(encodeURIComponent(svgText)));
    return `data:image/svg+xml;base64,${encoded}`;
  }

  return resizeRasterImage(file, 512, 0.88);
}

function resizeRasterImage(file, maxSize, quality) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const reader = new FileReader();

    reader.onload = () => {
      image.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
        const width = Math.max(1, Math.round(image.width * scale));
        const height = Math.max(1, Math.round(image.height * scale));

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const context = canvas.getContext("2d");
        context.drawImage(image, 0, 0, width, height);

        resolve(canvas.toDataURL("image/webp", quality));
      };

      image.onerror = () => reject(new Error("IMAGE_LOAD_ERROR"));
      image.src = String(reader.result || "");
    };

    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}


function openMonthlyReport() {
  reportMonthInput.value = state.date.slice(0, 7);
  reportContext.textContent = `${state.entityId} · ${state.teamName}`;
  renderReportLogo();
  resetMonthlyReport();
  showReport();
}

function resetMonthlyReport() {
  state.reportRows = [];
  exportReportBtn.disabled = true;

  summaryPlayers.textContent = "0";
  summaryPresent.textContent = "0";
  summaryAbsent.textContent = "0";
  summaryJustified.textContent = "0";

  monthlyReportList.innerHTML = `
    <div class="empty-state">
      Prem “Carregar resum” per calcular les assistències del mes.
    </div>
  `;
}

async function loadMonthlyReport() {
  const monthValue = reportMonthInput.value;

  if (!monthValue || !/^\d{4}-\d{2}$/.test(monthValue)) {
    showToast("Escull un mes vàlid.");
    return;
  }

  loadReportBtn.disabled = true;
  exportReportBtn.disabled = true;
  loadReportBtn.textContent = "Carregant...";

  try {
    const playersSnapshot = await getDocs(query(
      getPlayersCollectionRef(),
      orderBy("dorsalNumber", "asc")
    ));

    const rowsByPlayer = new Map();

    playersSnapshot.forEach((docSnap) => {
      const data = docSnap.data();

      rowsByPlayer.set(docSnap.id, {
        playerId: docSnap.id,
        name: data.name || "Sense nom",
        dorsal: data.dorsal || "",
        dorsalNumber: data.dorsalNumber ?? 9999,
        present: 0,
        absent: 0,
        justified: 0,
        total: 0
      });
    });

    const dates = getDatesForMonth(monthValue);

    for (const date of dates) {
      const attendanceSnapshot = await getDocs(query(
        collection(db, "assistencies", state.entityId, "dies", date, "registres"),
        where("teamId", "==", state.teamId)
      ));

      attendanceSnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const playerId = docSnap.id;

        if (!rowsByPlayer.has(playerId)) {
          rowsByPlayer.set(playerId, {
            playerId,
            name: data.playerName || data.name || playerId,
            dorsal: data.dorsal || "",
            dorsalNumber: 9999,
            present: 0,
            absent: 0,
            justified: 0,
            total: 0
          });
        }

        const row = rowsByPlayer.get(playerId);
        const status = data.status || "absent";

        if (status === "present") {
          row.present++;
          row.total++;
        } else if (status === "absent") {
          row.absent++;
          row.total++;
        } else if (status === "justified") {
          row.justified++;
          row.total++;
        }
      });
    }

    state.reportRows = Array.from(rowsByPlayer.values())
      .sort((a, b) => {
        const aNum = Number(a.dorsalNumber);
        const bNum = Number(b.dorsalNumber);

        if (!Number.isNaN(aNum) && !Number.isNaN(bNum)) {
          return aNum - bNum;
        }

        return String(a.name).localeCompare(String(b.name), "ca");
      });

    renderMonthlyReport();

    showToast("Resum mensual carregat.");
  } catch (error) {
    console.error(error);
    monthlyReportList.innerHTML = `
      <div class="empty-state">
        No s'ha pogut carregar el resum. Revisa permisos o connexió.
      </div>
    `;
    showToast("Error carregant el resum.");
  } finally {
    loadReportBtn.disabled = false;
    loadReportBtn.textContent = "Carregar resum";
  }
}

function renderMonthlyReport() {
  const rows = state.reportRows;

  const totals = rows.reduce((acc, row) => {
    acc.present += row.present;
    acc.absent += row.absent;
    acc.justified += row.justified;
    return acc;
  }, { present: 0, absent: 0, justified: 0 });

  summaryPlayers.textContent = String(rows.length);
  summaryPresent.textContent = String(totals.present);
  summaryAbsent.textContent = String(totals.absent);
  summaryJustified.textContent = String(totals.justified);

  if (!rows.length) {
    exportReportBtn.disabled = true;
    monthlyReportList.innerHTML = `
      <div class="empty-state">
        No hi ha jugadors o assistències per aquest mes.
      </div>
    `;
    return;
  }

  const fragment = document.createDocumentFragment();

  for (const row of rows) {
    const item = document.createElement("div");
    item.className = "monthly-row";

    item.innerHTML = `
      <div class="sticky-col">
        <div class="player-name">${escapeHTML(row.name)}</div>
        <div class="player-sub">${escapeHTML(row.playerId)}</div>
      </div>
      <div><span class="dorsal">${escapeHTML(row.dorsal || "-")}</span></div>
      <div><span class="count-pill present-count">${row.present}</span></div>
      <div><span class="count-pill absent-count">${row.absent}</span></div>
      <div><span class="count-pill justified-count">${row.justified}</span></div>
      <div><span class="count-pill">${row.total}</span></div>
    `;

    fragment.appendChild(item);
  }

  monthlyReportList.replaceChildren(fragment);
  exportReportBtn.disabled = false;
}

function exportMonthlyReportCSV() {
  if (!state.reportRows.length) {
    showToast("Primer carrega un resum.");
    return;
  }

  const month = reportMonthInput.value;
  const rows = [
    ["Entitat", state.entityId],
    ["Equip", state.teamName],
    ["Mes", month],
    [],
    ["Jugador", "Dorsal", "Presents", "Absents", "Justificats", "Total"]
  ];

  for (const row of state.reportRows) {
    rows.push([
      row.name,
      row.dorsal,
      row.present,
      row.absent,
      row.justified,
      row.total
    ]);
  }

  const csv = rows.map((row) => row.map(csvEscape).join(",")).join("\n");
  const filename = `assistencies_${state.entityId}_${state.teamId}_${month}.csv`;

  downloadTextFile(filename, "\uFEFF" + csv, "text/csv;charset=utf-8");
}

function getDatesForMonth(monthValue) {
  const [year, month] = monthValue.split("-").map(Number);
  const result = [];
  const date = new Date(year, month - 1, 1);

  while (date.getFullYear() === year && date.getMonth() === month - 1) {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");

    result.push(`${yyyy}-${mm}-${dd}`);
    date.setDate(date.getDate() + 1);
  }

  return result;
}

function csvEscape(value) {
  const text = String(value ?? "");

  if (/[",\n\r]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }

  return text;
}

function downloadTextFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);
}

function renderReportLogo() {
  const entity = getCurrentEntity();

  if (!reportLogo) return;

  if (entity?.logoDataUrl) {
    reportLogo.classList.remove("empty");
    reportLogo.innerHTML = `<img src="${escapeAttribute(entity.logoDataUrl)}" alt="Escut de l'entitat">`;
    return;
  }

  reportLogo.classList.add("empty");
  reportLogo.textContent = "🏀";
}

function openAttendance() {
  cleanupSubscriptions();

  state.players.clear();
  state.locked = false;

  attendanceDateInput.value = state.date;
reportMonthInput.value = state.date.slice(0, 7);
  teamTitle.textContent = state.teamName;
  contextTitle.textContent = `${state.entityId} · ${formatDate(state.date)}`;
  renderAttendanceLogo();

  renderLockState();
  renderPlayers();

  showAttendance();

  subscribeToLock();
  subscribeToPlayers();
  subscribeToAttendance();
}

function getPlayersCollectionRef() {
  return collection(db, "entitats", state.entityId, "equips", state.teamId, "jugadors");
}

function getAttendanceCollectionRef() {
  return collection(db, "assistencies", state.entityId, "dies", state.date, "registres");
}

function getLockRef() {
  return doc(db, "assistencies", state.entityId, "dies", state.date, "meta", META_DOC_ID);
}

function subscribeToLock() {
  const lockRef = getLockRef();

  state.unsubscribeLock = onSnapshot(
    lockRef,
    (snapshot) => {
      state.locked = snapshot.exists() && snapshot.data().locked === true;

      renderLockState();
      renderPlayers();
    },
    (error) => {
      console.error("Error sincronitzant bloqueig:", error);
      showToast("Error sincronitzant el bloqueig.");
    }
  );
}

function subscribeToPlayers() {
  const playersQuery = query(
    getPlayersCollectionRef(),
    orderBy("dorsalNumber", "asc")
  );

  state.unsubscribePlayers = onSnapshot(
    playersQuery,
    (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        const data = change.doc.data();

        if (change.type === "removed") {
          state.players.delete(change.doc.id);
          return;
        }

        const previous = state.players.get(change.doc.id) || {};

        state.players.set(change.doc.id, {
          ...previous,
          playerId: change.doc.id,
          name: data.name,
          dorsal: data.dorsal,
          dorsalNumber: data.dorsalNumber
        });
      });

      renderPlayers();
    },
    (error) => {
      console.error("Error sincronitzant jugadors:", error);
      showToast("Error carregant jugadors.");
    }
  );
}

function subscribeToAttendance() {
  const attendanceQuery = query(
    getAttendanceCollectionRef(),
    where("teamId", "==", state.teamId)
  );

  state.unsubscribeAttendance = onSnapshot(
    attendanceQuery,
    (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        const data = change.doc.data();
        const existing = state.players.get(change.doc.id) || {};

        if (change.type === "removed") {
          state.players.set(change.doc.id, {
            ...existing,
            status: "absent"
          });
          return;
        }

        state.players.set(change.doc.id, {
          ...existing,
          playerId: change.doc.id,
          status: data.status || "absent"
        });
      });

      renderPlayers();
    },
    (error) => {
      console.error("Error sincronitzant assistència:", error);
      showToast("Error sincronitzant assistència.");
    }
  );
}

function renderPlayers() {
  const players = Array.from(state.players.values())
    .filter((player) => player.name)
    .sort((a, b) => {
      const aNum = Number(a.dorsalNumber);
      const bNum = Number(b.dorsalNumber);

      if (!Number.isNaN(aNum) && !Number.isNaN(bNum)) {
        return aNum - bNum;
      }

      return String(a.name).localeCompare(String(b.name), "ca");
    });

  if (!players.length) {
    playersList.innerHTML = `
      <div class="empty-state">
        Encara no hi ha jugadors. Importa un CSV per començar.
      </div>
    `;
    return;
  }

  const fragment = document.createDocumentFragment();

  players.forEach((player) => {
    const status = player.status || "absent";

    const row = document.createElement("div");
    row.className = "player-row";

    row.innerHTML = `
      <div class="sticky-col">
        <div class="player-name">${escapeHTML(player.name)}</div>
        <div class="player-sub">${escapeHTML(STATUS[status]?.label || "Absent")}</div>
      </div>

      <div>
        <span class="dorsal">${escapeHTML(player.dorsal || "-")}</span>
      </div>

      ${renderStatusCell(player.playerId, "present", status)}
      ${renderStatusCell(player.playerId, "absent", status)}
      ${renderStatusCell(player.playerId, "justified", status)}
    `;

    row.querySelectorAll("[data-status]").forEach((button) => {
      button.addEventListener("click", () => {
        updatePlayerStatus(player.playerId, button.dataset.status);
      });
    });

    fragment.appendChild(row);
  });

  playersList.replaceChildren(fragment);
}

function renderStatusCell(playerId, statusKey, currentStatus) {
  const config = STATUS[statusKey];
  const active = currentStatus === statusKey ? "active" : "";

  return `
    <div>
      <button
        class="status-btn ${config.className} ${active}"
        data-player-id="${escapeHTML(playerId)}"
        data-status="${statusKey}"
        ${state.locked ? "disabled" : ""}
        aria-label="${config.label}"
        title="${config.label}"
      >
        ${config.short}
      </button>
    </div>
  `;
}

async function updatePlayerStatus(playerId, nextStatus) {
  if (state.locked) {
    showToast("Només lectura: el dia està tancat.");
    return;
  }

  if (!STATUS[nextStatus]) {
    showToast("Estat no vàlid.");
    return;
  }

  const lockRef = getLockRef();
  const attendanceRef = doc(getAttendanceCollectionRef(), playerId);

  try {
    await runTransaction(db, async (transaction) => {
      const lockSnap = await transaction.get(lockRef);

      if (lockSnap.exists() && lockSnap.data().locked === true) {
        throw new Error("DAY_LOCKED");
      }

      transaction.set(
        attendanceRef,
        {
          entityId: state.entityId,
          teamId: state.teamId,
          teamName: state.teamName,
          playerId,
          date: state.date,
          status: nextStatus,
          updatedAt: serverTimestamp(),
          updatedByClient: getClientId()
        },
        { merge: true }
      );
    });
  } catch (error) {
    if (error.message === "DAY_LOCKED") {
      showToast("No es pot modificar: el dia acaba de ser tancat.");
      return;
    }

    console.error(error);
    showToast("No s’ha pogut actualitzar.");
  }
}

async function importPlayers(players) {
  const lockSnap = await getDoc(getLockRef());

  if (lockSnap.exists() && lockSnap.data().locked === true) {
    state.locked = true;
    renderLockState();
    throw new Error("DAY_LOCKED");
  }

  const writes = [];

  for (const player of players) {
    const playerId = buildPlayerId(player);
    const playerRef = doc(getPlayersCollectionRef(), playerId);
    const attendanceRef = doc(getAttendanceCollectionRef(), playerId);

    writes.push(
      setDoc(
        playerRef,
        {
          playerId,
          entityId: state.entityId,
          teamId: state.teamId,
          teamName: state.teamName,
          name: player.name,
          dorsal: player.dorsal,
          dorsalNumber: toSortableNumber(player.dorsal),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        },
        { merge: true }
      )
    );

    writes.push(
      setDoc(
        attendanceRef,
        {
          entityId: state.entityId,
          teamId: state.teamId,
          teamName: state.teamName,
          playerId,
          date: state.date,
          status: "absent",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        },
        { merge: true }
      )
    );
  }

  await Promise.all(writes);
}

async function closeDay() {
  const lockRef = getLockRef();

  await runTransaction(db, async (transaction) => {
    const lockSnap = await transaction.get(lockRef);

    if (lockSnap.exists() && lockSnap.data().locked === true) {
      return;
    }

    transaction.set(
      lockRef,
      {
        locked: true,
        entityId: state.entityId,
        date: state.date,
        lockedAt: serverTimestamp(),
        lockedByClient: getClientId()
      },
      { merge: true }
    );
  });
}

function renderLockState() {
  lockedBanner.classList.toggle("hidden", !state.locked);

  closeDayBtn.disabled = state.locked;
  closeDayBtn.textContent = state.locked ? "Dia Tancat" : "Tancar Dia";

  const fileLabel = document.querySelector(".file-btn");
  if (fileLabel) {
    fileLabel.classList.toggle("disabled", state.locked);
  }
}

function parseCSV(text) {
  const cleanText = String(text || "").replace(/^\uFEFF/, "");

  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < cleanText.length; i++) {
    const char = cleanText[i];
    const next = cleanText[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      cell += '"';
      i++;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(cell.trim());
      cell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        i++;
      }

      row.push(cell.trim());

      if (row.some(Boolean)) {
        rows.push(row);
      }

      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  row.push(cell.trim());

  if (row.some(Boolean)) {
    rows.push(row);
  }

  return rows;
}

function rowsToPlayers(rows) {
  if (!rows.length) return [];

  const firstRow = rows[0].map(normalizeHeader);

  const hasHeader =
    firstRow.includes("nom") ||
    firstRow.includes("nombre") ||
    firstRow.includes("dorsal");

  let startIndex = 0;
  let nameIndex = 0;
  let dorsalIndex = 1;

  if (hasHeader) {
    startIndex = 1;

    nameIndex = firstRow.includes("nom")
      ? firstRow.indexOf("nom")
      : firstRow.indexOf("nombre");

    if (nameIndex < 0) nameIndex = 0;

    dorsalIndex = firstRow.indexOf("dorsal");
    if (dorsalIndex < 0) dorsalIndex = 1;
  }

  const seen = new Set();

  return rows
    .slice(startIndex)
    .map((row) => ({
      name: String(row[nameIndex] || "").trim(),
      dorsal: String(row[dorsalIndex] || "").trim()
    }))
    .filter((player) => {
      if (!player.name) return false;

      const key = `${player.name.toLowerCase()}-${player.dorsal}`;

      if (seen.has(key)) return false;

      seen.add(key);
      return true;
    });
}

function readFileAsUTF8(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error);

    reader.readAsText(file, "UTF-8");
  });
}

function cleanupSubscriptions() {
  if (typeof state.unsubscribePlayers === "function") {
    state.unsubscribePlayers();
    state.unsubscribePlayers = null;
  }

  if (typeof state.unsubscribeAttendance === "function") {
    state.unsubscribeAttendance();
    state.unsubscribeAttendance = null;
  }

  if (typeof state.unsubscribeLock === "function") {
    state.unsubscribeLock();
    state.unsubscribeLock = null;
  }
}

function showHome() {
  screenAttendance.classList.remove("active");
  screenReport.classList.remove("active");
  screenHome.classList.add("active");
  renderHomeSelectors();
}

function showAttendance() {
  screenHome.classList.remove("active");
  screenReport.classList.remove("active");
  screenAttendance.classList.add("active");
}

function showReport() {
  screenHome.classList.remove("active");
  screenAttendance.classList.remove("active");
  screenReport.classList.add("active");
}

function getTodayISO() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  const localDate = new Date(now.getTime() - offset * 60 * 1000);

  return localDate.toISOString().slice(0, 10);
}

function formatDate(isoDate) {
  const [year, month, day] = isoDate.split("-").map(Number);

  return new Intl.DateTimeFormat("ca-ES", {
    dateStyle: "full"
  }).format(new Date(year, month - 1, day));
}

function normalizeId(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 120);
}

function normalizeHeader(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function buildPlayerId(player) {
  return normalizeId(`${player.dorsal || "sd"}_${player.name}`);
}

function toSortableNumber(value) {
  const number = Number(String(value || "").replace(/[^\d.-]/g, ""));

  return Number.isFinite(number) ? number : 9999;
}

function getClientId() {
  let clientId = localStorage.getItem("clientId");

  if (!clientId) {
    clientId = crypto.randomUUID();
    localStorage.setItem("clientId", clientId);
  }

  return clientId;
}

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.remove("hidden");

  window.clearTimeout(showToast.timeout);

  showToast.timeout = window.setTimeout(() => {
    toast.classList.add("hidden");
  }, 2800);
}
