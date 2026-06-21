import {
  BOARD_MODES,
  BLACK,
  PIECE_IMAGES,
  PIECE_VALUES,
  WHITE,
  createInitialGame,
  getGameStatus,
  getLegalMoves,
  movePiece,
  notationForMove,
} from "./rules.js?v=terrain-spacing-1";
import { ChessBoard } from "./board.js?v=terrain-spacing-1";

const boardElement = document.querySelector("#board");
const statusText = document.querySelector("#statusText");
const turnLabel = document.querySelector("#turnLabel");
const stateLabel = document.querySelector("#stateLabel");
const moveList = document.querySelector("#moveList");
const resetButton = document.querySelector("#resetButton");
const modeButtons = document.querySelectorAll("[data-mode]");
const aiButtons = document.querySelectorAll("[data-ai]");
const setupControls = document.querySelector("#setupControls");
const setupHint = document.querySelector("#setupHint");
const resetSetupButton = document.querySelector("#resetSetupButton");
const terrainButton = document.querySelector("#terrainButton");
const autoBattleButton = document.querySelector("#autoBattleButton");
const startBattleButton = document.querySelector("#startBattleButton");
const victoryBanner = document.querySelector("#victoryBanner");
const victoryBannerLabel = document.querySelector("#victoryBannerLabel");
const victoryBannerTitle = victoryBanner?.querySelector("strong");
const capturedWhite = document.querySelector("#capturedWhite");
const capturedBlack = document.querySelector("#capturedBlack");
const pieceValueList = document.querySelector("#pieceValueList");
const pieceValueTotal = document.querySelector("#pieceValueTotal");

const VALUE_ROWS = [
  { type: "king", label: "王", count: 1 },
  { type: "queen", label: "后", count: 1 },
  { type: "rook", label: "車", count: 2 },
  { type: "bishop", label: "象", count: 2 },
  { type: "knight", label: "馬", count: 2 },
  { type: "pawn", label: "兵", count: 8 },
];

const AI_LEVELS = {
  off: { label: "雙人" },
  easy: { label: "初級" },
  normal: { label: "中級" },
  hard: { label: "高級" },
};

const AI_COLOR = BLACK;
const HUMAN_COLOR = WHITE;
const TERRAIN_COUNTS = {
  village: 1,
  lake: 1,
  forest: 1,
  tower: 1,
  mountain: 1,
  temple: 1,
};

let currentMode = BOARD_MODES.classic.id;
let game = createInitialGame(currentMode);
let selected = null;
let legalMoves = [];
let isSetupPhase = false;
let aiLevel = "off";
let aiThinking = false;
let aiTimer = null;
let setupMessage = "";
let autoBattle = false;

const boardView = new ChessBoard(boardElement, handleSquareSelect);

resetButton.addEventListener("click", () => {
  resetGame();
});

resetSetupButton.addEventListener("click", () => {
  if (currentMode !== BOARD_MODES.wide.id) return;
  resetGame();
});

terrainButton.addEventListener("click", () => {
  if (currentMode !== BOARD_MODES.wide.id || !isSetupPhase) return;
  generateTerrain();
  setupMessage = "地形已生成：村莊、湖泊、森林、塔樓已散布在戰場。";
  selected = null;
  render();
});

startBattleButton.addEventListener("click", () => {
  disableCastling();
  isSetupPhase = false;
  selected = null;
  legalMoves = [];
  render();
  queueAiMove();
});

autoBattleButton.addEventListener("click", () => {
  if (currentMode !== BOARD_MODES.wide.id) return;
  autoBattle = !autoBattle;
  selected = null;
  legalMoves = [];
  render();
  queueAiMove();
});

modeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const nextMode = button.dataset.mode;
    if (!BOARD_MODES[nextMode] || nextMode === currentMode) return;
    if (nextMode !== BOARD_MODES.wide.id) autoBattle = false;
    currentMode = nextMode;
    resetGame();
  });
});

aiButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const nextLevel = button.dataset.ai;
    if (!AI_LEVELS[nextLevel]) return;
    aiLevel = nextLevel;
    selected = null;
    legalMoves = [];
    render();
    queueAiMove();
  });
});

render();

function handleSquareSelect(square) {
  if (isSetupPhase) {
    handleSetupSelect(square);
    return;
  }

  if (aiThinking || isComputerTurn()) return;
  if (game.winner || game.draw) return;

  const clickedPiece = game.board[square.row][square.col];
  const selectedMove = legalMoves.find((move) => sameSquare(move.to, square));

  if (selected && selectedMove) {
    const promotion = choosePromotion(selectedMove);
    const result = movePiece(game, selected, square, promotion);
    game = result.game;
    applyAiSurrenderIfStuck();
    selected = null;
    legalMoves = [];
    render();
    queueAiMove();
    return;
  }

  if (clickedPiece?.color === game.turn && !isComputerTurn()) {
    selected = square;
    legalMoves = getLegalMoves(game, square);
  } else {
    selected = null;
    legalMoves = [];
  }

  render();
}

function handleSetupSelect(square) {
  const clickedPiece = game.board[square.row][square.col];

  if (!selected) {
    if (!clickedPiece) return;
    setupMessage = "";
    selected = square;
    render();
    return;
  }

  if (sameSquare(selected, square)) {
    setupMessage = "";
    selected = null;
    render();
    return;
  }

  const selectedPiece = game.board[selected.row][selected.col];
  if (!selectedPiece) {
    setupMessage = "";
    selected = clickedPiece ? square : null;
    render();
    return;
  }

  if (!canPlaceInSetup(selectedPiece, square) || (clickedPiece && !canPlaceInSetup(clickedPiece, selected))) {
    setupMessage = "兵只能放前排；王后車象馬只能放後排，且不可超出部屬區。";
    render();
    return;
  }

  game.board[selected.row][selected.col] = clickedPiece || null;
  game.board[square.row][square.col] = selectedPiece;
  setupMessage = "";
  selected = null;
  render();
}

function canPlaceInSetup(piece, square) {
  const homeRows = setupRowsForColor(piece.color);
  if (piece.type === "pawn") return square.row === homeRows.front;
  return square.row === homeRows.back;
}

function setupRowsForColor(color) {
  return color === WHITE
    ? { back: game.board.length - 1, front: game.board.length - 2 }
    : { back: 0, front: 1 };
}

function generateTerrain() {
  game.terrain = game.board.map((row) => row.map(() => null));
  const candidates = [];

  for (let row = 2; row < game.board.length - 2; row += 1) {
    for (let col = 0; col < game.board[row].length; col += 1) {
      if (!game.board[row][col]) candidates.push({ row, col });
    }
  }

  Object.entries(TERRAIN_COUNTS).forEach(([terrain, count]) => {
    for (let index = 0; index < count && candidates.length > 0; index += 1) {
      const candidateIndex = Math.floor(Math.random() * candidates.length);
      const [square] = candidates.splice(candidateIndex, 1);
      game.terrain[square.row][square.col] = terrain;

      for (let candidate = candidates.length - 1; candidate >= 0; candidate -= 1) {
        if (isOrthogonallyAdjacent(candidates[candidate], square)) {
          candidates.splice(candidate, 1);
        }
      }
    }
  });
}

function isOrthogonallyAdjacent(a, b) {
  return Math.abs(a.row - b.row) + Math.abs(a.col - b.col) === 1;
}

function choosePromotion(move) {
  if (!move.promotion) return null;

  const answer = window.prompt("升變為：Q 皇后、R 城堡、B 主教、N 騎士", "Q");
  const normalized = (answer || "Q").trim().toUpperCase();
  const map = { Q: "queen", R: "rook", B: "bishop", N: "knight" };
  return map[normalized] || "queen";
}

