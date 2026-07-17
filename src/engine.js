export const BOARD_SIZE = 8;
export const COMBO_GRACE_MOVES = 3;
export const ALL_CLEAR_BONUS = 2_500;

export const PALETTES = ["cyan", "violet", "coral", "gold", "mint"];

export const SHAPES = Object.freeze([
  { id: "spark", label: "éclat unique", weight: 2, cells: [[0, 0]] },
  { id: "duo-h", label: "duo horizontal", weight: 5, cells: [[0, 0], [0, 1]] },
  { id: "duo-v", label: "duo vertical", weight: 5, cells: [[0, 0], [1, 0]] },
  { id: "trio-h", label: "trio horizontal", weight: 6, cells: [[0, 0], [0, 1], [0, 2]] },
  { id: "trio-v", label: "trio vertical", weight: 6, cells: [[0, 0], [1, 0], [2, 0]] },
  { id: "quartet-h", label: "ligne de quatre horizontale", weight: 3, cells: [[0, 0], [0, 1], [0, 2], [0, 3]] },
  { id: "quartet-v", label: "ligne de quatre verticale", weight: 3, cells: [[0, 0], [1, 0], [2, 0], [3, 0]] },
  { id: "quintet-h", label: "ligne de cinq horizontale", weight: 1.4, cells: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4]] },
  { id: "quintet-v", label: "ligne de cinq verticale", weight: 1.4, cells: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]] },
  { id: "square-2", label: "carré de quatre", weight: 5, cells: [[0, 0], [0, 1], [1, 0], [1, 1]] },
  { id: "square-3", label: "grand carré de neuf", weight: 0.85, cells: [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2], [2, 0], [2, 1], [2, 2]] },
  { id: "corner-br", label: "angle vers la droite", weight: 4.2, cells: [[0, 0], [1, 0], [1, 1]] },
  { id: "corner-bl", label: "angle vers la gauche", weight: 4.2, cells: [[0, 1], [1, 0], [1, 1]] },
  { id: "corner-tr", label: "angle haut droit", weight: 4.2, cells: [[0, 0], [0, 1], [1, 0]] },
  { id: "corner-tl", label: "angle haut gauche", weight: 4.2, cells: [[0, 0], [0, 1], [1, 1]] },
  { id: "l-five-br", label: "grand angle vers la droite", weight: 2.1, cells: [[0, 0], [1, 0], [2, 0], [2, 1], [2, 2]] },
  { id: "l-five-bl", label: "grand angle vers la gauche", weight: 2.1, cells: [[0, 2], [1, 2], [2, 0], [2, 1], [2, 2]] },
  { id: "l-five-tr", label: "grand angle haut droit", weight: 2.1, cells: [[0, 0], [0, 1], [0, 2], [1, 0], [2, 0]] },
  { id: "l-five-tl", label: "grand angle haut gauche", weight: 2.1, cells: [[0, 0], [0, 1], [0, 2], [1, 2], [2, 2]] },
  { id: "tee-up", label: "té orienté vers le haut", weight: 2.5, cells: [[0, 0], [0, 1], [0, 2], [1, 1]] },
  { id: "tee-down", label: "té orienté vers le bas", weight: 2.5, cells: [[0, 1], [1, 0], [1, 1], [1, 2]] },
  { id: "tee-left", label: "té orienté vers la gauche", weight: 2.5, cells: [[0, 0], [1, 0], [1, 1], [2, 0]] },
  { id: "tee-right", label: "té orienté vers la droite", weight: 2.5, cells: [[0, 1], [1, 0], [1, 1], [2, 1]] },
  { id: "zig-h", label: "zigzag horizontal", weight: 2.5, cells: [[0, 1], [0, 2], [1, 0], [1, 1]] },
  { id: "zag-h", label: "zigzag horizontal inversé", weight: 2.5, cells: [[0, 0], [0, 1], [1, 1], [1, 2]] },
  { id: "zig-v", label: "zigzag vertical", weight: 2.5, cells: [[0, 0], [1, 0], [1, 1], [2, 1]] },
  { id: "zag-v", label: "zigzag vertical inversé", weight: 2.5, cells: [[0, 1], [1, 0], [1, 1], [2, 0]] },
  { id: "plus", label: "croix de cinq", weight: 1.25, cells: [[0, 1], [1, 0], [1, 1], [1, 2], [2, 1]] }
]);

