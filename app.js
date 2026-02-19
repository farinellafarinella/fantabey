import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, updateProfile, signOut } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { getFirestore, collection, doc, setDoc, getDoc, getDocs, addDoc, query, orderBy, updateDoc, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDNG56-mS2ccafYesJKVQKkQQaJWZXl7gM",
  authDomain: "fantabey.firebaseapp.com",
  projectId: "fantabey",
  storageBucket: "fantabey.firebasestorage.app",
  messagingSenderId: "26899728137",
  appId: "1:26899728137:web:9227722246aa7205a0b5d8",
  measurementId: "G-0MJC2NP6Z2"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const ADMIN_CODE = "entropy";
const UI_STORAGE_KEY = "fantabey-ui";

const RULES = [
  { id: "win-4-0", label: "Vittoria 4-0", points: 5 },
  { id: "extreme", label: "Extreme Finish", points: 2 },
  { id: "luca", label: "Urla \"Luca sto sbollando\"", points: 1 },
  { id: "kpop", label: "Pose K-pop dopo vittoria", points: 2 },
  { id: "applause", label: "Pubblico applaude", points: 2 },
  { id: "blind", label: "Gioca bendato", points: 5 },
  { id: "selfie", label: "Selfie con avversario prima del match", points: 1 },
  { id: "pokemon", label: "Mostra una carta Pokémon all’avversario", points: 2 },
  { id: "snack", label: "Compra almeno 1 snack da Entropy", points: 2 },
  { id: "tiktok", label: "Fai un reel TikTok sul momento", points: 3 },
  { id: "monochrome", label: "Vestito monocolore completo", points: 3 },
  { id: "cobra", label: "Outfit Cobra Kai", points: 4 },
  { id: "dran", label: "Usa Dran Buster", points: 2 },
  { id: "pocket", label: "Bey in tasca", points: -2 },
  { id: "handshake", label: "Non stringi la mano", points: -2 },
  { id: "no-applause", label: "Non applaudi il vincitore", points: -2 },
  { id: "early-launch", label: "Lanci prima del countdown", points: -3 },
  { id: "fight", label: "Litigio serio", points: -20 }
];

const META_BEYS = [
  { id: "shark", label: "Shark Scale", points: -2 },
  { id: "phoenix", label: "Soar Phoenix", points: -2 },
  { id: "wizard", label: "Wizard Rod", points: -2 },
  { id: "silver", label: "Silver Wolf", points: -2 },
  { id: "hover", label: "Hover Wyvern", points: -2 }
];

const views = {
  regole: document.getElementById("view-regole"),
  account: document.getElementById("view-account"),
  lega: document.getElementById("view-lega"),
  iscrizione: document.getElementById("view-iscrizione"),
  giocatori: document.getElementById("view-giocatori"),
  squadre: document.getElementById("view-squadre"),
  admin: document.getElementById("view-admin")
};

const tabs = document.querySelectorAll(".tab");

const state = {
  currentUser: null,
  leagues: [],
  competitors: [],
  teams: [],
  currentLeagueId: null,
  adminUnlocked: false
};

function loadUiState() {
  const raw = localStorage.getItem(UI_STORAGE_KEY);
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw);
    state.currentLeagueId = parsed.currentLeagueId || null;
  } catch (_) {
    state.currentLeagueId = null;
  }
}

function saveUiState() {
  localStorage.setItem(UI_STORAGE_KEY, JSON.stringify({
    currentLeagueId: state.currentLeagueId
  }));
}

function showView(name) {
  Object.entries(views).forEach(([key, el]) => {
    if (key === name) {
      el.hidden = false;
      el.removeAttribute("aria-hidden");
    } else {
      el.hidden = true;
      el.setAttribute("aria-hidden", "true");
    }
  });
  tabs.forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.view === name);
  });
}

function formatPoints(value) {
  return value > 0 ? `+${value}` : `${value}`;
}