function render() {
  boardView.render(game, selected, legalMoves);
  renderStatus();
  renderPieceValues();
  renderMoves();
  renderCaptured();
  renderMode();
  renderSetupControls();
  renderAiControls();
  renderAutoBattleControl();
  renderVictoryBanner();
}

function resetGame() {
  clearAiTimer();
  game = createInitialGame(currentMode);
  selected = null;
  legalMoves = [];
  setupMessage = "";
  aiThinking = false;
  isSetupPhase = currentMode === BOARD_MODES.wide.id;
  render();
  queueAiMove();
}

function disableCastling() {
  game.castling.white.kingSide = false;
  game.castling.white.queenSide = false;
  game.castling.black.kingSide = false;
  game.castling.black.queenSide = false;
}

function isAiEnabled() {
  return aiLevel !== "off";
}

function isComputerTurn() {
  if (autoBattle && currentMode === BOARD_MODES.wide.id && !isSetupPhase) return true;
  return isAiEnabled() && game.turn === AI_COLOR;
}

function oppositeColor(color) {
  return color === WHITE ? BLACK : WHITE;
}

function aiLevelForMove() {
  if (autoBattle && aiLevel === "off") return "normal";
  return aiLevel;
}

function clearAiTimer() {
  if (!aiTimer) return;
  window.clearTimeout(aiTimer);
  aiTimer = null;
}

function queueAiMove() {
  clearAiTimer();

  if (isComputerTurn() && !isSetupPhase && !game.aiSurrender) {
    applyAiSurrenderIfStuck();
  }

  if (!isComputerTurn() || game.winner || game.draw) {
    aiThinking = false;
    return;
  }

  aiThinking = true;
  render();
  aiTimer = window.setTimeout(playAiMove, 360);
}

function playAiMove() {
  aiTimer = null;
  const aiMove = chooseAiMove(game, aiLevelForMove());
  aiThinking = false;

  if (!aiMove) {
    declareAiSurrender(game.turn);
    render();
    return;
  }

  const result = movePiece(game, aiMove.from, aiMove.to, aiMove.promotion || null);
  if (result.ok) game = result.game;
  applyAiSurrenderIfStuck();
  selected = null;
  legalMoves = [];
  render();
  queueAiMove();
}

function applyAiSurrenderIfStuck() {
  if ((!isAiEnabled() && !autoBattle) || isSetupPhase || game.aiSurrender || !isComputerTurn()) return;
  if (!game.winner && !game.draw && getAllLegalMovesForTurn(game).length > 0) return;
  if (game.winner && game.winner !== oppositeColor(game.turn)) return;
  declareAiSurrender(game.turn);
}

function declareAiSurrender(color = game.turn) {
  game.winner = oppositeColor(color);
  game.draw = false;
  game.aiSurrender = true;
  game.surrenderColor = color;
  aiThinking = false;
  clearAiTimer();
}

function chooseAiMove(currentGame, level) {
  const moves = getAllLegalMovesForTurn(currentGame);
  if (moves.length === 0) return null;

  if (level === "easy") return randomItem(moves);
  if (level === "normal") return chooseByScore(currentGame, moves, scoreMove);
  return chooseByScore(currentGame, moves, (move) => scoreHardMove(currentGame, move));
}

function chooseByScore(currentGame, moves, scorer) {
  const scored = moves.map((move) => ({ move, score: scorer(move) }));
  const bestScore = Math.max(...scored.map((item) => item.score));
  const bestMoves = scored.filter((item) => item.score === bestScore).map((item) => item.move);
  return randomItem(bestMoves);
}

function scoreMove(move) {
  const captureScore = move.captured ? PIECE_VALUES[move.captured.type] * 10 : 0;
  const promotionScore = move.promotion ? PIECE_VALUES.queen : 0;
  const centerScore = 8 - Math.abs(move.to.col - 5.5) - Math.abs(move.to.row - 3.5);
  return captureScore + promotionScore + centerScore + Math.random();
}

