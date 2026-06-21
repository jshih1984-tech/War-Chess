export const WHITE = "white";
export const BLACK = "black";

export const PIECE_IMAGES = {
  white: {
    king: "./assets/pieces/white-king.svg",
    queen: "./assets/pieces/white-queen.svg",
    rook: "./assets/pieces/white-rook.svg",
    bishop: "./assets/pieces/white-bishop.svg?v=silver-cross-1",
    knight: "./assets/pieces/white-knight.svg",
    pawn: "./assets/pieces/white-pawn.svg?v=helmet-1",
    spearman: "./assets/pieces/white-spearman.svg",
    archer: "./assets/pieces/white-archer.svg",
    shield: "./assets/pieces/white-shield.svg",
  },
  black: {
    king: "./assets/pieces/black-king.svg?v=silver-cross-1",
    queen: "./assets/pieces/black-queen.svg?v=silver-cross-1",
    rook: "./assets/pieces/black-rook.svg",
    bishop: "./assets/pieces/black-bishop.svg?v=silver-cross-1",
    knight: "./assets/pieces/black-knight.svg",
    pawn: "./assets/pieces/black-pawn.svg?v=helmet-1",
    spearman: "./assets/pieces/black-spearman.svg",
    archer: "./assets/pieces/black-archer.svg",
    shield: "./assets/pieces/black-shield.svg",
  },
};

export const PIECE_VALUES = {
  pawn: 51,
  knight: 154,
  bishop: 154,
  rook: 257,
  queen: 462,
  king: 1000,
  spearman: 90,
  archer: 120,
  shield: 110,
};

const BACK_RANK = ["rook", "knight", "bishop", "queen", "king", "bishop", "knight", "rook"];
const FILES = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l"];
const TEMPLE_PROMOTIONS = ["spearman", "archer", "shield"];

export const BOARD_MODES = {
  classic: {
    id: "classic",
    label: "8x8",
    rows: 8,
    cols: 8,
    setupStartCol: 0,
  },
  wide: {
    id: "wide",
    label: "8x12",
    rows: 8,
    cols: 12,
    setupStartCol: 2,
  },
};

export const TERRAIN_TYPES = {
  village: { label: "村莊" },
  lake: { label: "湖泊" },
  forest: { label: "森林" },
  tower: { label: "塔樓" },
  mountain: { label: "山脈" },
  temple: { label: "聖殿" },
};

export function createInitialGame(modeId = "classic") {
  const mode = BOARD_MODES[modeId] || BOARD_MODES.classic;
  const board = Array.from({ length: mode.rows }, () => Array(mode.cols).fill(null));
  const terrain = Array.from({ length: mode.rows }, () => Array(mode.cols).fill(null));

  for (let col = 0; col < 8; col += 1) {
    const setupCol = mode.setupStartCol + col;
    board[0][setupCol] = piece(BLACK, BACK_RANK[col]);
    board[1][setupCol] = piece(BLACK, "pawn");
    board[mode.rows - 2][setupCol] = piece(WHITE, "pawn");
    board[mode.rows - 1][setupCol] = piece(WHITE, BACK_RANK[col]);
  }

  return {
    mode,
    board,
    terrain,
    turn: WHITE,
    castling: {
      white: { kingSide: true, queenSide: true },
      black: { kingSide: true, queenSide: true },
    },
    enPassant: null,
    halfMoveClock: 0,
    fullMove: 1,
    history: [],
    captured: { white: [], black: [] },
    lastMove: null,
    winner: null,
    draw: false,
  };
}

export function cloneGame(game) {
  return {
    ...game,
    board: cloneBoard(game.board),
    terrain: cloneTerrain(game.terrain, game.board),
    castling: {
      white: { ...game.castling.white },
      black: { ...game.castling.black },
    },
    enPassant: game.enPassant ? { ...game.enPassant } : null,
    history: [...game.history],
    captured: {
      white: [...game.captured.white],
      black: [...game.captured.black],
    },
    lastMove: game.lastMove ? { from: { ...game.lastMove.from }, to: { ...game.lastMove.to } } : null,
  };
}

export function getLegalMoves(game, from) {
  const selected = getPiece(game.board, from);
  if (!selected || selected.color !== game.turn || game.winner || game.draw) return [];
  if (isOpeningRound(game) && selected.type !== "pawn") return [];

  return getPseudoMoves(game, from).filter((move) => {
    const next = applyMove(game, move, { dryRun: true });
    return !isKingInCheck(next, selected.color);
  });
}