function renderRules() {
  const bonusList = document.getElementById("bonus-list");
  const malusList = document.getElementById("malus-list");
  bonusList.innerHTML = "";
  malusList.innerHTML = "";

  const winRule = document.createElement("div");
  winRule.className = "rule";
  winRule.innerHTML = `<span>Vittoria round (per round)</span><span class="points points-bonus">+3</span>`;
  bonusList.appendChild(winRule);

  const lossRule = document.createElement("div");
  lossRule.className = "rule";
  lossRule.innerHTML = `<span>Perde un round (per round)</span><span class="points points-malus">-3</span>`;
  malusList.appendChild(lossRule);

  RULES.forEach((rule) => {
    const card = document.createElement("div");
    card.className = "rule";
    card.innerHTML = `<span>${rule.label}</span><span class="points ${rule.points >= 0 ? "points-bonus" : "points-malus"}">${formatPoints(rule.points)}</span>`;
    if (rule.points >= 0) {
      bonusList.appendChild(card);
    } else {
      malusList.appendChild(card);
    }
  });

  META_BEYS.forEach((rule) => {
    const card = document.createElement("div");
    card.className = "rule";
    card.innerHTML = `<span>Malus Bey Meta: ${rule.label}</span><span class="points points-malus">${formatPoints(rule.points)}</span>`;
    malusList.appendChild(card);
  });
  const extra = document.createElement("div");
  extra.className = "rule";
  extra.innerHTML = `<span>2 meta nello stesso deck</span><span class="points points-malus">-5</span>`;
  malusList.appendChild(extra);
  const extra2 = document.createElement("div");
  extra2.className = "rule";
  extra2.innerHTML = `<span>3 meta nello stesso deck</span><span class="points points-malus">-8</span>`;
  malusList.appendChild(extra2);
  const extra3 = document.createElement("div");
  extra3.className = "rule";
  extra3.innerHTML = `<span>Vinci con full meta</span><span class="points points-malus">-3</span>`;
  malusList.appendChild(extra3);
}

function renderAccount() {
  const box = document.getElementById("account-status");
  const headerUser = document.getElementById("header-user");
  if (!state.currentUser) {
    box.innerHTML = `<p class="muted">Nessun utente connesso.</p>`;
    headerUser.textContent = "";
    return;
  }
  const name = state.currentUser.displayName || state.currentUser.email;
  headerUser.textContent = `Ciao, ${name}`;
  box.innerHTML = `
    <div class="list-item">
      <div>
        <strong>${name}</strong>
        <div class="muted">${state.currentUser.email}</div>
      </div>
      <button class="btn btn-ghost" id="logout">Logout</button>
    </div>
  `;
  const logoutBtn = document.getElementById("logout");
  logoutBtn.addEventListener("click", async () => {
    await signOut(auth);
  });
}

function renderLeagueSelect() {
  const select = document.getElementById("league-select");
  const note = document.getElementById("league-note");
  select.innerHTML = "";
  if (state.leagues.length === 0) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "Nessun torneo";
    select.appendChild(option);
    note.textContent = "Crea un torneo per iniziare.";
    return;
  }
  state.leagues.forEach((league) => {
    const option = document.createElement("option");
    option.value = league.id;
    option.textContent = league.name;
    select.appendChild(option);
  });
  if (state.currentLeagueId) {
    select.value = state.currentLeagueId;
    const current = state.leagues.find((l) => l.id === state.currentLeagueId);
    if (current) {
      const status = current.startedAt ? " (iniziato)" : "";
      note.textContent = `Torneo attivo: ${current.name}${status}`;
    } else {
      note.textContent = "Seleziona un torneo.";
    }
  } else {
    note.textContent = "Seleziona un torneo.";
  }
}

function renderCompetitorLeagueSelect() {
  const select = document.getElementById("competitor-league-select");
  if (!select) return;
  select.innerHTML = "";
  if (state.leagues.length === 0) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "Nessun torneo";
    select.appendChild(option);
    return;
  }
  state.leagues.forEach((league) => {
    const option = document.createElement("option");
    option.value = league.id;
    option.textContent = league.name;
    select.appendChild(option);
  });
  if (state.currentLeagueId) {
    select.value = state.currentLeagueId;
  }
}