function scoreHardMove(currentGame, move) {
  const result = movePiece(currentGame, move.from, move.to, move.promotion || null);
  if (!result.ok) return -Infinity;
  if (result.game.winner === AI_COLOR) return 100000;
  if (result.game.winner === HUMAN_COLOR) return -100000;

  const replies = getAllLegalMovesForTurn(result.game);
  const worstReply = replies.length
    ? Math.min(...replies.map((reply) => {
        const replyResult = movePiece(result.game, reply.from, reply.to, reply.promotion || null);
        return replyResult.ok ? evaluateBoard(replyResult.game, AI_COLOR) : evaluateBoard(result.game, AI_COLOR);
      }))
    : 0;

  return worstReply + scoreMove(move) * 0.25;
}

function evaluateBoard(currentGame, color) {
  if (currentGame.winner === color) return 100000;
  if (currentGame.winner) return -100000;
  if (currentGame.draw) return 0;

  let score = 0;
  currentGame.board.forEach((row, rowIndex) => {
    row.forEach((piece, colIndex) => {
      if (!piece) return;
      const value = PIECE_VALUES[piece.type] || 0;
      const centerBonus = 4 - Math.abs(colIndex - (row.length - 1) / 2) * 0.15 - Math.abs(rowIndex - 3.5) * 0.2;
      score += (piece.color === color ? 1 : -1) * (value + centerBonus);
    });
  });

  return score;
}

function getAllLegalMovesForTurn(currentGame) {
  const moves = [];

  currentGame.board.forEach((row, rowIndex) => {
    row.forEach((piece, colIndex) => {
      if (piece?.color !== currentGame.turn) return;
      moves.push(...getLegalMoves(currentGame, { row: rowIndex, col: colIndex }));
    });
  });

  return moves;
}

function randomItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function renderStatus() {
  if (isSetupPhase) {
    statusText.textContent = "戰棋布陣中";
    turnLabel.textContent = "布陣";
    stateLabel.textContent = "等待開局";
    return;
  }

  const status = getGameStatus(game);
  const surrenderLabel = game.surrenderColor === WHITE ? "白方 AI 投降" : "黑方 AI 投降";
  statusText.textContent = game.aiSurrender ? surrenderLabel : aiThinking ? "AI 思考中" : status.text;
  turnLabel.textContent = game.turn === WHITE ? "白方" : "黑方";
  stateLabel.textContent = stateText(status.state);
}

function renderVictoryBanner() {
  if (!victoryBanner) return;
  const shouldShow = Boolean(game.aiSurrender);
  const playerSurrendered = game.surrenderColor === HUMAN_COLOR;

  victoryBanner.hidden = !shouldShow;
  victoryBanner.classList.toggle("surrendered", shouldShow && playerSurrendered);

  if (victoryBannerLabel) {
    victoryBannerLabel.textContent = playerSurrendered ? "PLAYER SURRENDER" : "PLAYER WIN";
  }

  if (victoryBannerTitle) {
    victoryBannerTitle.textContent = playerSurrendered ? "玩家投降" : "玩家勝利";
  }
}

function renderAiControls() {
  aiButtons.forEach((button) => {
    const isActive = button.dataset.ai === aiLevel;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", isActive ? "true" : "false");
  });
}

function renderSetupControls() {
  if (!setupControls) return;
  const shouldShow = currentMode === BOARD_MODES.wide.id;
  setupControls.hidden = !shouldShow;
  if (!shouldShow) return;

  startBattleButton.disabled = !isSetupPhase;
  resetSetupButton.disabled = !isSetupPhase;
  terrainButton.disabled = !isSetupPhase;
  setupHint.textContent = isSetupPhase
    ? setupMessage || (selected
      ? "點目標格放下棋子；點同一格可取消。"
      : autoBattle
        ? "自動對戰已啟用；完成布陣後按開局。"
        : "可先生成地形；湖泊不可進入，森林與塔樓限制部分棋子。")
    : autoBattle
      ? "雙方 AI 自動對戰中。"
      : "對局已開始。";
}

