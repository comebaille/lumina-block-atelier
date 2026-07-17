import {
  BOARD_SIZE,
  PALETTES,
  canAnyPieceFit,
  canPlace,
  createEmptyBoard,
  findPlacements,
  generateTray,
  getPieceCells,
  getPieceDimensions,
  getPlacedCoordinates,
  getShape,
  isValidBoard,
  resolvePlacement
} from "./engine.js";
import { CrystalAudio } from "./audio.js";

const STORAGE_KEYS = {
  save: "lumina-save-v1",
  settings: "lumina-settings-v1",
  best: "lumina-best-v1",
  daily: "lumina-daily-v1"
};

const DAILY_TARGET = 16;
const DAILY_REWARD = 300;
const numberFormatter = new Intl.NumberFormat("fr-FR");
const audio = new CrystalAudio();

const dom = {
  app: document.querySelector("#app"),
  board: document.querySelector("#board"),
  pieceRack: document.querySelector("#pieceRack"),
  score: document.querySelector("#scoreValue"),
  bestScore: document.querySelector("#bestScore"),
  lines: document.querySelector("#linesValue"),
  comboBadge: document.querySelector("#comboBadge"),
  comboCallout: document.querySelector("#comboCallout"),
  scoreBurst: document.querySelector("#scoreBurst"),
  clearBeam: document.querySelector("#clearBeam"),
  trayHint: document.querySelector("#trayHint"),
  dailyCard: document.querySelector(".daily-card"),
  dailyProgressText: document.querySelector("#dailyProgressText"),
  dailyProgressBar: document.querySelector("#dailyProgressBar"),
  dailyReward: document.querySelector("#dailyReward"),
  saveStatus: document.querySelector("#saveStatus"),
  soundButton: document.querySelector("#soundButton"),
  settingsButton: document.querySelector("#settingsButton"),
  pauseButton: document.querySelector("#pauseButton"),
  installButton: document.querySelector("#installButton"),
  settingsInstallButton: document.querySelector("#settingsInstallButton"),
  dragLayer: document.querySelector("#dragLayer"),
  particleLayer: document.querySelector("#particleLayer"),
  liveRegion: document.querySelector("#liveRegion"),
  welcomeDialog: document.querySelector("#welcomeDialog"),
  settingsDialog: document.querySelector("#settingsDialog"),
  pauseDialog: document.querySelector("#pauseDialog"),
  gameOverDialog: document.querySelector("#gameOverDialog"),
  confirmDialog: document.querySelector("#confirmDialog"),
  startButton: document.querySelector("#startButton"),
  freshStartButton: document.querySelector("#freshStartButton"),
  resumeButton: document.querySelector("#resumeButton"),
  pauseNewButton: document.querySelector("#pauseNewButton"),
  restartButton: document.querySelector("#restartButton"),
  resetButton: document.querySelector("#resetButton"),
  cancelResetButton: document.querySelector("#cancelResetButton"),
  confirmResetButton: document.querySelector("#confirmResetButton"),
  soundToggle: document.querySelector("#soundToggle"),
  hapticToggle: document.querySelector("#hapticToggle"),
  motionToggle: document.querySelector("#motionToggle"),
  contrastToggle: document.querySelector("#contrastToggle"),
  pauseScore: document.querySelector("#pauseScore"),
  finalScore: document.querySelector("#finalScore"),
  finalSummary: document.querySelector("#finalSummary")
};

const DEFAULT_SETTINGS = {
  sound: true,
  haptic: true,
  reducedMotion: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false,
  highContrast: false
};

let deferredInstallPrompt = null;
let selectedPieceIndex = null;
let boardFocusIndex = 0;
let isLocked = false;
let hintTimer = null;
let suppressClickUntil = 0;
let lastInputWasKeyboard = false;
let dialogReturnFocus = new WeakMap();
let dragState = null;
let activeGhost = null;
let previewCells = [];

const storedSettings = readJson(STORAGE_KEYS.settings, {});
const settings = { ...DEFAULT_SETTINGS, ...storedSettings };
const daily = loadDaily();
const savedState = loadSavedState();
let state = savedState || createFreshState();

initialize();

function initialize() {
  applySettings();
  renderAll();
  wireEvents();
  registerServiceWorker();

  if (savedState) {
    dom.startButton.querySelector("span").textContent = "Reprendre la partie";
    dom.freshStartButton.hidden = false;
  }

  queueMicrotask(() => openDialog(dom.welcomeDialog, null));
}

function createFreshState() {
  const board = createEmptyBoard();
  return {
    board,
    tray: generateTray(board),
    score: 0,
    lines: 0,
    combo: 0,
    moves: 0,
    best: readNumber(STORAGE_KEYS.best),
    started: false,
    gameOver: false,
    dailyDate: daily.date,
    dailyLines: daily.lines,
    dailyClaimed: daily.claimed
  };
}