function renderCompetitorPicker() {
  const picker = document.getElementById("team-picker");
  const note = document.getElementById("team-picker-note");
  picker.innerHTML = "";
  if (!state.currentLeagueId) {
    note.textContent = "Seleziona un torneo per vedere i giocatori.";
    return;
  }
  const league = state.leagues.find((l) => l.id === state.currentLeagueId);
  if (league?.startedAt) {
    note.textContent = "Torneo iniziato: non si possono più creare squadre.";
    return;
  }
  if (state.competitors.length === 0) {
    note.textContent = "Nessun giocatore in gara.";
    return;
  }
  note.textContent = "Seleziona esattamente 3 giocatori.";
  state.competitors.forEach((player) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "pick";
    btn.textContent = player.display;
    btn.dataset.playerId = player.userId;
    btn.addEventListener("click", () => {
      btn.classList.toggle("selected");
    });
    picker.appendChild(btn);
  });
}

function renderPlayersList() {
  const list = document.getElementById("players-list");
  list.innerHTML = "";
  if (!state.currentLeagueId || state.competitors.length === 0) {
    list.innerHTML = "<p class=\"muted\">Nessun giocatore in gara.</p>";
    return;
  }
  const sorted = [...state.competitors].sort((a, b) => b.points - a.points);
  sorted.forEach((player) => {
    const item = document.createElement("div");
    item.className = "list-item";
    item.innerHTML = `
      <div>
        <strong>${player.display}</strong>
        <div class="muted">${player.history.length} round registrati</div>
      </div>
      <div class="points ${player.points >= 0 ? "points-bonus" : "points-malus"}">${formatPoints(player.points)}</div>
    `;
    list.appendChild(item);
  });
}

function renderTeamsList() {
  const list = document.getElementById("teams-list");
  list.innerHTML = "";
  if (!state.currentLeagueId || state.teams.length === 0) {
    list.innerHTML = "<p class=\"muted\">Nessuna squadra registrata.</p>";
    return;
  }
  const sorted = [...state.teams].sort((a, b) => b.points - a.points);
  sorted.forEach((team) => {
    const playerNames = team.picks.map((id) => {
      const player = state.competitors.find((p) => p.userId === id);
      return player ? player.display : "(giocatore rimosso)";
    });
    const item = document.createElement("div");
    item.className = "list-item";
    item.innerHTML = `
      <div>
        <strong>${team.teamName}</strong>
        <div class="muted">${team.managerName}</div>
        <div class="muted">${playerNames.join(" · ")}</div>
      </div>
      <div class="points ${team.points >= 0 ? "points-bonus" : "points-malus"}">${formatPoints(team.points)}</div>
    `;
    list.appendChild(item);
  });
}

function renderAdminRules() {
  const list = document.getElementById("admin-rules");
  list.innerHTML = "";
  RULES.forEach((rule) => {
    const label = document.createElement("label");
    label.className = "checkbox";
    label.innerHTML = `
      <input type="checkbox" name="rule" value="${rule.id}" />
      <span>${rule.label} (${formatPoints(rule.points)})</span>
    `;
    list.appendChild(label);
  });
}

function renderMetaList() {
  const list = document.getElementById("meta-list");
  list.innerHTML = "";
  META_BEYS.forEach((meta) => {
    const label = document.createElement("label");
    label.className = "checkbox";
    label.innerHTML = `
      <input type="checkbox" name="meta" value="${meta.id}" />
      <span>${meta.label} (${formatPoints(meta.points)})</span>
    `;
    list.appendChild(label);
  });
}

function renderAdminPlayers() {
  const select = document.getElementById("admin-player-select");
  select.innerHTML = "";
  if (!state.currentLeagueId || state.competitors.length === 0) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "Nessun giocatore";
    select.appendChild(option);
    updateRoundOptions(null);
    return;
  }
  state.competitors.forEach((player) => {
    const option = document.createElement("option");
    option.value = player.userId;
    option.textContent = player.display;
    select.appendChild(option);
  });
  updateRoundOptions(select.value);
}

function renderAdminArea() {
  const adminArea = document.getElementById("admin-area");
  const note = document.getElementById("admin-lock-note");
  if (state.adminUnlocked && state.currentLeagueId) {
    adminArea.removeAttribute("aria-hidden");
    adminArea.style.opacity = 1;
    adminArea.style.pointerEvents = "auto";
    note.textContent = "Admin attivo.";
  } else if (state.adminUnlocked && !state.currentLeagueId) {
    adminArea.setAttribute("aria-hidden", "true");
    adminArea.style.opacity = 0.4;
    adminArea.style.pointerEvents = "none";
    note.textContent = "Seleziona un torneo per usare i punteggi.";
  } else {
    adminArea.setAttribute("aria-hidden", "true");
    adminArea.style.opacity = 0.4;
    adminArea.style.pointerEvents = "none";
    note.textContent = "Admin bloccato.";
  }
}