export function movePiece(game, from, to, promotion = "queen") {
  const legalMoves = getLegalMoves(game, from);
  const move = legalMoves.find((item) => sameSquare(item.to, to));
  if (!move) return { game, move: null, ok: false };

  const promotedMove = { ...move, promotion };
  const next = applyMove(game, promotedMove);
  const opponent = opposite(next.turn);
  const legalReplies = getAllLegalMoves(next, next.turn);
  const inCheck = isKingInCheck(next, next.turn);

  if (legalReplies.length === 0 && inCheck) {
    next.winner = opponent;
  } else if (legalReplies.length === 0) {
    next.draw = true;
  } else if (next.halfMoveClock >= 100) {
    next.draw = true;
  }

  return { game: next, move: promotedMove, ok: true };
}

export function getGameStatus(game) {
  const inCheck = isKingInCheck(game, game.turn);

  if (game.winner) {
    return {
      state: "checkmate",
      text: `${colorLabel(game.winner)}勝利，將死`,
      inCheck,
    };
  }

  if (game.draw) {
    return { state: "draw", text: "和局", inCheck };
  }

  return {
    state: inCheck ? "check" : "playing",
    text: inCheck ? `${colorLabel(game.turn)}被將軍` : `${colorLabel(game.turn)}行棋`,
    inCheck,
  };
}

export function squareName(square) {
  return `${FILES[square.col] || "?"}${8 - square.row}`;
}

export function notationForMove(move) {
  const pieceLetter = move.piece.type === "pawn" ? "" : move.piece.type[0].toUpperCase();
  const captureMark = move.captured ? "x" : "";
  const suffix = move.promotion && move.piece.type === "pawn"
    ? `=${move.promotion[0].toUpperCase()}`
    : move.templePromotion
      ? `~${move.templePromotion[0].toUpperCase()}`
      : "";

  if (move.castle === "kingSide") return "O-O";
  if (move.castle === "queenSide") return "O-O-O";

  return `${pieceLetter}${squareName(move.from)}${captureMark}${squareName(move.to)}${suffix}`;
}

function piece(color, type) {
  return { color, type, hasMoved: false };
}

function chooseTemplePromotion(dryRun = false) {
  if (dryRun) return TEMPLE_PROMOTIONS[0];
  return TEMPLE_PROMOTIONS[Math.floor(Math.random() * TEMPLE_PROMOTIONS.length)];
}

function cloneBoard(board) {
  return board.map((row) => row.map((item) => (item ? { ...item } : null)));
}

function cloneTerrain(terrain, board) {
  const source = terrain || Array.from({ length: rowCount(board) }, () => Array(colCount(board)).fill(null));
  return source.map((row) => [...row]);
}

function getAllLegalMoves(game, color) {
  const originalTurn = game.turn;
  const probe = { ...game, turn: color };
  const moves = [];

  for (let row = 0; row < rowCount(probe.board); row += 1) {
    for (let col = 0; col < colCount(probe.board); col += 1) {
      const current = probe.board[row][col];
      if (current?.color === color) {
        moves.push(...getLegalMoves({ ...probe, turn: color }, { row, col }));
      }
    }
  }

  probe.turn = originalTurn;
  return moves;
}

function getPseudoMoves(game, from) {
  const current = getPiece(game.board, from);
  if (!current) return [];

  if (current.type === "pawn") return pawnMoves(game, from, current);
  if (current.type === "spearman") return spearmanMoves(game, from, current);
  if (current.type === "archer") return archerMoves(game, from, current);
  if (current.type === "shield") return shieldMoves(game, from, current);
  if (current.type === "knight") return knightMoves(game, from, current);
  if (current.type === "bishop") return slidingMoves(game, from, current, [[1, 1], [1, -1], [-1, 1], [-1, -1]]);
  if (current.type === "rook") return slidingMoves(game, from, current, [[1, 0], [-1, 0], [0, 1], [0, -1]]);
  if (current.type === "queen") {
    return slidingMoves(game, from, current, [
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]);
  }
  return kingMoves(game, from, current);
}