function renderAutoBattleControl() {
  if (!autoBattleButton) return;
  const isWide = currentMode === BOARD_MODES.wide.id;
  autoBattleButton.disabled = !isWide;
  autoBattleButton.classList.toggle("active", autoBattle && isWide);
  autoBattleButton.setAttribute("aria-pressed", autoBattle && isWide ? "true" : "false");
}

function renderMode() {
  modeButtons.forEach((button) => {
    const isActive = button.dataset.mode === game.mode.id;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", isActive ? "true" : "false");
    button.title = isActive ? `目前棋盤：${game.mode.label}` : `切換為 ${button.textContent.trim()}`;
  });
}

function renderMoves() {
  moveList.replaceChildren();

  game.history.forEach((move, index) => {
    if (index % 2 === 0) {
      const item = document.createElement("li");
      item.textContent = notationForMove(move);
      moveList.append(item);
      return;
    }

    const last = moveList.lastElementChild;
    last.textContent = `${last.textContent}    ${notationForMove(move)}`;
  });
}

function renderCaptured() {
  renderCapturedRow(capturedBlack, game.captured[BLACK], "黑方得分");
  renderCapturedRow(capturedWhite, game.captured[WHITE], "白方得分");
}

function renderCapturedRow(element, pieces, label) {
  element.replaceChildren();

  const score = pieces.reduce(
    (sum, piece) => sum + (piece.type === "king" ? 0 : PIECE_VALUES[piece.type]),
    0,
  );
  const summary = document.createElement("span");
  summary.className = "captured-summary";
  summary.textContent = `${label} ${score} 分`;
  element.append(summary);

  if (pieces.length === 0) {
    return;
  }

  const pieceGroup = document.createElement("span");
  pieceGroup.className = "captured-pieces";

  pieces.forEach((piece) => {
    const node = document.createElement("img");
    node.className = "captured-piece";
    node.src = PIECE_IMAGES[piece.color][piece.type];
    node.alt = `${piece.color} ${piece.type}`;
    node.draggable = false;
    pieceGroup.append(node);
  });

  element.append(pieceGroup);
}

function renderPieceValues() {
  if (!pieceValueList || !pieceValueTotal) return;

  pieceValueList.replaceChildren();

  const total = VALUE_ROWS.reduce(
    (sum, row) => sum + PIECE_VALUES[row.type] * row.count,
    0,
  );

  VALUE_ROWS.forEach((row) => {
    const item = document.createElement("li");
    item.className = "piece-value-item";

    const piece = document.createElement("img");
    piece.className = "value-piece";
    piece.src = PIECE_IMAGES[WHITE][row.type];
    piece.alt = row.label;
    piece.draggable = false;

    const name = document.createElement("span");
    name.className = "value-name";
    name.textContent = row.label;

    const count = document.createElement("span");
    count.className = "value-count";
    count.textContent = `x${row.count}`;

    const value = document.createElement("strong");
    value.className = "value-score";
    value.textContent = `單顆 ${PIECE_VALUES[row.type]}`;

    const subtotal = document.createElement("strong");
    subtotal.className = "value-subtotal";
    subtotal.textContent = `${PIECE_VALUES[row.type] * row.count} 分`;

    item.append(piece, name, count, value, subtotal);
    pieceValueList.append(item);
  });

  pieceValueTotal.textContent = `${total} 分`;
}

function stateText(state) {
  const labels = {
    playing: "進行中",
    check: "將軍",
    checkmate: "將死",
    draw: "和局",
  };
  return labels[state] || state;
}

function sameSquare(a, b) {
  return a?.row === b?.row && a?.col === b?.col;
}