function renderTournamentsList() {
  const list = document.getElementById("tournaments-list");
  const note = document.getElementById("league-delete-note");
  list.innerHTML = "";
  note.textContent = "";
  if (state.leagues.length === 0) {
    list.innerHTML = "<p class=\"muted\">Nessun torneo creato.</p>";
    return;
  }
  state.leagues.forEach((league) => {
    const item = document.createElement("div");
    item.className = "list-item";
    const started = league.startedAt ? "Iniziato" : "Aperto";
    item.innerHTML = `
      <div>
        <strong>${league.name}</strong>
        <div class="muted">${league.id} · ${started}</div>
      </div>
      <div class="admin-actions">
        <button class="btn btn-ghost" data-start="${league.id}">${league.startedAt ? "Riapri" : "Inizia"}</button>
        <button class="btn btn-ghost" data-delete="${league.id}">Elimina</button>
      </div>
    `;
    list.appendChild(item);
  });
  list.querySelectorAll("button[data-delete]").forEach((btn) => {
    btn.addEventListener("click", () => handleDeleteLeague(btn.dataset.delete));
  });
  list.querySelectorAll("button[data-start]").forEach((btn) => {
    btn.addEventListener("click", () => handleToggleTournament(btn.dataset.start));
  });
}

async function fetchLeagues() {
  const leaguesSnap = await getDocs(query(collection(db, "leagues"), orderBy("createdAt", "desc")));
  state.leagues = leaguesSnap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
}

async function loadLeagueData() {
  if (!state.currentLeagueId) {
    state.competitors = [];
    state.teams = [];
    return;
  }
  const leagueRef = doc(db, "leagues", state.currentLeagueId);
  const competitorsSnap = await getDocs(collection(leagueRef, "competitors"));
  state.competitors = competitorsSnap.docs.map((docSnap) => docSnap.data());
  const teamsSnap = await getDocs(collection(leagueRef, "teams"));
  const rawTeams = teamsSnap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
  const byManager = new Map();
  rawTeams.forEach((team) => {
    const key = team.managerId || team.id;
    const existing = byManager.get(key);
    const existingTs = existing?.createdAt?.seconds || 0;
    const teamTs = team?.createdAt?.seconds || 0;
    if (!existing || teamTs >= existingTs) {
      byManager.set(key, team);
    }
  });
  state.teams = Array.from(byManager.values());
}

function updateRoundOptions(playerId) {
  const roundSelect = document.querySelector("select[name='round']");
  if (!roundSelect) return;
  const used = new Set();
  const player = state.competitors.find((p) => p.userId === playerId);
  if (player) {
    player.history.forEach((entry) => {
      if (entry.round) used.add(entry.round);
    });
  }
  Array.from(roundSelect.options).forEach((option) => {
    const value = Number(option.value);
    option.disabled = used.has(value);
  });
  const firstAvailable = Array.from(roundSelect.options).find((opt) => !opt.disabled);
  if (firstAvailable) roundSelect.value = firstAvailable.value;
}

function isRoundUsed(playerId, round) {
  const player = state.competitors.find((p) => p.userId === playerId);
  if (!player) return false;
  return player.history.some((entry) => entry.round === round);
}

function calculateTeamPoints(picks) {
  return picks.reduce((sum, id) => {
    const player = state.competitors.find((p) => p.userId === id);
    return sum + (player ? player.points : 0);
  }, 0);
}

async function recalcTeams() {
  if (!state.currentLeagueId) return;
  const leagueRef = doc(db, "leagues", state.currentLeagueId);
  const updates = state.teams.map(async (team) => {
    const points = calculateTeamPoints(team.picks);
    team.points = points;
    await updateDoc(doc(leagueRef, "teams", team.id), { points });
  });
  await Promise.all(updates);
}