function pawnMoves(game, from, current) {
  const direction = current.color === WHITE ? -1 : 1;
  const startRow = current.color === WHITE ? rowCount(game.board) - 2 : 1;
  const promotionRow = current.color === WHITE ? 0 : rowCount(game.board) - 1;
  const moves = [];
  const one = { row: from.row + direction, col: from.col };

  if (inside(game.board, one) && canEnterTerrain(game, one, current) && !getPiece(game.board, one)) {
    moves.push(createMove(game, from, one, { promotion: one.row === promotionRow ? "queen" : null }));
    const two = { row: from.row + direction * 2, col: from.col };
    if (from.row === startRow && isOpeningRound(game) && inside(game.board, two) && canEnterTerrain(game, two, current) && !getPiece(game.board, two)) {
      moves.push(createMove(game, from, two, { doublePawn: true }));
    }
  }

  for (const colOffset of [-1, 1]) {
    const target = { row: from.row + direction, col: from.col + colOffset };
    if (!inside(game.board, target)) continue;

    const targetPiece = getPiece(game.board, target);
    if (canEnterTerrain(game, target, current) && isCapturable(game, target, targetPiece, current)) {
      moves.push(createMove(game, from, target, { promotion: target.row === promotionRow ? "queen" : null }));
    }

    if (game.enPassant && sameSquare(game.enPassant, target) && canEnterTerrain(game, target, current)) {
      moves.push(createMove(game, from, target, { enPassant: true }));
    }
  }

  return moves;
}

function spearmanMoves(game, from, current) {
  const direction = current.color === WHITE ? -1 : 1;
  const moves = [];
  const stepTargets = [
    { row: from.row + direction, col: from.col },
    { row: from.row, col: from.col - 1 },
    { row: from.row, col: from.col + 1 },
  ];
  const attackTargets = [
    { row: from.row + direction, col: from.col },
    { row: from.row + direction, col: from.col - 1 },
    { row: from.row + direction, col: from.col + 1 },
  ];

  stepTargets.forEach((target) => {
    if (inside(game.board, target) && canEnterTerrain(game, target, current) && !getPiece(game.board, target)) {
      moves.push(createMove(game, from, target));
    }
  });

  attackTargets.forEach((target) => {
    const targetPiece = getPiece(game.board, target);
    if (canEnterTerrain(game, target, current) && isCapturable(game, target, targetPiece, current)) {
      moves.push(createMove(game, from, target));
    }
  });

  return moves;
}

function archerMoves(game, from, current) {
  const direction = current.color === WHITE ? -1 : 1;
  const moves = [];
  const stepTargets = [
    { row: from.row + direction, col: from.col },
    { row: from.row, col: from.col - 1 },
    { row: from.row, col: from.col + 1 },
  ];
  const shotTargets = [
    { row: from.row - 2, col: from.col },
    { row: from.row + 2, col: from.col },
    { row: from.row, col: from.col - 2 },
    { row: from.row, col: from.col + 2 },
    { row: from.row - 1, col: from.col - 1 },
    { row: from.row - 1, col: from.col + 1 },
    { row: from.row + 1, col: from.col - 1 },
    { row: from.row + 1, col: from.col + 1 },
  ];

  stepTargets.forEach((target) => {
    if (inside(game.board, target) && canEnterTerrain(game, target, current) && !getPiece(game.board, target)) {
      moves.push(createMove(game, from, target));
    }
  });

  shotTargets.forEach((target) => {
    const targetPiece = getPiece(game.board, target);
    if (isCapturable(game, target, targetPiece, current)) {
      moves.push(createMove(game, from, target, { shoot: true }));
    }
  });

  return moves;
}

function knightMoves(game, from, current) {
  const moves = [];
  const jumps = [[2, 1], [2, -1], [-2, 1], [-2, -1], [1, 2], [1, -2], [-1, 2], [-1, -2]];

  for (const [rowOffset, colOffset] of jumps) {
    const target = { row: from.row + rowOffset, col: from.col + colOffset };
    if (canOccupy(game, target, current)) moves.push(createMove(game, from, target));
  }

  return moves;
}

function shieldMoves(game, from, current) {
  const direction = current.color === WHITE ? -1 : 1;
  const moves = [];
  const stepTargets = [
    { row: from.row + direction, col: from.col },
    { row: from.row, col: from.col - 1 },
    { row: from.row, col: from.col + 1 },
  ];
  const attackTargets = [
    { row: from.row + direction, col: from.col - 1 },
    { row: from.row + direction, col: from.col + 1 },
  ];

  stepTargets.forEach((target) => {
    if (inside(game.board, target) && canEnterTerrain(game, target, current) && !getPiece(game.board, target)) {
      moves.push(createMove(game, from, target));
    }
  });

  attackTargets.forEach((target) => {
    const targetPiece = getPiece(game.board, target);
    if (canEnterTerrain(game, target, current) && isCapturable(game, target, targetPiece, current)) {
      moves.push(createMove(game, from, target));
    }
  });

  return moves;
}