function loadSavedState() {
  const raw = readJson(STORAGE_KEYS.save, null);
  if (!raw || !isValidBoard(raw.board) || !Array.isArray(raw.tray) || raw.tray.length !== 3) return null;

  const tray = raw.tray.map((piece) => {
    if (piece === null) return null;
    const shape = getShape(piece.shapeId);
    if (!shape || !PALETTES.includes(piece.palette)) return null;
    return {
      id: typeof piece.id === "string" ? piece.id : `${shape.id}-restored`,
      shapeId: shape.id,
      label: shape.label,
      palette: piece.palette,
      cells: shape.cells.map((cell) => [...cell])
    };
  });

  const normalizedTray = tray.every((piece) => piece === null) ? generateTray(raw.board) : tray;
  return {
    board: raw.board.map((row) => row.map((cell) => (PALETTES.includes(cell) ? cell : null))),
    tray: normalizedTray,
    score: asNonNegativeInteger(raw.score),
    lines: asNonNegativeInteger(raw.lines),
    combo: asNonNegativeInteger(raw.combo),
    moves: asNonNegativeInteger(raw.moves),
    best: Math.max(readNumber(STORAGE_KEYS.best), asNonNegativeInteger(raw.best)),
    started: false,
    gameOver: false,
    dailyDate: daily.date,
    dailyLines: daily.lines,
    dailyClaimed: daily.claimed
  };
}

function localDateKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function loadDaily() {
  const today = localDateKey();
  const stored = readJson(STORAGE_KEYS.daily, null);
  if (!stored || stored.date !== today) return { date: today, lines: 0, claimed: false };
  return {
    date: today,
    lines: asNonNegativeInteger(stored.lines),
    claimed: Boolean(stored.claimed)
  };
}

