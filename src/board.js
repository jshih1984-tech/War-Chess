import { PIECE_IMAGES, squareName } from "./rules.js?v=terrain-spacing-1";

export class ChessBoard {
  constructor(element, onSquareSelect) {
    this.element = element;
    this.onSquareSelect = onSquareSelect;
    this.selected = null;
    this.legalMoves = [];
    this.lastMove = null;
    this.board = [];
    this.terrain = [];
    this.aiSurrender = false;
    this.surrenderColor = null;
    this.winner = null;
  }

  render(game, selected = null, legalMoves = []) {
    this.board = game.board;
    this.selected = selected;
    this.legalMoves = legalMoves;
    this.lastMove = game.lastMove;
    this.terrain = game.terrain || [];
    this.aiSurrender = Boolean(game.aiSurrender);
    this.surrenderColor = game.surrenderColor || (this.aiSurrender ? "black" : null);
    this.winner = game.winner || null;
    this.element.replaceChildren();
    this.element.style.setProperty("--board-rows", this.board.length);
    this.element.style.setProperty("--board-cols", this.board[0]?.length || 8);
    this.element.classList.toggle("wide-board", (this.board[0]?.length || 8) > 8);

    for (let row = 0; row < this.board.length; row += 1) {
      for (let col = 0; col < this.board[row].length; col += 1) {
        this.element.append(this.createSquare(row, col));
      }
    }
  }

  createSquare(row, col) {
    const square = { row, col };
    const button = document.createElement("button");
    const piece = this.board[row][col];
    const terrain = this.terrain[row]?.[col] || null;
    const move = this.legalMoves.find((item) => item.to.row === row && item.to.col === col);

    button.type = "button";
    button.className = [
      "square",
      (row + col) % 2 === 0 ? "light" : "dark",
      terrain ? `terrain-${terrain}` : "",
      this.isSelected(square) ? "selected" : "",
      this.isLastMove(square) ? "last-move" : "",
      move ? "legal" : "",
      move?.captured ? "capture" : "",
    ]
      .filter(Boolean)
      .join(" ");
    button.setAttribute("aria-label", this.labelForSquare(square, piece));
    button.addEventListener("click", () => this.onSquareSelect(square));

    if (terrain) {
      const terrainNode = document.createElement("span");
      terrainNode.className = "terrain-marker";
      terrainNode.setAttribute("aria-hidden", "true");
      button.append(terrainNode);
    }

    if (piece) {
      const pieceNode = document.createElement("img");
      pieceNode.className = `piece ${piece.color}`;
      pieceNode.src = PIECE_IMAGES[piece.color][piece.type];
      pieceNode.alt = `${piece.color} ${piece.type}`;
      pieceNode.draggable = false;
      button.append(pieceNode);

      if (piece.color === this.defeatedColor() && piece.type === "king") {
        const speech = document.createElement("span");
        speech.className = "king-speech";
        speech.textContent = "我投降";
        button.append(speech);
      }
    }

    if (row === this.board.length - 1 || col === 0) {
      const coord = document.createElement("span");
      coord.className = "coord";
      coord.textContent = this.coordinateText(row, col);
      button.append(coord);
    }

    return button;
  }

  labelForSquare(square, piece) {
    const base = squareName(square);
    if (!piece) return `${base} empty`;
    return `${base} ${piece.color} ${piece.type}`;
  }

  coordinateText(row, col) {
    const lastRow = this.board.length - 1;
    if (row === lastRow && col === 0) return "a1";
    if (row === lastRow) return String.fromCharCode(97 + col);
    if (col === 0) return `${this.board.length - row}`;
    return "";
  }

  isSelected(square) {
    return this.selected?.row === square.row && this.selected?.col === square.col;
  }

  isLastMove(square) {
    return (
      this.sameSquare(this.lastMove?.from, square) ||
      this.sameSquare(this.lastMove?.to, square)
    );
  }

  sameSquare(a, b) {
    return a?.row === b?.row && a?.col === b?.col;
  }

  defeatedColor() {
    if (this.surrenderColor) return this.surrenderColor;
    if (!this.winner) return null;
    return this.winner === "white" ? "black" : "white";
  }
}
