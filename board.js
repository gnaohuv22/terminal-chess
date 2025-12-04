// ============================================================================
// CHESS BOARD COMPONENT - Reusable Board Renderer
// ============================================================================

// ---- Unicode Chess Pieces ----
const UNICODE_PIECES = {
  white: { k: "\u2654", q: "\u2655", r: "\u2656", b: "\u2657", n: "\u2658", p: "\u2659" },
  black: { k: "\u265A", q: "\u265B", r: "\u265C", b: "\u265D", n: "\u265E", p: "\u265F" }
};

// Fallback ASCII pieces
const ASCII_PIECES = {
  white: { k: "K", q: "Q", r: "R", b: "B", n: "N", p: "P" },
  black: { k: "k", q: "q", r: "r", b: "b", n: "n", p: "p" }
};

class ChessBoard {
  constructor(options = {}) {
      this.useUnicodePieces = options.useUnicodePieces !== false;
      this.interactive = options.interactive || false;
      this.onSquareClick = options.onSquareClick || null;
      this.highlightedSquares = new Set();
      this.lastMove = null;
  }

  getPieceChar(piece) {
      if (!piece) return "";
      
      if (this.useUnicodePieces) {
          const set = piece.color === "w" ? UNICODE_PIECES.white : UNICODE_PIECES.black;
          return set[piece.type] || "?";
      } else {
          const set = piece.color === "w" ? ASCII_PIECES.white : ASCII_PIECES.black;
          return set[piece.type] || "?";
      }
  }

  getPieceColor(piece) {
      if (!piece) return null;
      return piece.color;
  }

  setHighlights(squares) {
      this.highlightedSquares.clear();
      if (squares) {
          squares.forEach(sq => this.highlightedSquares.add(sq));
      }
  }

  setLastMove(move) {
      this.lastMove = move;
  }

  renderHtmlBoard(game, flipped = false) {
      if (!game) return '<div class="chess-board-wrapper">No game loaded</div>';
      
      const b = game.board();
      const files = ["a", "b", "c", "d", "e", "f", "g", "h"];
      
      // Create wrapper
      let html = '<div class="chess-board-wrapper">';
      
      // Board with rank labels
      html += '<div class="board-with-ranks">';
      
      // Rank labels column
      html += '<div class="rank-labels">';
      for (let r = 0; r < 8; r++) {
          const rank = flipped ? r + 1 : 8 - r;
          html += `<div class="rank-label">${rank}</div>`;
      }
      html += '</div>';
      
      // The 8x8 grid
      html += '<div class="chess-board-grid">';
      
      for (let r = 0; r < 8; r++) {
          for (let f = 0; f < 8; f++) {
              const boardRow = flipped ? 7 - r : r;
              const boardCol = flipped ? 7 - f : f;
              
              const sq = b[boardRow][boardCol];
              const piece = this.getPieceChar(sq);
              const pieceColor = this.getPieceColor(sq);
              const rank = flipped ? r + 1 : 8 - r;
              const file = files[flipped ? 7 - f : f];
              const square = file + rank;
              
              // Determine square color (for subtle checkerboard)
              const isLight = (r + f) % 2 === 0;
              const sqColorClass = isLight ? "sq-light" : "sq-dark";
              
              // Piece color class
              let pieceClass = "";
              if (pieceColor === "w") {
                  pieceClass = "piece-white";
              } else if (pieceColor === "b") {
                  pieceClass = "piece-black";
              } else {
                  pieceClass = "sq-empty";
              }

              // Additional classes for highlights
              let extraClasses = "";
              if (this.highlightedSquares.has(square)) {
                  extraClasses += " highlighted";
              }
              if (this.lastMove && (this.lastMove.from === square || this.lastMove.to === square)) {
                  extraClasses += " last-move";
              }

              const clickHandler = this.interactive && this.onSquareClick 
                  ? ` onclick="boardInstance.handleSquareClick('${square}')"` 
                  : "";
              
              html += `<div class="sq ${sqColorClass} ${pieceClass}${extraClasses}" data-square="${square}" data-rank="${rank}" data-file="${file}"${clickHandler}>${piece}</div>`;
          }
      }
      
      html += '</div>'; // .chess-board-grid
      html += '</div>'; // .board-with-ranks
      
      // File labels row
      html += '<div class="file-labels">';
      html += '<div class="file-label"></div>'; // Empty corner
      for (let f = 0; f < 8; f++) {
          const file = files[flipped ? 7 - f : f];
          html += `<div class="file-label">${file}</div>`;
      }
      html += '</div>';
      
      html += '</div>'; // .chess-board-wrapper
      
      return html;
  }

  renderAsciiBoard(game, flipped = false) {
      if (!game) return "No game loaded";
      
      const b = game.board();
      let outStr = "";
      
      const cellWidth = 5;
      const cellSep = "-".repeat(cellWidth);
      const horizLine = "   +" + (cellSep + "+").repeat(8) + "\n";
      
      outStr += horizLine;
      
      for (let r = 0; r < 8; r++) {
          const boardRow = flipped ? 7 - r : r;
          const rankLabel = flipped ? r + 1 : 8 - r;
          let line = " " + rankLabel + " |";
          
          for (let f = 0; f < 8; f++) {
              const boardCol = flipped ? 7 - f : f;
              const sq = b[boardRow][boardCol];
              const piece = sq ? this.getPieceChar(sq) : ".";
              line += "  " + piece + "  |";
          }
          
          outStr += line + "\n";
          outStr += horizLine;
      }
      
      const files = ["a", "b", "c", "d", "e", "f", "g", "h"];
      let fileRow = "   ";
      for (let i = 0; i < 8; i++) {
          const file = files[flipped ? 7 - i : i];
          fileRow += "   " + file + "  ";
      }
      outStr += fileRow + "\n";
      
      return outStr;
  }

  handleSquareClick(square) {
      if (this.onSquareClick) {
          this.onSquareClick(square);
      }
  }

  render(container, game, options = {}) {
      if (!container) return;
      
      const flipped = options.flipped || false;
      const html = this.renderHtmlBoard(game, flipped);
      container.innerHTML = html;
      
      // Store reference for click handlers
      if (this.interactive) {
          window.boardInstance = this;
      }
  }
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ChessBoard;
} else {
  window.ChessBoard = ChessBoard;
}