const SHAPE_BY_ID = new Map(SHAPES.map((shape) => [shape.id, shape]));

export function createEmptyBoard() {
  return Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(null));
}

export function cloneBoard(board) {
  return board.map((row) => [...row]);
}

export function getShape(shapeId) {
  return SHAPE_BY_ID.get(shapeId) || null;
}

export function getPieceCells(piece) {
  if (Array.isArray(piece?.cells)) return piece.cells;
  return getShape(piece?.shapeId)?.cells || [];
}

export function getPieceDimensions(piece) {
  const cells = getPieceCells(piece);
  if (!cells.length) return { rows: 0, cols: 0 };

  return {
    rows: Math.max(...cells.map(([row]) => row)) + 1,
    cols: Math.max(...cells.map(([, col]) => col)) + 1
  };
}

export function isValidBoard(board) {
  return (
    Array.isArray(board) &&
    board.length === BOARD_SIZE &&
    board.every((row) => Array.isArray(row) && row.length === BOARD_SIZE)
  );
}

export function canPlace(board, piece, anchorRow, anchorCol) {
  if (!isValidBoard(board) || !Number.isInteger(anchorRow) || !Number.isInteger(anchorCol)) return false;

  const cells = getPieceCells(piece);
  if (!cells.length) return false;

  return cells.every(([rowOffset, colOffset]) => {
    const row = anchorRow + rowOffset;
    const col = anchorCol + colOffset;
    return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE && board[row][col] === null;
  });
}

export function placePiece(board, piece, anchorRow, anchorCol) {
  if (!canPlace(board, piece, anchorRow, anchorCol)) {
    throw new RangeError("Piece cannot be placed at the requested anchor");
  }

  const nextBoard = cloneBoard(board);
  const palette = PALETTES.includes(piece.palette) ? piece.palette : PALETTES[0];

  for (const [rowOffset, colOffset] of getPieceCells(piece)) {
    nextBoard[anchorRow + rowOffset][anchorCol + colOffset] = palette;
  }

  return nextBoard;
}

export function getPlacedCoordinates(piece, anchorRow, anchorCol) {
  return getPieceCells(piece).map(([rowOffset, colOffset]) => [anchorRow + rowOffset, anchorCol + colOffset]);
}

export function findCompletedLines(board) {
  if (!isValidBoard(board)) return { rows: [], cols: [], cells: [] };

  const rows = [];
  const cols = [];

  for (let row = 0; row < BOARD_SIZE; row += 1) {
    if (board[row].every(Boolean)) rows.push(row);
  }

  for (let col = 0; col < BOARD_SIZE; col += 1) {
    if (board.every((row) => Boolean(row[col]))) cols.push(col);
  }

  const uniqueCells = new Map();
  for (const row of rows) {
    for (let col = 0; col < BOARD_SIZE; col += 1) uniqueCells.set(`${row}:${col}`, [row, col]);
  }
  for (const col of cols) {
    for (let row = 0; row < BOARD_SIZE; row += 1) uniqueCells.set(`${row}:${col}`, [row, col]);
  }

  return { rows, cols, cells: [...uniqueCells.values()] };
}

export function clearCompletedLines(board, completedLines = findCompletedLines(board)) {
  const nextBoard = cloneBoard(board);

  for (const [row, col] of completedLines.cells) nextBoard[row][col] = null;

  return nextBoard;
}

export function findPlacements(board, piece, limit = Number.POSITIVE_INFINITY) {
  const placements = [];

  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      if (canPlace(board, piece, row, col)) {
        placements.push({ row, col });
        if (placements.length >= limit) return placements;
      }
    }
  }

  return placements;
}

export function canAnyPieceFit(board, tray) {
  return tray.filter(Boolean).some((piece) => findPlacements(board, piece, 1).length > 0);
}

export function countOccupied(board) {
  return board.reduce((total, row) => total + row.filter(Boolean).length, 0);
}

function weightedChoice(candidates, random) {
  if (!candidates.length) return null;
  const total = candidates.reduce((sum, candidate) => sum + candidate.adjustedWeight, 0);
  let cursor = random() * total;

  for (const candidate of candidates) {
    cursor -= candidate.adjustedWeight;
    if (cursor <= 0) return candidate.shape;
  }

  return candidates[candidates.length - 1].shape;
}