async function applyScore({ playerId, rules, meta, fullMetaWin, note, outcome, round }) {
  if (!state.currentLeagueId) return;
  const leagueRef = doc(db, "leagues", state.currentLeagueId);
  const playerRef = doc(leagueRef, "competitors", playerId);
  const snap = await getDoc(playerRef);
  if (!snap.exists()) return;
  const player = snap.data();

  let points = 0;
  if (outcome === "win") points += 3;
  if (outcome === "loss") points -= 3;

  rules.forEach((id) => {
    const rule = RULES.find((r) => r.id === id);
    if (rule) points += rule.points;
  });
  const metaCount = meta.length;
  meta.forEach((id) => {
    const rule = META_BEYS.find((m) => m.id === id);
    if (rule) points += rule.points;
  });
  if (metaCount === 2) points -= 5;
  if (metaCount >= 3) points -= 8;
  if (fullMetaWin) points -= 3;

  const history = player.history || [];
  history.push({
    id: `h_${Date.now()}`,
    rules,
    meta,
    fullMetaWin,
    points,
    note,
    outcome,
    round,
    at: new Date().toISOString()
  });

  const newPoints = (player.points || 0) + points;
  await updateDoc(playerRef, {
    points: newPoints,
    history
  });

  const local = state.competitors.find((p) => p.userId === playerId);
  if (local) {
    local.points = newPoints;
    local.history = history;
  }
  await recalcTeams();
}

async function handleRegister(event) {
  event.preventDefault();
  const note = document.getElementById("register-note");
  const form = event.currentTarget;
  const displayName = form.displayName.value.trim();
  const email = form.email.value.trim();
  const password = form.password.value.trim();
  if (!displayName || !email || !password) return;
  try {
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(credential.user, { displayName });
    await setDoc(doc(db, "users", credential.user.uid), {
      displayName,
      email,
      createdAt: serverTimestamp()
    });
    form.reset();
    note.textContent = "Registrazione completata.";
  } catch (error) {
    note.textContent = "Errore registrazione. Controlla email e password.";
  }
}

async function handleLogin(event) {
  event.preventDefault();
  const note = document.getElementById("login-note");
  const form = event.currentTarget;
  const email = form.email.value.trim();
  const password = form.password.value.trim();
  if (!email || !password) return;
  try {
    await signInWithEmailAndPassword(auth, email, password);
    form.reset();
    note.textContent = "Login effettuato.";
  } catch (error) {
    note.textContent = "Credenziali errate.";
  }
}

async function handleLeagueCreate(event) {
  event.preventDefault();
  const note = document.getElementById("league-create-note");
  const form = event.currentTarget;
  const name = form.leagueName.value.trim();
  if (!state.adminUnlocked) {
    note.textContent = "Admin bloccato.";
    return;
  }
  if (!name) return;
  const docRef = await addDoc(collection(db, "leagues"), {
    name,
    createdAt: serverTimestamp(),
    createdBy: state.currentUser ? state.currentUser.uid : null
  });
  state.currentLeagueId = docRef.id;
  saveUiState();
  form.reset();
  note.textContent = "Torneo creato.";
  await fetchLeagues();
  await loadLeagueData();
  refreshAll();
}

async function handleLeagueSelect() {
  const select = document.getElementById("league-select");
  state.currentLeagueId = select.value || null;
  saveUiState();
  await loadLeagueData();
  refreshAll();
}

async function handleCompetitor(event) {
  event.preventDefault();
  const note = document.getElementById("competitor-note");
  if (!state.currentUser) {
    note.textContent = "Devi accedere per candidarti.";
    return;
  }
  const tournamentSelect = document.getElementById("competitor-league-select");
  const tournamentId = tournamentSelect?.value || state.currentLeagueId;
  if (!tournamentId) {
    note.textContent = "Seleziona un torneo.";
    return;
  }
  const nick = event.currentTarget.playerNick.value.trim();
  const displayBase = state.currentUser.displayName || state.currentUser.email;
  const display = nick ? `${displayBase} (${nick})` : displayBase;

  const leagueRef = doc(db, "leagues", tournamentId);
  const competitorRef = doc(leagueRef, "competitors", state.currentUser.uid);
  const snap = await getDoc(competitorRef);
  const current = snap.exists() ? snap.data() : null;

  await setDoc(competitorRef, {
    userId: state.currentUser.uid,
    display,
    points: current ? current.points : 0,
    history: current ? current.history : []
  });
  note.textContent = "Registrazione completata.";
  event.currentTarget.reset();
  if (state.currentLeagueId === tournamentId) {
    await loadLeagueData();
  }
  refreshAll();
}