function readJson(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function readNumber(key) {
  try {
    return asNonNegativeInteger(Number(localStorage.getItem(key)) || 0);
  } catch {
    return 0;
  }
}

function asNonNegativeInteger(value) {
  return Number.isFinite(Number(value)) ? Math.max(0, Math.floor(Number(value))) : 0;
}

function writeStorage(key, value) {
  try {
    localStorage.setItem(key, typeof value === "string" ? value : JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function saveGame() {
  const savePayload = {
    version: 1,
    board: state.board,
    tray: state.tray,
    score: state.score,
    lines: state.lines,
    combo: state.combo,
    moves: state.moves,
    best: state.best
  };

  const success = writeStorage(STORAGE_KEYS.save, savePayload);
  writeStorage(STORAGE_KEYS.best, String(state.best));
  writeStorage(STORAGE_KEYS.settings, settings);
  writeStorage(STORAGE_KEYS.daily, {
    date: state.dailyDate,
    lines: state.dailyLines,
    claimed: state.dailyClaimed
  });

  dom.saveStatus.innerHTML = success
    ? '<i aria-hidden="true"></i> Progression sauvegardée'
    : '<i aria-hidden="true"></i> Sauvegarde indisponible';
}

function removeCurrentSave() {
  try {
    localStorage.removeItem(STORAGE_KEYS.save);
  } catch {
    // The game remains playable when private storage is unavailable.
  }
}

function renderAll() {
  renderBoard();
  renderRack();
  renderStats(false);
  renderDaily();
  updateSoundButton();
}

function renderBoard({ newCells = [], clearingCells = [] } = {}) {
  const newKeys = new Set(newCells.map(([row, col]) => `${row}:${col}`));
  const clearingKeys = new Set(clearingCells.map(([row, col]) => `${row}:${col}`));
  const selectedPiece = selectedPieceIndex === null ? null : state.tray[selectedPieceIndex];

  dom.board.replaceChildren();
  dom.board.setAttribute("aria-busy", String(isLocked));

  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      const index = row * BOARD_SIZE + col;
      const palette = state.board[row][col];
      const button = document.createElement("button");
      const key = `${row}:${col}`;
      const validAnchor = selectedPiece ? canPlace(state.board, selectedPiece, row, col) : false;

      button.type = "button";
      button.className = "board-cell";
      button.dataset.row = String(row);
      button.dataset.col = String(col);
      button.dataset.index = String(index);
      button.dataset.validAnchor = String(validAnchor);
      button.tabIndex = index === boardFocusIndex ? 0 : -1;

      if (palette) button.classList.add("is-filled", `palette-${palette}`);
      if (newKeys.has(key)) button.classList.add("is-new");
      if (clearingKeys.has(key)) button.classList.add("is-clearing");

      button.setAttribute("aria-label", getCellLabel(row, col, palette, validAnchor, Boolean(selectedPiece)));
      dom.board.append(button);
    }
  }
}

function getCellLabel(row, col, palette, validAnchor, hasSelection) {
  const position = `Ligne ${row + 1}, colonne ${col + 1}`;
  if (!hasSelection) return palette ? `${position}, cristal occupé` : `${position}, case vide`;
  if (validAnchor) return `${position}, poser la pièce ici`;
  return palette ? `${position}, occupée, placement impossible` : `${position}, placement impossible`;
}

function renderRack() {
  dom.pieceRack.replaceChildren();

  state.tray.forEach((piece, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "piece-card";
    button.dataset.pieceIndex = String(index);
    button.setAttribute("aria-pressed", String(selectedPieceIndex === index));

    if (!piece) {
      button.classList.add("is-used");
      button.disabled = true;
      button.setAttribute("aria-label", `Emplacement ${index + 1}, pièce déjà placée`);
    } else {
      button.setAttribute(
        "aria-label",
        `${piece.label}, ${getPieceCells(piece).length} cristaux. Sélectionner puis choisir une case, ou faire glisser.`
      );
      button.append(createPieceGrid(piece, "piece"));
    }

    dom.pieceRack.append(button);
  });
}

function createPieceGrid(piece, kind = "piece") {
  const dimensions = getPieceDimensions(piece);
  const grid = document.createElement("span");
  grid.className = kind === "drag" ? "drag-piece" : "piece-grid";
  grid.style.setProperty("--piece-cols", dimensions.cols);
  grid.style.setProperty("--piece-rows", dimensions.rows);

  if (kind !== "drag") {
    const longestSide = Math.max(dimensions.rows, dimensions.cols);
    const previewSize = longestSide >= 5 ? 8.5 : longestSide === 4 ? 10.5 : longestSide === 3 ? 14 : 17;
    grid.style.setProperty("--piece-cell", `${previewSize}px`);
    grid.style.gap = longestSide >= 4 ? "2px" : "3px";
  }

  for (const [row, col] of getPieceCells(piece)) {
    const cell = document.createElement("i");
    cell.className = `${kind === "drag" ? "drag-mini-cell" : "piece-mini-cell"} palette-${piece.palette}`;
    cell.style.setProperty("--cell-x", col + 1);
    cell.style.setProperty("--cell-y", row + 1);
    grid.append(cell);
  }

  return grid;
}

function updateRackSelection() {
  for (const card of dom.pieceRack.querySelectorAll(".piece-card")) {
    const index = Number(card.dataset.pieceIndex);
    card.setAttribute("aria-pressed", String(selectedPieceIndex === index));
  }
}

function updateBoardAnchors() {
  const piece = selectedPieceIndex === null ? null : state.tray[selectedPieceIndex];
  for (const cell of dom.board.querySelectorAll(".board-cell")) {
    const row = Number(cell.dataset.row);
    const col = Number(cell.dataset.col);
    const palette = state.board[row][col];
    const valid = piece ? canPlace(state.board, piece, row, col) : false;
    cell.dataset.validAnchor = String(valid);
    cell.setAttribute("aria-label", getCellLabel(row, col, palette, valid, Boolean(piece)));
  }
}

function renderStats(animate = true) {
  dom.score.textContent = numberFormatter.format(state.score);
  dom.bestScore.textContent = numberFormatter.format(state.best);
  dom.lines.textContent = numberFormatter.format(state.lines);
  dom.comboBadge.textContent = `COMBO ×${Math.max(2, state.combo)}`;
  dom.comboBadge.classList.toggle("is-visible", state.combo >= 2);

  if (animate && !settings.reducedMotion) {
    dom.score.classList.remove("is-bumping");
    requestAnimationFrame(() => dom.score.classList.add("is-bumping"));
    window.setTimeout(() => dom.score.classList.remove("is-bumping"), 260);
  }
}

function renderDaily() {
  const shownLines = Math.min(state.dailyLines, DAILY_TARGET);
  const progress = (shownLines / DAILY_TARGET) * 100;
  dom.dailyProgressText.textContent = `${shownLines} / ${DAILY_TARGET}`;
  dom.dailyProgressBar.style.width = `${progress}%`;
  dom.dailyReward.textContent = state.dailyClaimed ? "RÉUSSI" : `+${DAILY_REWARD}`;
  dom.dailyCard.classList.toggle("is-complete", state.dailyClaimed);
  dom.dailyCard.setAttribute(
    "aria-label",
    state.dailyClaimed
      ? "Éclat du jour réussi, récompense obtenue"
      : `Éclat du jour, ${shownLines} lignes sur ${DAILY_TARGET}, récompense ${DAILY_REWARD} points`
  );
}

function selectPiece(index, { announceSelection = true, playSound = true } = {}) {
  if (isLocked || !state.started || !state.tray[index]) return;
  clearHint();
  selectedPieceIndex = index;
  updateRackSelection();
  updateBoardAnchors();
  dom.trayHint.textContent = "Fragment sélectionné · choisissez une case";
  if (playSound) audio.select();
  if (announceSelection) announce(`${state.tray[index].label} sélectionné. Choisissez une case sur la grille.`);
  scheduleHint();
}

async function commitPlacement(index, row, col) {
  const piece = state.tray[index];
  if (isLocked || !state.started || !piece) return false;

  if (!canPlace(state.board, piece, row, col)) {
    invalidPlacement(piece, row, col);
    return false;
  }

  isLocked = true;
  clearHint();
  clearPreview();
  const previousDaily = state.dailyLines;
  const resolution = resolvePlacement(state.board, piece, row, col, state.combo);
  const lineCount = resolution.completed.rows.length + resolution.completed.cols.length;

  state.board = resolution.boardAfterPlacement;
  state.tray[index] = null;
  state.score += resolution.score.total;
  state.combo = resolution.score.nextCombo;
  state.moves += 1;
  state.lines += lineCount;
  state.dailyLines += lineCount;
  state.best = Math.max(state.best, state.score);
  selectedPieceIndex = null;

  renderBoard({ newCells: resolution.placedCells, clearingCells: resolution.completed.cells });
  renderRack();
  renderStats();
  renderDaily();
  showScoreBurst(resolution.score.total);
  audio.place(getPieceCells(piece).length);
  haptic(lineCount ? [12, 28, 18] : 12);

  if (lineCount > 0) {
    window.setTimeout(() => audio.clear(lineCount, state.combo), 60);
    triggerClearEffects(resolution.completed.cells, lineCount, state.combo);
    announce(
      `${lineCount} ${lineCount > 1 ? "lignes effacées" : "ligne effacée"}. ${resolution.score.total} points. ${
        state.combo >= 2 ? `Combo ${state.combo}.` : ""
      }`
    );
    await wait(settings.reducedMotion ? 20 : 390);
    state.board = resolution.boardAfterClear;
    renderBoard();
  } else {
    announce(`${getPieceCells(piece).length * 10} points.`);
  }

  if (previousDaily < DAILY_TARGET && state.dailyLines >= DAILY_TARGET && !state.dailyClaimed) {
    state.dailyClaimed = true;
    state.score += DAILY_REWARD;
    state.best = Math.max(state.best, state.score);
    renderStats();
    renderDaily();
    showScoreBurst(DAILY_REWARD, "ÉCLAT DU JOUR");
    burstParticles(window.innerWidth / 2, Math.max(110, window.innerHeight * 0.18), 24);
    announce(`Éclat du jour réussi. Bonus de ${DAILY_REWARD} points.`);
  }

  if (state.tray.every((trayPiece) => trayPiece === null)) {
    await wait(settings.reducedMotion ? 10 : 110);
    state.tray = generateTray(state.board);
    renderRack();
  }

  saveGame();
  isLocked = false;
  dom.board.setAttribute("aria-busy", "false");

  if (!canAnyPieceFit(state.board, state.tray)) {
    window.setTimeout(showGameOver, settings.reducedMotion ? 40 : 360);
  } else {
    scheduleHint();
  }

  return true;
}

function invalidPlacement(piece, row, col) {
  audio.invalid();
  haptic(22);
  announce("Ce fragment ne tient pas à cet endroit.");
  const coordinates = getPlacedCoordinates(piece, row, col);
  for (const [cellRow, cellCol] of coordinates) {
    const cell = dom.board.querySelector(`[data-row="${cellRow}"][data-col="${cellCol}"]`);
    if (cell) cell.classList.add("is-invalid-shake");
  }
  window.setTimeout(() => {
    for (const cell of dom.board.querySelectorAll(".is-invalid-shake")) cell.classList.remove("is-invalid-shake");
  }, 340);
}

function triggerClearEffects(cells, lineCount, combo) {
  dom.clearBeam.classList.remove("is-active");
  requestAnimationFrame(() => dom.clearBeam.classList.add("is-active"));
  window.setTimeout(() => dom.clearBeam.classList.remove("is-active"), 470);

  const boardRect = dom.board.getBoundingClientRect();
  burstParticles(boardRect.left + boardRect.width / 2, boardRect.top + boardRect.height / 2, Math.min(30, 12 + cells.length));

  if (combo >= 2 || lineCount >= 2) {
    dom.comboCallout.querySelector("span").textContent = lineCount >= 2 ? "DOUBLE RÉSONANCE" : "PRISME PARFAIT";
    dom.comboCallout.querySelector("strong").textContent = combo >= 2 ? `COMBO ×${combo}` : `${lineCount} LIGNES`;
    dom.comboCallout.classList.remove("is-active");
    requestAnimationFrame(() => dom.comboCallout.classList.add("is-active"));
    window.setTimeout(() => dom.comboCallout.classList.remove("is-active"), 1_150);
  }
}

function showScoreBurst(points, label = "") {
  dom.scoreBurst.textContent = label ? `${label} · +${numberFormatter.format(points)}` : `+${numberFormatter.format(points)}`;
  dom.scoreBurst.classList.remove("is-active");
  requestAnimationFrame(() => dom.scoreBurst.classList.add("is-active"));
  window.setTimeout(() => dom.scoreBurst.classList.remove("is-active"), 820);
}

function burstParticles(x, y, count = 18) {
  if (settings.reducedMotion) return;
  const colors = ["#75efff", "#d49bff", "#ff9fb8", "#ffe19b", "#8bf4d7"];

  for (let index = 0; index < count; index += 1) {
    const particle = document.createElement("i");
    const angle = (Math.PI * 2 * index) / count + Math.random() * 0.34;
    const distance = 42 + Math.random() * 100;
    particle.className = "particle";
    particle.style.left = `${x}px`;
    particle.style.top = `${y}px`;
    particle.style.setProperty("--dx", `${Math.cos(angle) * distance}px`);
    particle.style.setProperty("--dy", `${Math.sin(angle) * distance}px`);
    particle.style.setProperty("--spin", `${Math.round(Math.random() * 420 - 210)}deg`);
    particle.style.setProperty("--size", `${3 + Math.random() * 5}px`);
    particle.style.setProperty("--particle-color", colors[index % colors.length]);
    particle.style.animationDelay = `${Math.random() * 80}ms`;
    dom.particleLayer.append(particle);
    particle.addEventListener("animationend", () => particle.remove(), { once: true });
  }
}

function createGhost(piece) {
  removeGhost();
  const firstCell = dom.board.querySelector(".board-cell");
  if (!firstCell) return null;
  const cellRect = firstCell.getBoundingClientRect();
  const boardStyle = getComputedStyle(dom.board);
  const gap = Number.parseFloat(boardStyle.columnGap) || 3;
  const ghost = document.createElement("div");
  ghost.className = "drag-ghost";
  ghost.style.setProperty("--ghost-cell", `${cellRect.width}px`);
  ghost.style.setProperty("--ghost-gap", `${gap}px`);
  ghost.append(createPieceGrid(piece, "drag"));
  dom.dragLayer.append(ghost);
  activeGhost = ghost;
  return ghost;
}

function updateDrag(clientX, clientY) {
  if (!dragState?.active) return;
  const piece = state.tray[dragState.index];
  if (!piece || !activeGhost) return;

  const lift = Math.min(92, window.innerHeight * 0.115);
  const ghostX = clientX;
  const ghostY = clientY - lift;
  activeGhost.style.left = `${ghostX}px`;
  activeGhost.style.top = `${ghostY}px`;

  const firstCell = dom.board.querySelector(".board-cell");
  if (!firstCell) return;
  const firstRect = firstCell.getBoundingClientRect();
  const boardStyle = getComputedStyle(dom.board);
  const stepX = firstRect.width + (Number.parseFloat(boardStyle.columnGap) || 0);
  const stepY = firstRect.height + (Number.parseFloat(boardStyle.rowGap) || 0);
  const dimensions = getPieceDimensions(piece);
  const col = Math.round((ghostX - (firstRect.left + firstRect.width / 2)) / stepX - (dimensions.cols - 1) / 2);
  const row = Math.round((ghostY - (firstRect.top + firstRect.height / 2)) / stepY - (dimensions.rows - 1) / 2);
  const valid = canPlace(state.board, piece, row, col);

  dragState.anchor = { row, col, valid };
  activeGhost.classList.toggle("is-invalid", !valid);
  setPreview(piece, row, col, valid);
}

function setPreview(piece, row, col, valid) {
  clearPreview();
  previewCells = getPlacedCoordinates(piece, row, col);
  for (const [cellRow, cellCol] of previewCells) {
    const cell = dom.board.querySelector(`[data-row="${cellRow}"][data-col="${cellCol}"]`);
    if (cell) cell.classList.add(valid ? "is-preview-valid" : "is-preview-invalid");
  }
}

function clearPreview() {
  previewCells = [];
  for (const cell of dom.board.querySelectorAll(".is-preview-valid, .is-preview-invalid")) {
    cell.classList.remove("is-preview-valid", "is-preview-invalid");
  }
}

function removeGhost() {
  activeGhost?.remove();
  activeGhost = null;
}

function onPiecePointerDown(event) {
  const card = event.target.closest(".piece-card:not(:disabled)");
  if (!card || isLocked || !state.started) return;
  clearHint();
  dragState = {
    pointerId: event.pointerId,
    index: Number(card.dataset.pieceIndex),
    startX: event.clientX,
    startY: event.clientY,
    active: false,
    anchor: null
  };
}

function onPointerMove(event) {
  if (!dragState || event.pointerId !== dragState.pointerId) return;
  const distance = Math.hypot(event.clientX - dragState.startX, event.clientY - dragState.startY);

  if (!dragState.active && distance > 7) {
    dragState.active = true;
    selectPiece(dragState.index, { announceSelection: false, playSound: true });
    createGhost(state.tray[dragState.index]);
  }

  if (dragState.active) {
    event.preventDefault();
    updateDrag(event.clientX, event.clientY);
  }
}

async function onPointerUp(event) {
  if (!dragState || event.pointerId !== dragState.pointerId) return;
  const finishedDrag = dragState;
  dragState = null;

  if (finishedDrag.active) {
    suppressClickUntil = performance.now() + 380;
    const anchor = finishedDrag.anchor;
    clearPreview();
    removeGhost();
    if (anchor?.valid) {
      await commitPlacement(finishedDrag.index, anchor.row, anchor.col);
    } else {
      const piece = state.tray[finishedDrag.index];
      if (piece && anchor) invalidPlacement(piece, anchor.row, anchor.col);
    }
  }
}

function onPointerCancel(event) {
  if (!dragState || event.pointerId !== dragState.pointerId) return;
  dragState = null;
  clearPreview();
  removeGhost();
}

function onPieceRackClick(event) {
  if (performance.now() < suppressClickUntil) return;
  const card = event.target.closest(".piece-card:not(:disabled)");
  if (!card) return;
  audio.unlock().catch(() => {});
  selectPiece(Number(card.dataset.pieceIndex));
}

function onBoardClick(event) {
  const cell = event.target.closest(".board-cell");
  if (!cell || selectedPieceIndex === null || isLocked) return;
  clearHint();
  commitPlacement(selectedPieceIndex, Number(cell.dataset.row), Number(cell.dataset.col));
}

function onBoardPointerOver(event) {
  if (dragState?.active || selectedPieceIndex === null || event.pointerType === "touch") return;
  const cell = event.target.closest(".board-cell");
  const piece = state.tray[selectedPieceIndex];
  if (!cell || !piece) return;
  const row = Number(cell.dataset.row);
  const col = Number(cell.dataset.col);
  setPreview(piece, row, col, canPlace(state.board, piece, row, col));
}

function onBoardKeyDown(event) {
  const cell = event.target.closest(".board-cell");
  if (!cell) return;
  const index = Number(cell.dataset.index);
  const row = Math.floor(index / BOARD_SIZE);
  const col = index % BOARD_SIZE;
  const moves = {
    ArrowUp: [Math.max(0, row - 1), col],
    ArrowDown: [Math.min(BOARD_SIZE - 1, row + 1), col],
    ArrowLeft: [row, Math.max(0, col - 1)],
    ArrowRight: [row, Math.min(BOARD_SIZE - 1, col + 1)]
  };

  if (moves[event.key]) {
    event.preventDefault();
    const [nextRow, nextCol] = moves[event.key];
    boardFocusIndex = nextRow * BOARD_SIZE + nextCol;
    const nextCell = dom.board.querySelector(`[data-index="${boardFocusIndex}"]`);
    for (const boardCell of dom.board.querySelectorAll(".board-cell")) boardCell.tabIndex = -1;
    if (nextCell) {
      nextCell.tabIndex = 0;
      nextCell.focus();
      if (selectedPieceIndex !== null) {
        const piece = state.tray[selectedPieceIndex];
        setPreview(piece, nextRow, nextCol, canPlace(state.board, piece, nextRow, nextCol));
      }
    }
  }
}

function showHint() {
  if (isLocked || !state.started || document.querySelector("dialog[open]")) return;
  let pieceIndex = selectedPieceIndex;

  if (pieceIndex === null || !state.tray[pieceIndex] || !findPlacements(state.board, state.tray[pieceIndex], 1).length) {
    pieceIndex = state.tray.findIndex((piece) => piece && findPlacements(state.board, piece, 1).length);
  }

  if (pieceIndex < 0) return;
  const piece = state.tray[pieceIndex];
  const placement = findPlacements(state.board, piece, 1)[0];
  const card = dom.pieceRack.querySelector(`[data-piece-index="${pieceIndex}"]`);
  card?.classList.add("is-suggested");

  for (const [row, col] of getPlacedCoordinates(piece, placement.row, placement.col)) {
    dom.board.querySelector(`[data-row="${row}"][data-col="${col}"]`)?.classList.add("is-hint");
  }

  dom.trayHint.textContent = "Une résonance possible scintille sur la grille";
}

function scheduleHint() {
  clearTimeout(hintTimer);
  if (!state.started || state.gameOver) return;
  hintTimer = window.setTimeout(showHint, 5_500);
}

function clearHint() {
  clearTimeout(hintTimer);
  for (const cell of dom.board.querySelectorAll(".is-hint")) cell.classList.remove("is-hint");
  for (const card of dom.pieceRack.querySelectorAll(".is-suggested")) card.classList.remove("is-suggested");
  if (state.started) dom.trayHint.textContent = selectedPieceIndex === null ? "Touchez ou faites glisser une pièce" : "Fragment sélectionné · choisissez une case";
}

function newGame({ keepDialog = false } = {}) {
  const best = Math.max(state.best, state.score);
  const board = createEmptyBoard();
  state = {
    board,
    tray: generateTray(board),
    score: 0,
    lines: 0,
    combo: 0,
    moves: 0,
    best,
    started: true,
    gameOver: false,
    dailyDate: localDateKey(),
    dailyLines: state.dailyDate === localDateKey() ? state.dailyLines : 0,
    dailyClaimed: state.dailyDate === localDateKey() ? state.dailyClaimed : false
  };
  selectedPieceIndex = null;
  isLocked = false;
  removeCurrentSave();
  renderAll();
  saveGame();
  announce("Nouvelle partie.");
  if (!keepDialog) closeOpenDialogs();
  scheduleHint();
}

function showGameOver() {
  if (state.gameOver || canAnyPieceFit(state.board, state.tray)) return;
  state.gameOver = true;
  clearHint();
  selectedPieceIndex = null;
  state.best = Math.max(state.best, state.score);
  writeStorage(STORAGE_KEYS.best, String(state.best));
  writeStorage(STORAGE_KEYS.daily, {
    date: state.dailyDate,
    lines: state.dailyLines,
    claimed: state.dailyClaimed
  });
  removeCurrentSave();
  dom.finalScore.textContent = numberFormatter.format(state.score);
  dom.finalSummary.textContent = `${state.lines} ${state.lines > 1 ? "lignes illuminées" : "ligne illuminée"}`;
  audio.gameOver();
  haptic([28, 55, 32]);
  openDialog(dom.gameOverDialog, null);
  announce(`Partie terminée. Score final ${state.score}.`);
}

function applySettings() {
  document.body.classList.toggle("is-reduced-motion", settings.reducedMotion);
  document.body.classList.toggle("is-high-contrast", settings.highContrast);
  dom.soundToggle.checked = settings.sound;
  dom.hapticToggle.checked = settings.haptic;
  dom.motionToggle.checked = settings.reducedMotion;
  dom.contrastToggle.checked = settings.highContrast;
  audio.setEnabled(settings.sound);
  updateSoundButton();
}

function updateSoundButton() {
  dom.soundButton.setAttribute("aria-pressed", String(settings.sound));
  dom.soundButton.setAttribute("aria-label", settings.sound ? "Couper le son" : "Activer le son");
}

function updateSetting(key, value) {
  settings[key] = Boolean(value);
  applySettings();
  saveGame();
  if (key === "sound" && value) audio.unlock().then(() => audio.ui()).catch(() => {});
}

function haptic(pattern) {
  if (!settings.haptic || typeof navigator.vibrate !== "function") return;
  navigator.vibrate(pattern);
}

function announce(message) {
  dom.liveRegion.textContent = "";
  window.setTimeout(() => {
    dom.liveRegion.textContent = message;
  }, 20);
}

function openDialog(dialog, opener = document.activeElement) {
  if (!dialog || dialog.open) return;
  if (opener instanceof HTMLElement) dialogReturnFocus.set(dialog, opener);
  dialog.showModal();
}

function closeDialog(dialog, { restoreFocus = true } = {}) {
  if (!dialog?.open) return;
  dialog.close();
  if (restoreFocus) {
    const returnTarget = dialogReturnFocus.get(dialog);
    if (returnTarget?.isConnected && !returnTarget.closest("[inert]")) returnTarget.focus();
  }
}

function closeOpenDialogs() {
  for (const dialog of document.querySelectorAll("dialog[open]")) closeDialog(dialog, { restoreFocus: false });
}

function startGame({ fresh = false } = {}) {
  audio.unlock().catch(() => {
    // Audio is an enhancement; game start must never depend on autoplay policy.
  });
  if (fresh) newGame({ keepDialog: true });
  state.started = true;
  state.gameOver = false;
  closeDialog(dom.welcomeDialog, { restoreFocus: false });
  saveGame();
  announce(fresh ? "Nouvelle partie." : "Partie commencée.");
  scheduleHint();
  if (lastInputWasKeyboard) {
    dom.pieceRack.querySelector(".piece-card:not(:disabled)")?.focus({ preventScroll: true });
  }
}

async function requestInstall() {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  const choice = await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  dom.installButton.hidden = true;
  dom.settingsInstallButton.hidden = true;
  announce(choice.outcome === "accepted" ? "Installation lancée." : "Installation annulée.");
}

function wireEvents() {
  document.addEventListener("keydown", () => {
    lastInputWasKeyboard = true;
  }, true);
  document.addEventListener("pointerdown", () => {
    lastInputWasKeyboard = false;
  }, true);

  dom.pieceRack.addEventListener("pointerdown", onPiecePointerDown);
  dom.pieceRack.addEventListener("click", onPieceRackClick);
  window.addEventListener("pointermove", onPointerMove, { passive: false });
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("pointercancel", onPointerCancel);

  dom.board.addEventListener("click", onBoardClick);
  dom.board.addEventListener("pointerover", onBoardPointerOver);
  dom.board.addEventListener("pointerleave", () => {
    if (!dragState?.active) clearPreview();
  });
  dom.board.addEventListener("keydown", onBoardKeyDown);

  dom.startButton.addEventListener("click", () => startGame());
  dom.freshStartButton.addEventListener("click", () => startGame({ fresh: true }));

  dom.soundButton.addEventListener("click", () => {
    updateSetting("sound", !settings.sound);
    if (!settings.sound) announce("Son coupé.");
  });

  dom.settingsButton.addEventListener("click", () => {
    audio.ui();
    openDialog(dom.settingsDialog, dom.settingsButton);
  });

  dom.pauseButton.addEventListener("click", () => {
    if (!state.started || state.gameOver) return;
    clearHint();
    dom.pauseScore.textContent = numberFormatter.format(state.score);
    audio.ui();
    openDialog(dom.pauseDialog, dom.pauseButton);
  });

  dom.resumeButton.addEventListener("click", () => {
    closeDialog(dom.pauseDialog, { restoreFocus: false });
    announce("Partie reprise.");
    scheduleHint();
  });

  dom.pauseNewButton.addEventListener("click", () => newGame());
  dom.restartButton.addEventListener("click", () => newGame());

  dom.soundToggle.addEventListener("change", (event) => updateSetting("sound", event.target.checked));
  dom.hapticToggle.addEventListener("change", (event) => updateSetting("haptic", event.target.checked));
  dom.motionToggle.addEventListener("change", (event) => updateSetting("reducedMotion", event.target.checked));
  dom.contrastToggle.addEventListener("change", (event) => updateSetting("highContrast", event.target.checked));

  dom.resetButton.addEventListener("click", () => {
    closeDialog(dom.settingsDialog, { restoreFocus: false });
    openDialog(dom.confirmDialog, dom.settingsButton);
  });

  dom.cancelResetButton.addEventListener("click", () => {
    closeDialog(dom.confirmDialog, { restoreFocus: false });
    openDialog(dom.settingsDialog, dom.settingsButton);
  });

  dom.confirmResetButton.addEventListener("click", () => newGame());

  for (const closeButton of document.querySelectorAll("[data-close-dialog]")) {
    closeButton.addEventListener("click", () => closeDialog(document.getElementById(closeButton.dataset.closeDialog)));
  }

  dom.welcomeDialog.addEventListener("cancel", (event) => event.preventDefault());
  dom.gameOverDialog.addEventListener("cancel", (event) => event.preventDefault());
  dom.pauseDialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeDialog(dom.pauseDialog);
    scheduleHint();
  });

  dom.settingsDialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeDialog(dom.settingsDialog);
  });

  dom.confirmDialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeDialog(dom.confirmDialog, { restoreFocus: false });
    openDialog(dom.settingsDialog, dom.settingsButton);
  });

  dom.installButton.addEventListener("click", requestInstall);
  dom.settingsInstallButton.addEventListener("click", requestInstall);

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    dom.installButton.hidden = false;
    dom.settingsInstallButton.hidden = false;
  });

  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    dom.installButton.hidden = true;
    dom.settingsInstallButton.hidden = true;
    announce("LUMINA est installée.");
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden && state.started && !state.gameOver) saveGame();
  });

  window.addEventListener("resize", () => {
    clearPreview();
    removeGhost();
  });
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator) || location.protocol === "file:") return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {
      // Offline support is optional when the browser blocks service workers.
    });
  });
}

function wait(milliseconds) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

window.__LUMINA_TEST__ = Object.freeze({
  getState: () => JSON.parse(JSON.stringify(state)),
  newGame: () => newGame(),
  selectPiece: (index) => selectPiece(index, { announceSelection: false, playSound: false })
});