function createPiece(shape, palette, random, slot) {
  return {
    id: `${shape.id}-${slot}-${Math.floor(random() * 1_000_000).toString(36)}`,
    shapeId: shape.id,
    label: shape.label,
    palette,
    cells: shape.cells.map((cell) => [...cell])
  };
}

export function generateTray(board, random = Math.random, count = 3) {
  const occupancy = countOccupied(board) / (BOARD_SIZE * BOARD_SIZE);
  const fittingShapes = SHAPES.filter((shape) => findPlacements(board, shape, 1).length > 0);
  const tray = [];
  const selectedIds = [];

  for (let slot = 0; slot < count; slot += 1) {
    const mustFit = slot === 0 && fittingShapes.length > 0;
    const pool = mustFit ? fittingShapes : SHAPES;
    const candidates = pool.map((shape) => {
      const size = shape.cells.length;
      const crowdedPenalty = occupancy > 0.62 && size >= 5 ? 0.52 : 1;
      const repeatPenalty = selectedIds.includes(shape.id) ? 0.22 : 1;
      const tinyPenalty = occupancy < 0.24 && size <= 1 ? 0.42 : 1;
      return { shape, adjustedWeight: shape.weight * crowdedPenalty * repeatPenalty * tinyPenalty };
    });
    const shape = weightedChoice(candidates, random) || SHAPES[0];
    const paletteOffset = Math.floor(random() * PALETTES.length);
    const palette = PALETTES[(paletteOffset + slot) % PALETTES.length];
    tray.push(createPiece(shape, palette, random, slot));
    selectedIds.push(shape.id);
  }

  return tray;
}

export function getComboMultiplier(combo) {
  return Math.min(12, 1 + Math.max(0, combo - 1) * 0.5);
}

export function calculateMoveScore(
  pieceCellCount,
  lineCount,
  previousCombo = 0,
  previousComboGrace = 0,
  { allClear = false } = {}
) {
  const placementPoints = 0;

  if (lineCount === 0) {
    const nextComboGrace = previousCombo > 0 ? Math.max(0, previousComboGrace - 1) : 0;
    const nextCombo = nextComboGrace > 0 ? previousCombo : 0;
    return {
      placementPoints,
      baseClearPoints: 0,
      lineBonus: 0,
      allClearBonus: 0,
      multiplier: getComboMultiplier(nextCombo),
      total: 0,
      nextCombo,
      nextComboGrace
    };
  }

  const comboContinues = previousCombo > 0 && previousComboGrace > 0;
  const nextCombo = (comboContinues ? previousCombo : 0) + lineCount;
  const nextComboGrace = COMBO_GRACE_MOVES;
  const baseClearPoints = 100 * ((lineCount * (lineCount + 1)) / 2);
  const multiplier = getComboMultiplier(nextCombo);
  const lineBonus = Math.round(baseClearPoints * multiplier);
  const allClearBonus = allClear ? ALL_CLEAR_BONUS : 0;

  return {
    placementPoints,
    baseClearPoints,
    lineBonus,
    allClearBonus,
    multiplier,
    total: lineBonus + allClearBonus,
    nextCombo,
    nextComboGrace
  };
}

export function resolvePlacement(
  board,
  piece,
  anchorRow,
  anchorCol,
  previousCombo = 0,
  previousComboGrace = 0
) {
  const boardAfterPlacement = placePiece(board, piece, anchorRow, anchorCol);
  const completed = findCompletedLines(boardAfterPlacement);
  const boardAfterClear = clearCompletedLines(boardAfterPlacement, completed);
  const lineCount = completed.rows.length + completed.cols.length;
  const isAllClear = lineCount > 0 && countOccupied(boardAfterClear) === 0;
  const score = calculateMoveScore(
    getPieceCells(piece).length,
    lineCount,
    previousCombo,
    previousComboGrace,
    { allClear: isAllClear }
  );

  return {
    boardAfterPlacement,
    boardAfterClear,
    completed,
    score,
    isAllClear,
    placedCells: getPlacedCoordinates(piece, anchorRow, anchorCol)
  };
}

export function createSeededRandom(seed = 1) {
  let value = Math.max(1, Math.floor(seed)) % 2_147_483_647;
  return () => {
    value = (value * 16_807) % 2_147_483_647;
    return (value - 1) / 2_147_483_646;
  };
}