async function handleTeamCreate(event) {
  event.preventDefault();
  const note = document.getElementById("team-picker-note");
  const submitBtn = event.currentTarget.querySelector("button[type='submit']");
  if (submitBtn?.dataset.submitting === "true") return;
  if (submitBtn) submitBtn.dataset.submitting = "true";
  if (!state.currentUser) {
    note.textContent = "Devi accedere per creare una squadra.";
    if (submitBtn) submitBtn.dataset.submitting = "false";
    return;
  }
  if (!state.currentLeagueId) {
    note.textContent = "Seleziona un torneo.";
    if (submitBtn) submitBtn.dataset.submitting = "false";
    return;
  }
  const league = state.leagues.find((l) => l.id === state.currentLeagueId);
  if (league?.startedAt) {
    note.textContent = "Torneo iniziato: non puoi creare nuove squadre.";
    if (submitBtn) submitBtn.dataset.submitting = "false";
    return;
  }
  const existing = state.teams.some((team) => team.managerId === state.currentUser.uid);
  if (existing) {
    note.textContent = "Hai già registrato una squadra per questo torneo.";
    if (submitBtn) submitBtn.dataset.submitting = "false";
    return;
  }
  const teamName = event.currentTarget.teamName.value.trim();
  if (!teamName) {
    if (submitBtn) submitBtn.dataset.submitting = "false";
    return;
  }
  const selected = Array.from(document.querySelectorAll(".pick.selected")).map((btn) => btn.dataset.playerId);
  if (selected.length !== 3) {
    note.textContent = "Devi selezionare esattamente 3 giocatori.";
    if (submitBtn) submitBtn.dataset.submitting = "false";
    return;
  }

  const leagueRef = doc(db, "leagues", state.currentLeagueId);
  try {
    await addDoc(collection(leagueRef, "teams"), {
      teamName,
      managerId: state.currentUser.uid,
      managerName: state.currentUser.displayName || state.currentUser.email,
      picks: selected,
      points: calculateTeamPoints(selected),
      createdAt: serverTimestamp()
    });

    event.currentTarget.reset();
    document.querySelectorAll(".pick.selected").forEach((btn) => btn.classList.remove("selected"));
    note.textContent = "Squadra registrata.";
    await loadLeagueData();
    refreshAll();
  } finally {
    if (submitBtn) submitBtn.dataset.submitting = "false";
  }
}

async function handleScore(event) {
  event.preventDefault();
  if (!state.adminUnlocked || !state.currentLeagueId) return;
  const form = event.currentTarget;
  const rules = Array.from(form.querySelectorAll("input[name='rule']:checked")).map((input) => input.value);
  const meta = Array.from(form.querySelectorAll("input[name='meta']:checked")).map((input) => input.value);
  const fullMetaWin = form.fullMetaWin.checked;
  const note = form.note.value.trim();
  const playerId = form.playerId.value;
  const round = Number(form.round.value || 1);
  const outcome = form.outcome.value;
  if (isRoundUsed(playerId, round)) {
    alert("Questo round è già stato registrato per il giocatore.");
    return;
  }
  await applyScore({ playerId, rules, meta, fullMetaWin, note, outcome, round });
  await loadLeagueData();
  renderPlayersList();
  renderTeamsList();
  renderAdminPlayers();
  form.reset();
}

async function handleResetScores() {
  if (!state.adminUnlocked || !state.currentLeagueId) return;
  const confirmed = confirm("Vuoi azzerare TUTTI i punteggi e gli storici del torneo?");
  if (!confirmed) return;
  const leagueRef = doc(db, "leagues", state.currentLeagueId);
  const competitorsSnap = await getDocs(collection(leagueRef, "competitors"));
  const updates = competitorsSnap.docs.map((docSnap) => updateDoc(docSnap.ref, { points: 0, history: [] }));
  await Promise.all(updates);
  await loadLeagueData();
  await recalcTeams();
  refreshAll();
}