function slidingMoves(game, from, current, directions) {
  const moves = [];

  for (const [rowStep, colStep] of directions) {
    let target = { row: from.row + rowStep, col: from.col + colStep };
    while (inside(game.board, target)) {
      const targetPiece = getPiece(game.board, target);
      if (!targetPiece) {
        if (!canEnterTerrain(game, target, current)) break;
        moves.push(createMove(game, from, target));
      } else {
        if (canEnterTerrain(game, target, current) && isCapturable(game, target, targetPiece, current)) moves.push(createMove(game, from, target));
        break;
      }
      target = { row: target.row + rowStep, col: target.col + colStep };
    }
  }

  return moves;
}

function limitedSlidingMoves(game, from, current, directions, maxSteps) {
  const moves = [];

  for (const [rowStep, colStep] of directions) {
    let target = { row: from.row + rowStep, col: from.col + colStep };
    let steps = 1;
    while (steps <= maxSteps && inside(game.board, target)) {
      const targetPiece = getPiece(game.board, target);
      if (!targetPiece) {
        if (!canEnterTerrain(game, target, current)) break;
        moves.push(createMove(game, from, target));
      } else {
        if (canEnterTerrain(game, target, current) && isCapturable(game, target, targetPiece, current)) moves.push(createMove(game, from, target));
        break;
      }
      target = { row: target.row + rowStep, col: target.col + colStep };
      steps += 1;
    }
  }

  return moves;
}

function kingMoves(game, from, current) {
  const moves = [];

  for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
    for (let colOffset = -1; colOffset <= 1; colOffset += 1) {
      if (rowOffset === 0 && colOffset === 0) continue;
      const target = { row: from.row + rowOffset, col: from.col + colOffset };
      if (canOccupy(game, target, current)) moves.push(createMove(game, from, target));
    }
  }

  moves.push(...castleMoves(game, from, current));
  return moves;
}

function castleMoves(game, from, current) {
  const layout = boardLayout(game);
  const homeRow = current.color === WHITE ? rowCount(game.board) - 1 : 0;
  if (from.row !== homeRow || from.col !== layout.kingCol || isKingInCheck(game, current.color)) return [];

  const rights = game.castling[current.color];
  const moves = [];

  if (
    rights.kingSide &&
    clearBetween(game.board, homeRow, layout.kingCol, layout.kingRookCol) &&
    !isSquareAttacked(game, { row: homeRow, col: layout.kingCol + 1 }, opposite(current.color)) &&
    !isSquareAttacked(game, { row: homeRow, col: layout.kingTargetCol }, opposite(current.color))
  ) {
    moves.push(createMove(game, from, { row: homeRow, col: layout.kingTargetCol }, { castle: "kingSide" }));
  }

  if (
    rights.queenSide &&
    clearBetween(game.board, homeRow, layout.queenRookCol, layout.kingCol) &&
    !isSquareAttacked(game, { row: homeRow, col: layout.kingCol - 1 }, opposite(current.color)) &&
    !isSquareAttacked(game, { row: homeRow, col: layout.queenTargetCol }, opposite(current.color))
  ) {
    moves.push(createMove(game, from, { row: homeRow, col: layout.queenTargetCol }, { castle: "queenSide" }));
  }

  return moves;
}

