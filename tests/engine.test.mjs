import test from "node:test";
import assert from "node:assert/strict";
import {
  BOARD_SIZE,
  calculateMoveScore,
  canAnyPieceFit,
  canPlace,
  clearCompletedLines,
  createEmptyBoard,
  createSeededRandom,
  findCompletedLines,
  findPlacements,
  generateTray,
  getShape,
  placePiece,
  resolvePlacement
} from "../src/engine.js";

function piece(shapeId, palette = "cyan") {
  const shape = getShape(shapeId);
  return { shapeId, palette, cells: shape.cells, label: shape.label };
}

test("an empty board is an independent 8 by 8 matrix", () => {
  const board = createEmptyBoard();
  assert.equal(board.length, BOARD_SIZE);
  assert.ok(board.every((row) => row.length === BOARD_SIZE && row.every((cell) => cell === null)));
  board[0][0] = "cyan";
  assert.equal(board[1][0], null);
});

test("piece placement respects boundaries, collisions, and immutability", () => {
  const board = createEmptyBoard();
  const square = piece("square-2", "violet");
  assert.equal(canPlace(board, square, 6, 6), true);
  assert.equal(canPlace(board, square, 7, 7), false);

  const placed = placePiece(board, square, 2, 3);
  assert.equal(board[2][3], null);
  assert.equal(placed[2][3], "violet");
  assert.equal(placed[3][4], "violet");
  assert.equal(canPlace(placed, square, 2, 3), false);
});

test("completed rows and columns are detected and cleared simultaneously", () => {
  const board = createEmptyBoard();
  for (let col = 0; col < BOARD_SIZE; col += 1) board[3][col] = "cyan";
  for (let row = 0; row < BOARD_SIZE; row += 1) board[row][5] = "violet";

  const completed = findCompletedLines(board);
  assert.deepEqual(completed.rows, [3]);
  assert.deepEqual(completed.cols, [5]);
  assert.equal(completed.cells.length, 15, "the row/column intersection is counted once");

  const cleared = clearCompletedLines(board, completed);
  assert.ok(cleared[3].every((cell) => cell === null));
  assert.ok(cleared.every((row) => row[5] === null));
});

test("resolving a move awards placement, line, and combo points", () => {
  const board = createEmptyBoard();
  for (let col = 0; col < 7; col += 1) board[0][col] = "gold";
  const result = resolvePlacement(board, piece("spark", "coral"), 0, 7, 1);

  assert.deepEqual(result.completed.rows, [0]);
  assert.equal(result.score.placementPoints, 10);
  assert.equal(result.score.lineBonus, 240);
  assert.equal(result.score.total, 250);
  assert.equal(result.score.nextCombo, 2);
  assert.ok(result.boardAfterClear[0].every((cell) => cell === null));
});

test("a move without a line resets the combo", () => {
  assert.deepEqual(calculateMoveScore(4, 0, 5), {
    placementPoints: 40,
    lineBonus: 0,
    total: 40,
    nextCombo: 0
  });
});

test("generated trays are deterministic with a seed and begin with a playable piece", () => {
  const board = createEmptyBoard();
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      if (!(row === 7 && col === 7)) board[row][col] = "cyan";
    }
  }

  const trayA = generateTray(board, createSeededRandom(42));
  const trayB = generateTray(board, createSeededRandom(42));
  assert.deepEqual(trayA, trayB);
  assert.ok(findPlacements(board, trayA[0], 1).length > 0);
  assert.equal(canAnyPieceFit(board, trayA), true);
});

test("a fully occupied board accepts no piece", () => {
  const board = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill("mint"));
  assert.equal(canAnyPieceFit(board, [piece("spark"), null, null]), false);
});