async function handleToggleTournament(leagueId) {
  const note = document.getElementById("league-delete-note");
  if (!state.adminUnlocked) {
    note.textContent = "Admin bloccato.";
    return;
  }
  if (!leagueId) {
    note.textContent = "Seleziona un torneo.";
    return;
  }
  const league = state.leagues.find((l) => l.id === leagueId);
  const leagueRef = doc(db, "leagues", leagueId);
  if (league?.startedAt) {
    const confirmed = confirm("Riaprire il torneo? Sarà di nuovo possibile creare squadre.");
    if (!confirmed) return;
    await updateDoc(leagueRef, { startedAt: null });
  } else {
    const confirmed = confirm("Iniziare il torneo? Non sarà più possibile creare squadre.");
    if (!confirmed) return;
    await updateDoc(leagueRef, { startedAt: serverTimestamp() });
  }
  await fetchLeagues();
  await loadLeagueData();
  refreshAll();
}

async function handleDeleteLeague(leagueId) {
  const note = document.getElementById("league-delete-note");
  if (!state.adminUnlocked) {
    note.textContent = "Admin bloccato.";
    return;
  }
  if (!leagueId) {
    note.textContent = "Seleziona un torneo.";
    return;
  }
  const confirmed = confirm("Eliminare il torneo? Verranno cancellati squadre e giocatori.");
  if (!confirmed) return;

  const leagueRef = doc(db, "leagues", leagueId);
  const competitorsSnap = await getDocs(collection(leagueRef, "competitors"));
  const teamsSnap = await getDocs(collection(leagueRef, "teams"));
  const deletes = [];
  competitorsSnap.docs.forEach((docSnap) => deletes.push(deleteDoc(docSnap.ref)));
  teamsSnap.docs.forEach((docSnap) => deletes.push(deleteDoc(docSnap.ref)));
  await Promise.all(deletes);
  await deleteDoc(leagueRef);

  if (state.currentLeagueId === leagueId) {
    state.currentLeagueId = null;
  }
  saveUiState();
  await fetchLeagues();
  await loadLeagueData();
  refreshAll();
  note.textContent = "Torneo eliminato.";
}

function setupTabs() {
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => showView(tab.dataset.view));
  });
  showView("regole");
}

function setupEvents() {
  document.getElementById("register-form").addEventListener("submit", handleRegister);
  document.getElementById("login-form").addEventListener("submit", handleLogin);
  document.getElementById("league-form").addEventListener("submit", handleLeagueCreate);
  document.getElementById("league-set").addEventListener("click", handleLeagueSelect);
  document.getElementById("competitor-form").addEventListener("submit", handleCompetitor);
  document.getElementById("team-form").addEventListener("submit", handleTeamCreate);
  document.getElementById("score-form").addEventListener("submit", handleScore);
  document.getElementById("reset-scores").addEventListener("click", handleResetScores);

  const adminPlayerSelect = document.getElementById("admin-player-select");
  adminPlayerSelect.addEventListener("change", (event) => updateRoundOptions(event.target.value));

  const adminUnlockButton = document.getElementById("admin-unlock");
  adminUnlockButton.addEventListener("click", () => {
    const codeInput = document.getElementById("admin-code");
    const note = document.getElementById("admin-lock-note");
    if (codeInput.value.trim() === ADMIN_CODE) {
      state.adminUnlocked = true;
      note.textContent = "Admin sbloccato.";
    } else {
      state.adminUnlocked = false;
      note.textContent = "Password admin errata.";
    }
    renderAdminArea();
  });
}

function refreshAll() {
  renderAccount();
  renderLeagueSelect();
  renderCompetitorLeagueSelect();
  renderCompetitorPicker();
  renderPlayersList();
  renderTeamsList();
  renderAdminPlayers();
  renderAdminArea();
  renderTournamentsList();
}

async function init() {
  loadUiState();
  renderRules();
  renderAdminRules();
  renderMetaList();
  setupTabs();
  setupEvents();

  onAuthStateChanged(auth, async (user) => {
    state.currentUser = user;
    await fetchLeagues();
    await loadLeagueData();
    refreshAll();
  });
}

init();