function applyMove(game, move, options = {}) {
  const next = cloneGame(game);
  const movingPiece = getPiece(next.board, move.from);
  const targetPiece = getPiece(next.board, move.to);
  const captured = move.enPassant
    ? getPiece(next.board, { row: move.from.row, col: move.to.col })
    : targetPiece;

  if (move.shoot) {
    next.board[move.from.row][move.from.col] = { ...movingPiece, hasMoved: true };
    next.board[move.to.row][move.to.col] = null;
  } else {
    next.board[move.from.row][move.from.col] = null;
    next.board[move.to.row][move.to.col] = { ...movingPiece, hasMoved: true };
  }
  const templePromotion = movingPiece.type === "pawn" && getTerrain(next, move.to) === "temple"
    ? chooseTemplePromotion(options.dryRun)
    : null;

  if (move.enPassant) {
    next.board[move.from.row][move.to.col] = null;
  }

  if (move.castle === "kingSide") {
    const row = move.from.row;
    const layout = boardLayout(next);
    next.board[row][layout.kingRookTargetCol] = { ...next.board[row][layout.kingRookCol], hasMoved: true };
    next.board[row][layout.kingRookCol] = null;
  }

  if (move.castle === "queenSide") {
    const row = move.from.row;
    const layout = boardLayout(next);
    next.board[row][layout.queenRookTargetCol] = { ...next.board[row][layout.queenRookCol], hasMoved: true };
    next.board[row][layout.queenRookCol] = null;
  }

  if (!move.shoot && movingPiece.type === "pawn" && (move.to.row === 0 || move.to.row === rowCount(next.board) - 1)) {
    next.board[move.to.row][move.to.col] = {
      color: movingPiece.color,
      type: move.promotion || "queen",
      hasMoved: true,
    };
  } else if (!move.shoot && templePromotion) {
    next.board[move.to.row][move.to.col] = {
      color: movingPiece.color,
      type: templePromotion,
      hasMoved: true,
    };
  }

  updateCastlingRights(next, move, movingPiece, captured);
  next.enPassant = move.doublePawn
    ? { row: (move.from.row + move.to.row) / 2, col: move.from.col }
    : null;

  if (!options.dryRun) {
    const storedMove = {
      ...move,
      piece: { ...movingPiece },
      captured: captured ? { ...captured } : null,
      templePromotion,
    };

    if (captured) next.captured[movingPiece.color].push(captured);
    next.history.push(storedMove);
    next.lastMove = { from: { ...move.from }, to: { ...move.to } };
    next.turn = opposite(game.turn);
    next.halfMoveClock = movingPiece.type === "pawn" || captured ? 0 : next.halfMoveClock + 1;
    if (next.turn === WHITE) next.fullMove += 1;
  }

  return next;
}

function updateCastlingRights(game, move, movingPiece, captured) {
  if (movingPiece.type === "king") {
    game.castling[movingPiece.color].kingSide = false;
    game.castling[movingPiece.color].queenSide = false;
  }

  if (movingPiece.type === "rook") {
    removeRookRight(game, movingPiece.color, move.from);
  }

  if (captured?.type === "rook") {
    removeRookRight(game, captured.color, move.to);
  }
}

function removeRookRight(game, color, square) {
  const layout = boardLayout(game);
  const homeRow = color === WHITE ? rowCount(game.board) - 1 : 0;
  if (square.row !== homeRow) return;
  if (square.col === layout.queenRookCol) game.castling[color].queenSide = false;
  if (square.col === layout.kingRookCol) game.castling[color].kingSide = false;
}

function createMove(game, from, to, flags = {}) {
  return {
    from: { ...from },
    to: { ...to },
    piece: { ...getPiece(game.board, from) },
    captured: flags.enPassant
      ? getPiece(game.board, { row: from.row, col: to.col })
      : getPiece(game.board, to),
    castle: flags.castle || null,
    enPassant: Boolean(flags.enPassant),
    doublePawn: Boolean(flags.doublePawn),
    shoot: Boolean(flags.shoot),
    promotion: flags.promotion || null,
  };
}

function isKingInCheck(game, color) {
  const king = findKing(game.board, color);
  return king ? isSquareAttacked(game, king, opposite(color)) : false;
}

function findKing(board, color) {
  for (let row = 0; row < rowCount(board); row += 1) {
    for (let col = 0; col < colCount(board); col += 1) {
      const current = board[row][col];
      if (current?.type === "king" && current.color === color) return { row, col };
    }
  }
  return null;
}

function isSquareAttacked(game, square, attackingColor) {
  if (isProtectedTerrain(game, square)) return false;

  for (let row = 0; row < rowCount(game.board); row += 1) {
    for (let col = 0; col < colCount(game.board); col += 1) {
      const attacker = game.board[row][col];
      if (!attacker || attacker.color !== attackingColor) continue;
      if (attacksSquare(game, { row, col }, attacker, square)) return true;
    }
  }
  return false;
}

function attacksSquare(game, from, attacker, target) {
  const rowDelta = target.row - from.row;
  const colDelta = target.col - from.col;

  if (attacker.type === "pawn") {
    const direction = attacker.color === WHITE ? -1 : 1;
    return rowDelta === direction && Math.abs(colDelta) === 1;
  }

  if (attacker.type === "spearman") {
    const direction = attacker.color === WHITE ? -1 : 1;
    return rowDelta === direction && Math.abs(colDelta) <= 1;
  }

  if (attacker.type === "knight") {
    return (
      (Math.abs(rowDelta) === 2 && Math.abs(colDelta) === 1) ||
      (Math.abs(rowDelta) === 1 && Math.abs(colDelta) === 2)
    );
  }

  if (attacker.type === "archer") {
    return (
      (Math.abs(rowDelta) === 2 && colDelta === 0) ||
      (rowDelta === 0 && Math.abs(colDelta) === 2) ||
      (Math.abs(rowDelta) === 1 && Math.abs(colDelta) === 1)
    );
  }

  if (attacker.type === "king" || attacker.type === "shield") {
    return Math.max(Math.abs(rowDelta), Math.abs(colDelta)) === 1;
  }

  const directions = {
    bishop: [[1, 1], [1, -1], [-1, 1], [-1, -1]],
    rook: [[1, 0], [-1, 0], [0, 1], [0, -1]],
    queen: [[1, 1], [1, -1], [-1, 1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]],
  }[attacker.type];

  return directions.some(([rowStep, colStep]) => rayHits(game, from, target, rowStep, colStep));
}

function rayHits(game, from, target, rowStep, colStep, maxSteps = Infinity) {
  let current = { row: from.row + rowStep, col: from.col + colStep };
  let steps = 1;

  while (steps <= maxSteps && inside(game.board, current)) {
    if (sameSquare(current, target)) return true;
    if (["lake", "mountain"].includes(getTerrain(game, current))) return false;
    if (getPiece(game.board, current)) return false;
    current = { row: current.row + rowStep, col: current.col + colStep };
    steps += 1;
  }

  return false;
}

function canOccupy(game, square, piece) {
  if (!inside(game.board, square) || !canEnterTerrain(game, square, piece)) return false;
  const target = getPiece(game.board, square);
  return !target || isCapturable(game, square, target, piece);
}

function isCapturable(game, square, target, attacker) {
  const attackerColor = typeof attacker === "string" ? attacker : attacker.color;
  const attackerType = typeof attacker === "string" ? null : attacker.type;
  return Boolean(
    target &&
    target.color !== attackerColor &&
    target.type !== "king" &&
    !(attackerType === "pawn" && target.type === "shield") &&
    !isProtectedTerrain(game, square),
  );
}

function canEnterTerrain(game, square, piece) {
  const terrain = getTerrain(game, square);
  if (!terrain || terrain === "village") return true;
  if (terrain === "lake" || terrain === "mountain") return false;
  if (terrain === "temple") return piece.type === "pawn";
  if (terrain === "forest") return ["pawn", "knight", "bishop"].includes(piece.type);
  if (terrain === "tower") return ["king", "queen", "pawn"].includes(piece.type);
  return true;
}

function isProtectedTerrain(game, square) {
  return ["village", "forest", "tower"].includes(getTerrain(game, square));
}

function getTerrain(game, square) {
  if (!game.terrain || !inside(game.board, square)) return null;
  return game.terrain[square.row]?.[square.col] || null;
}

function isOpeningRound(game) {
  return game.fullMove === 1;
}

function getPiece(board, square) {
  if (!inside(board, square)) return null;
  return board[square.row][square.col];
}

function inside(board, square) {
  return (
    square.row >= 0 &&
    square.row < rowCount(board) &&
    square.col >= 0 &&
    square.col < colCount(board)
  );
}

function rowCount(board) {
  return board.length;
}

function colCount(board) {
  return board[0]?.length || 0;
}

function boardLayout(game) {
  const setupStartCol = game.mode?.setupStartCol ?? 0;
  const queenRookCol = setupStartCol;
  const kingCol = setupStartCol + 4;
  const kingRookCol = setupStartCol + 7;

  return {
    queenRookCol,
    queenTargetCol: kingCol - 2,
    queenRookTargetCol: kingCol - 1,
    kingCol,
    kingTargetCol: kingCol + 2,
    kingRookCol,
    kingRookTargetCol: kingCol + 1,
  };
}

function clearBetween(board, row, colA, colB) {
  const start = Math.min(colA, colB) + 1;
  const end = Math.max(colA, colB);

  for (let col = start; col < end; col += 1) {
    if (getPiece(board, { row, col })) return false;
  }

  return true;
}

function sameSquare(a, b) {
  return a?.row === b?.row && a?.col === b?.col;
}

function opposite(color) {
  return color === WHITE ? BLACK : WHITE;
}

function colorLabel(color) {
  return color === WHITE ? "白方" : "黑方";
}
