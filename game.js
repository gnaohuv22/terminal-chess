// ============================================================================
// TERMINAL CHESS - Game Frontend Logic
// Features: Clipboard, Arrow Navigation, Unicode Pieces, Enhanced Status
// ============================================================================

// ---- DOM Elements ----
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const out = $("#output");
const cmdInput = $("#cmdInput");
const suggestList = $("#suggestList");
const runBtn = $("#runBtn");
const clearBtn = $("#clearBtn");
const quickChips = $("#quickChips");
const themeToggle = $("#themeToggle");

// ---- State Variables ----
const redoStack = [];
const history = [];

let game = null;
let histIdx = -1;
let resigned = false;
let suggestPortalMounted = false;
let backdropEl = null;
let suggestIdx = -1; // Current suggestion selection index

// Bot state (shared with bot.js)
let botActive = false;
let botSide = null;
let botDepth = 8;
let botThinking = false;
let gameStartTime = null;
let autoplayMode = false;
let moveDelay = 1000;

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

// Use Unicode by default
let useUnicodePieces = true;

// ---- Piece Mapping ----
const PIECE_MAP = {
    pawn: "p", p: "p",
    rook: "r", r: "r",
    knight: "n", n: "n", horse: "n",
    bishop: "b", b: "b",
    queen: "q", q: "q",
    king: "k", k: "k"
};

// ---- Command Definitions ----
const COMMANDS = [
    "board status",
    "board move <piece> <from> <to> [promotion]",
    "board move <from> <to> [promotion]",
    "board moves [from]",
    "board legal [from]",
    "board undo",
    "board redo",
    "board reset",
    "board new",
    "board turn",
    "board fen",
    "board pgn",
    "board save [name]",
    "board load [name]",
    "board resign",
    "board bot play [white|black]",
    "board bot autoplay [delay_ms]",
    "board bot stop",
    "board bot best",
    "board bot random",
    "board bot depth [number]",
    "board bot enter [white|black]",
    "board help"
];

const QUICK = [
    { label: "status", cmd: "board status" },
    { label: "undo", cmd: "board undo" },
    { label: "redo", cmd: "board redo" },
    { label: "reset", cmd: "board reset" },
    { label: "autoplay", cmd: "board bot autoplay" },
    { label: "stop", cmd: "board bot stop" },
    { label: "fen", cmd: "board fen" },
    { label: "pgn", cmd: "board pgn" }
];

// ---- Extended Opening Database ----
const OPENINGS = [
    // Open Games (1.e4 e5)
    { eco: "C20", name: "Open Game", line: ["e4", "e5"] },
    { eco: "C21", name: "Center Game", line: ["e4", "e5", "d4"] },
    { eco: "C22", name: "Center Game Accepted", line: ["e4", "e5", "d4", "exd4"] },
    { eco: "C25", name: "Vienna Game", line: ["e4", "e5", "Nc3"] },
    { eco: "C30", name: "King's Gambit", line: ["e4", "e5", "f4"] },
    { eco: "C31", name: "King's Gambit Declined", line: ["e4", "e5", "f4", "d5"] },
    { eco: "C33", name: "King's Gambit Accepted", line: ["e4", "e5", "f4", "exf4"] },
    { eco: "C42", name: "Petrov's Defense", line: ["e4", "e5", "Nf3", "Nf6"] },
    { eco: "C44", name: "Scotch Game", line: ["e4", "e5", "Nf3", "Nc6", "d4"] },
    { eco: "C45", name: "Scotch Game", line: ["e4", "e5", "Nf3", "Nc6", "d4", "exd4", "Nxd4"] },
    { eco: "C50", name: "Italian Game", line: ["e4", "e5", "Nf3", "Nc6", "Bc4"] },
    { eco: "C51", name: "Evans Gambit", line: ["e4", "e5", "Nf3", "Nc6", "Bc4", "Bc5", "b4"] },
    { eco: "C53", name: "Giuoco Piano", line: ["e4", "e5", "Nf3", "Nc6", "Bc4", "Bc5"] },
    { eco: "C55", name: "Two Knights Defense", line: ["e4", "e5", "Nf3", "Nc6", "Bc4", "Nf6"] },
    { eco: "C57", name: "Fried Liver Attack", line: ["e4", "e5", "Nf3", "Nc6", "Bc4", "Nf6", "Ng5"] },
    { eco: "C60", name: "Ruy Lopez", line: ["e4", "e5", "Nf3", "Nc6", "Bb5"] },
    { eco: "C65", name: "Berlin Defense", line: ["e4", "e5", "Nf3", "Nc6", "Bb5", "Nf6"] },
    { eco: "C70", name: "Morphy Defense", line: ["e4", "e5", "Nf3", "Nc6", "Bb5", "a6"] },
    { eco: "C78", name: "Archangel Variation", line: ["e4", "e5", "Nf3", "Nc6", "Bb5", "a6", "Ba4", "Nf6", "O-O", "b5"] },
    { eco: "C80", name: "Open Variation", line: ["e4", "e5", "Nf3", "Nc6", "Bb5", "a6", "Ba4", "Nf6", "O-O", "Nxe4"] },
    { eco: "C84", name: "Closed Defense", line: ["e4", "e5", "Nf3", "Nc6", "Bb5", "a6", "Ba4", "Nf6", "O-O", "Be7"] },
    
    // Sicilian Defense (1.e4 c5)
    { eco: "B20", name: "Sicilian Defense", line: ["e4", "c5"] },
    { eco: "B21", name: "Grand Prix Attack", line: ["e4", "c5", "f4"] },
    { eco: "B22", name: "Alapin Variation", line: ["e4", "c5", "c3"] },
    { eco: "B23", name: "Closed Sicilian", line: ["e4", "c5", "Nc3"] },
    { eco: "B27", name: "Sicilian: Accelerated Dragon", line: ["e4", "c5", "Nf3", "g6"] },
    { eco: "B30", name: "Sicilian: Rossolimo", line: ["e4", "c5", "Nf3", "Nc6", "Bb5"] },
    { eco: "B32", name: "Sicilian: Kalashnikov", line: ["e4", "c5", "Nf3", "Nc6", "d4", "cxd4", "Nxd4", "e5"] },
    { eco: "B33", name: "Sicilian: Sveshnikov", line: ["e4", "c5", "Nf3", "Nc6", "d4", "cxd4", "Nxd4", "Nf6", "Nc3", "e5"] },
    { eco: "B40", name: "Sicilian: Pin Variation", line: ["e4", "c5", "Nf3", "e6"] },
    { eco: "B50", name: "Sicilian Defense", line: ["e4", "c5", "Nf3", "d6"] },
    { eco: "B52", name: "Sicilian: Moscow Variation", line: ["e4", "c5", "Nf3", "d6", "Bb5+"] },
    { eco: "B60", name: "Sicilian: Richter-Rauzer", line: ["e4", "c5", "Nf3", "d6", "d4", "cxd4", "Nxd4", "Nf6", "Nc3", "Nc6", "Bg5"] },
    { eco: "B70", name: "Sicilian: Dragon", line: ["e4", "c5", "Nf3", "d6", "d4", "cxd4", "Nxd4", "Nf6", "Nc3", "g6"] },
    { eco: "B80", name: "Sicilian: Scheveningen", line: ["e4", "c5", "Nf3", "d6", "d4", "cxd4", "Nxd4", "Nf6", "Nc3", "e6"] },
    { eco: "B90", name: "Sicilian: Najdorf", line: ["e4", "c5", "Nf3", "d6", "d4", "cxd4", "Nxd4", "Nf6", "Nc3", "a6"] },
    
    // French Defense (1.e4 e6)
    { eco: "C00", name: "French Defense", line: ["e4", "e6"] },
    { eco: "C01", name: "French: Exchange Variation", line: ["e4", "e6", "d4", "d5", "exd5"] },
    { eco: "C02", name: "French: Advance Variation", line: ["e4", "e6", "d4", "d5", "e5"] },
    { eco: "C03", name: "French: Tarrasch Variation", line: ["e4", "e6", "d4", "d5", "Nd2"] },
    { eco: "C10", name: "French: Rubinstein Variation", line: ["e4", "e6", "d4", "d5", "Nc3", "dxe4"] },
    { eco: "C11", name: "French: Classical Variation", line: ["e4", "e6", "d4", "d5", "Nc3", "Nf6"] },
    { eco: "C15", name: "French: Winawer Variation", line: ["e4", "e6", "d4", "d5", "Nc3", "Bb4"] },
    
    // Caro-Kann (1.e4 c6)
    { eco: "B10", name: "Caro-Kann Defense", line: ["e4", "c6"] },
    { eco: "B12", name: "Caro-Kann: Advance Variation", line: ["e4", "c6", "d4", "d5", "e5"] },
    { eco: "B13", name: "Caro-Kann: Exchange Variation", line: ["e4", "c6", "d4", "d5", "exd5", "cxd5"] },
    { eco: "B14", name: "Caro-Kann: Panov-Botvinnik", line: ["e4", "c6", "d4", "d5", "exd5", "cxd5", "c4"] },
    { eco: "B17", name: "Caro-Kann: Steinitz Variation", line: ["e4", "c6", "d4", "d5", "Nc3", "dxe4", "Nxe4", "Nd7"] },
    { eco: "B18", name: "Caro-Kann: Classical Variation", line: ["e4", "c6", "d4", "d5", "Nc3", "dxe4", "Nxe4", "Bf5"] },
    
    // Scandinavian (1.e4 d5)
    { eco: "B01", name: "Scandinavian Defense", line: ["e4", "d5"] },
    { eco: "B01", name: "Scandinavian: Modern", line: ["e4", "d5", "exd5", "Nf6"] },
    { eco: "B01", name: "Scandinavian: Qxd5", line: ["e4", "d5", "exd5", "Qxd5"] },
    
    // Other e4 Defenses
    { eco: "B02", name: "Alekhine's Defense", line: ["e4", "Nf6"] },
    { eco: "B06", name: "Modern Defense", line: ["e4", "g6"] },
    { eco: "B07", name: "Pirc Defense", line: ["e4", "d6", "d4", "Nf6"] },
    
    // Queen's Pawn (1.d4)
    { eco: "A40", name: "Queen's Pawn Game", line: ["d4"] },
    { eco: "D00", name: "Queen's Pawn Game", line: ["d4", "d5"] },
    { eco: "D02", name: "London System", line: ["d4", "d5", "Nf3", "Nf6", "Bf4"] },
    { eco: "D06", name: "Queen's Gambit", line: ["d4", "d5", "c4"] },
    { eco: "D10", name: "QGD: Slav Defense", line: ["d4", "d5", "c4", "c6"] },
    { eco: "D20", name: "Queen's Gambit Accepted", line: ["d4", "d5", "c4", "dxc4"] },
    { eco: "D30", name: "Queen's Gambit Declined", line: ["d4", "d5", "c4", "e6"] },
    { eco: "D35", name: "QGD: Exchange Variation", line: ["d4", "d5", "c4", "e6", "Nc3", "Nf6", "cxd5"] },
    { eco: "D37", name: "QGD: 5.Bf4", line: ["d4", "d5", "c4", "e6", "Nc3", "Nf6", "Bf4"] },
    
    // Indian Systems
    { eco: "E00", name: "Indian Game", line: ["d4", "Nf6", "c4"] },
    { eco: "E12", name: "Queen's Indian Defense", line: ["d4", "Nf6", "c4", "e6", "Nf3", "b6"] },
    { eco: "E20", name: "Nimzo-Indian Defense", line: ["d4", "Nf6", "c4", "e6", "Nc3", "Bb4"] },
    { eco: "E60", name: "King's Indian Defense", line: ["d4", "Nf6", "c4", "g6"] },
    { eco: "E70", name: "King's Indian: Four Pawns", line: ["d4", "Nf6", "c4", "g6", "Nc3", "Bg7", "e4", "d6", "f4"] },
    { eco: "E80", name: "King's Indian: Samisch", line: ["d4", "Nf6", "c4", "g6", "Nc3", "Bg7", "e4", "d6", "f3"] },
    { eco: "E90", name: "King's Indian: Classical", line: ["d4", "Nf6", "c4", "g6", "Nc3", "Bg7", "e4", "d6", "Nf3"] },
    { eco: "A80", name: "Dutch Defense", line: ["d4", "f5"] },
    { eco: "A56", name: "Benoni Defense", line: ["d4", "Nf6", "c4", "c5"] },
    { eco: "A57", name: "Benko Gambit", line: ["d4", "Nf6", "c4", "c5", "d5", "b5"] },
    { eco: "E10", name: "Blumenfeld Gambit", line: ["d4", "Nf6", "c4", "e6", "Nf3", "c5", "d5", "b5"] },
    
    // English Opening (1.c4)
    { eco: "A20", name: "English Opening", line: ["c4"] },
    { eco: "A25", name: "English: Sicilian Reversed", line: ["c4", "e5", "Nc3", "Nc6"] },
    { eco: "A30", name: "English: Symmetrical", line: ["c4", "c5"] },
    
    // Flank Openings
    { eco: "A04", name: "Reti Opening", line: ["Nf3"] },
    { eco: "A06", name: "Reti: Old Indian Attack", line: ["Nf3", "d5", "g3"] },
    { eco: "A09", name: "Reti Accepted", line: ["Nf3", "d5", "c4"] },
    { eco: "A00", name: "Grob's Attack", line: ["g4"] },
    { eco: "A01", name: "Larsen's Opening", line: ["b3"] },
    { eco: "A00", name: "Sokolsky Opening", line: ["b4"] }
];

// ============================================================================
// UI HELPERS
// ============================================================================

// Scroll terminal to bottom - call after adding content
function scrollToBottom() {
    if (!out) return;
    requestAnimationFrame(() => {
        out.scrollTop = out.scrollHeight;
    });
}

function print(text, cls = "line") {
    const div = document.createElement("div");
    div.className = cls;
    div.textContent = text;
    out.appendChild(div);
    scrollToBottom();
}

function printBlock(text, cls = "line") {
    const pre = document.createElement("pre");
    pre.className = cls;
    pre.textContent = text;
    out.appendChild(pre);
    scrollToBottom();
}

function clearOutput() {
    out.innerHTML = "";
}

function setChips() {
    if (!quickChips) return;
    quickChips.innerHTML = "";
    QUICK.forEach((q) => {
        const b = document.createElement("button");
        b.className = "chip";
        b.textContent = q.label;
        b.onclick = () => {
            cmdInput.value = q.cmd;
            runCommand();
        };
        quickChips.appendChild(b);
    });
}

// ============================================================================
// CLIPBOARD INTEGRATION
// ============================================================================

async function copyToClipboard(text, successMsg = "Copied to clipboard!") {
    try {
        await navigator.clipboard.writeText(text);
        showToast(successMsg);
        return true;
    } catch (err) {
        showToast("Failed to copy to clipboard", true);
        return false;
    }
}

function showToast(message, isError = false) {
    // Remove existing toast
    const existing = document.querySelector(".copy-toast");
    if (existing) existing.remove();
    
    const toast = document.createElement("div");
    toast.className = `copy-toast${isError ? " error" : ""}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = "0";
        toast.style.transform = "translateX(-50%) translateY(20px)";
        setTimeout(() => toast.remove(), 300);
    }, 2000);
}

// ============================================================================
// SUGGESTION LIST (Autocomplete)
// ============================================================================

function mountSuggestPortal() {
    if (suggestPortalMounted) return;
    document.body.appendChild(suggestList);
    suggestPortalMounted = true;
}

function ensureBackdrop() {
    if (backdropEl) return;
    backdropEl = document.createElement("div");
    backdropEl.className = "suggest-backdrop";
    backdropEl.style.display = "none";
    document.body.appendChild(backdropEl);
    backdropEl.addEventListener("click", () => {
        hideSuggest();
        cmdInput.focus();
    });
}

function positionSuggest() {
    const rect = cmdInput.getBoundingClientRect();
    const width = Math.round(rect.width);
    const listHeight = suggestList.offsetHeight || 200;
    
    // Position ABOVE the input field so it doesn't block typing
    const spaceAbove = rect.top;
    const spaceBelow = window.innerHeight - rect.bottom;
    
    if (spaceAbove > listHeight || spaceAbove > spaceBelow) {
        // Position above input
        suggestList.style.bottom = (window.innerHeight - rect.top + 6) + "px";
        suggestList.style.top = "auto";
    } else {
        // Position below input (fallback)
        suggestList.style.top = Math.round(rect.bottom + window.scrollY + 6) + "px";
        suggestList.style.bottom = "auto";
    }
    
    suggestList.style.left = Math.round(rect.left + window.scrollX) + "px";
    suggestList.style.width = Math.max(width, 280) + "px";
}

function hideSuggest() {
    suggestList.style.display = "none";
    suggestIdx = -1;
    if (backdropEl) backdropEl.style.display = "none";
}

function showSuggest(prefix) {
    mountSuggestPortal();
    ensureBackdrop();
    
    const list = COMMANDS.filter(
        (c) => c.startsWith(prefix.trim()) || c.includes(prefix.trim())
    ).slice(0, 12);
    
    if (!prefix || list.length === 0) {
        hideSuggest();
        suggestList.innerHTML = "";
        return;
    }
    
    suggestList.innerHTML = "";
    suggestIdx = -1;
    
    for (let i = 0; i < list.length; i++) {
        const item = list[i];
        const div = document.createElement("div");
        div.className = "s-item";
        div.textContent = item;
        div.dataset.index = i;
        div.onclick = () => {
            cmdInput.value = item.replace(/\s+\[.*?\]$/, "").replace(/<[^>]+>/g, "");
            hideSuggest();
            cmdInput.focus();
        };
        suggestList.appendChild(div);
    }
    
    positionSuggest();
    suggestList.style.display = "block";
    backdropEl.style.display = "block";
}

function updateSuggestSelection() {
    const items = suggestList.querySelectorAll(".s-item");
    items.forEach((item, i) => {
        if (i === suggestIdx) {
            item.classList.add("active");
            item.scrollIntoView({ block: "nearest" });
        } else {
            item.classList.remove("active");
        }
    });
}

function navigateSuggest(direction) {
    const items = suggestList.querySelectorAll(".s-item");
    if (items.length === 0) return false;
    
    if (direction === "down") {
        suggestIdx = (suggestIdx + 1) % items.length;
    } else if (direction === "up") {
        suggestIdx = suggestIdx <= 0 ? items.length - 1 : suggestIdx - 1;
    }
    
    updateSuggestSelection();
    return true;
}

function selectCurrentSuggestion() {
    const items = suggestList.querySelectorAll(".s-item");
    if (suggestIdx >= 0 && suggestIdx < items.length) {
        const item = items[suggestIdx];
        cmdInput.value = item.textContent.replace(/\s+\[.*?\]$/, "").replace(/<[^>]+>/g, "");
        hideSuggest();
        return true;
    }
    return false;
}

// Scroll/Resize handlers
window.addEventListener("scroll", () => {
    if (suggestList.style.display === "block") positionSuggest();
}, { passive: true });

window.addEventListener("resize", () => {
    if (suggestList.style.display === "block") positionSuggest();
});

// ============================================================================
// THEME TOGGLE
// ============================================================================

function initTheme() {
    const savedTheme = localStorage.getItem("chess-theme") || "dark";
    document.documentElement.setAttribute("data-theme", savedTheme);
    updateThemeIcon();
}

function toggleTheme() {
    const current = document.documentElement.getAttribute("data-theme") || "dark";
    const next = current === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("chess-theme", next);
    updateThemeIcon();
}

function updateThemeIcon() {
    const toggle = document.getElementById("themeToggle");
    if (!toggle) return;
    
    const theme = document.documentElement.getAttribute("data-theme") || "dark";
    const icon = toggle.querySelector(".theme-toggle-icon");
    const label = toggle.querySelector(".theme-toggle-label");
    
    if (icon) icon.textContent = theme === "dark" ? "\uD83C\uDF19" : "\u2600\uFE0F";
    if (label) label.textContent = theme === "dark" ? "Dark" : "Light";
}

// ============================================================================
// CHESS BOARD RENDERING (HTML Grid with Terminal Aesthetics)
// ============================================================================

function getPieceChar(piece) {
    if (!piece) return "";
    
    if (useUnicodePieces) {
        const set = piece.color === "w" ? UNICODE_PIECES.white : UNICODE_PIECES.black;
        return set[piece.type] || "?";
    } else {
        const set = piece.color === "w" ? ASCII_PIECES.white : ASCII_PIECES.black;
        return set[piece.type] || "?";
    }
}

function getPieceColor(piece) {
    if (!piece) return null;
    return piece.color;
}

// Render HTML Grid Board - Terminal Style
function renderHtmlBoard() {
    const b = game.board();
    const files = ["a", "b", "c", "d", "e", "f", "g", "h"];
    
    // Create wrapper
    let html = '<div class="chess-board-wrapper">';
    
    // Board with rank labels
    html += '<div class="board-with-ranks">';
    
    // Rank labels column
    html += '<div class="rank-labels">';
    for (let r = 0; r < 8; r++) {
        const rank = 8 - r;
        html += `<div class="rank-label">${rank}</div>`;
    }
    html += '</div>';
    
    // The 8x8 grid
    html += '<div class="chess-board-grid">';
    
    for (let r = 0; r < 8; r++) {
        for (let f = 0; f < 8; f++) {
            const sq = b[r][f];
            const piece = getPieceChar(sq);
            const pieceColor = getPieceColor(sq);
            const rank = 8 - r;
            const file = files[f];
            
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
            
            html += `<div class="sq ${sqColorClass} ${pieceClass}" data-square="${file}${rank}" data-rank="${rank}" data-file="${file}">${piece}</div>`;
        }
    }
    
    html += '</div>'; // .chess-board-grid
    html += '</div>'; // .board-with-ranks
    
    // File labels row
    html += '<div class="file-labels">';
    html += '<div class="file-label"></div>'; // Empty corner
    for (let f = 0; f < 8; f++) {
        html += `<div class="file-label">${files[f]}</div>`;
    }
    html += '</div>';
    
    html += '</div>'; // .chess-board-wrapper
    
    return html;
}

// Legacy ASCII board (kept for text output in terminal)
function asciiBoard() {
    const b = game.board();
    let outStr = "";
    
    const cellWidth = 5;
    const cellSep = "-".repeat(cellWidth);
    const horizLine = "   +" + (cellSep + "+").repeat(8) + "\n";
    
    outStr += horizLine;
    
    for (let r = 0; r < 8; r++) {
        const rankLabel = 8 - r;
        let line = " " + rankLabel + " |";
        
        for (let f = 0; f < 8; f++) {
            const sq = b[r][f];
            const piece = sq ? getPieceChar(sq) : ".";
            line += "  " + piece + "  |";
        }
        
        outStr += line + "\n";
        outStr += horizLine;
    }
    
    const files = ["a", "b", "c", "d", "e", "f", "g", "h"];
    let fileRow = "   ";
    for (let i = 0; i < 8; i++) {
        fileRow += "   " + files[i] + "  ";
    }
    outStr += fileRow + "\n";
    
    return outStr;
}

// ============================================================================
// OPENING DETECTION
// ============================================================================

function detectOpening() {
    const san = game.history();
    if (!san || san.length === 0) return null;
    
    let best = null;
    
    for (const o of OPENINGS) {
        if (san.length < o.line.length) continue;
        
        let ok = true;
        for (let i = 0; i < o.line.length; i++) {
            if (san[i] !== o.line[i]) {
                ok = false;
                break;
            }
        }
        
        if (ok && (!best || o.line.length > best.line.length)) {
            best = o;
        }
    }
    
    // Fallback: partial match
    if (!best) {
        for (const o of OPENINGS) {
            let matchLen = 0;
            for (let i = 0; i < Math.min(o.line.length, san.length); i++) {
                if (san[i] === o.line[i]) matchLen++;
                else break;
            }
            if (matchLen > 0 && (!best || matchLen > best.matchLen)) {
                best = { ...o, matchLen };
            }
        }
    }
    
    return best;
}

// ============================================================================
// STATUS DISPLAY (Enhanced)
// ============================================================================

function getCastleRights() {
    const fen = game.fen();
    const parts = fen.split(" ");
    const castling = parts[2] || "-";
    
    const rights = [];
    if (castling.includes("K")) rights.push("White O-O");
    if (castling.includes("Q")) rights.push("White O-O-O");
    if (castling.includes("k")) rights.push("Black O-O");
    if (castling.includes("q")) rights.push("Black O-O-O");
    
    return rights.length > 0 ? rights.join(", ") : "None";
}

function formatEval(score) {
    if (typeof score !== "number") return "N/A";
    const val = (score / 100).toFixed(2);
    return score >= 0 ? "+" + val : val;
}

function printStatus(reason = "") {
    const turn = game.turn() === "w" ? "White" : "Black";
    const header = `Turn: ${turn}` + (reason ? ` - ${reason}` : "");
    print(header, "line info");
    updateBoardView();
    
    const opening = detectOpening();
    if (opening) {
        print(`Opening: ${opening.name} (${opening.eco})`, "line muted");
    }
    
    if (game.in_checkmate()) {
        const winner = game.turn() === "w" ? "Black" : "White";
        print(`Checkmate! Winner: ${winner}`, "line err");
    } else if (game.in_stalemate()) {
        print("Stalemate - Draw.", "line warn");
    } else if (game.in_draw()) {
        print("Draw.", "line warn");
    } else if (game.in_check()) {
        print(`${turn} is in check!`, "line warn");
    }
}

function printEnhancedStatus() {
    print("=== Board Status ===", "line info");
    
    const turn = game.turn() === "w" ? "White" : "Black";
    print(`Turn: ${turn}`, "line");
    
    // Get search info from bot
    let searchInfo = null;
    if (typeof getSearchInfo === "function") {
        searchInfo = getSearchInfo();
    }
    
    // Eval and depth
    if (searchInfo && searchInfo.depth > 0) {
        print(`Eval: ${formatEval(searchInfo.score)} (depth ${searchInfo.depth})`, "line");
        
        if (searchInfo.bestLine && searchInfo.bestLine.length > 0) {
            const lineStr = searchInfo.bestLine.slice(0, 5).join(" ");
            print(`Best Line: ${lineStr}`, "line muted");
        }
    } else {
        // Quick eval without search
        if (game && typeof evaluateBoard === "function") {
            const board = game.board();
            const score = evaluateBoard(board, game.turn(), game);
            print(`Quick Eval: ${formatEval(score)}`, "line");
        }
    }
    
    // Castle rights
    print(`Castling: ${getCastleRights()}`, "line");
    
    // Opening
    const opening = detectOpening();
    if (opening) {
        print(`Opening: ${opening.name} (${opening.eco})`, "line");
    }
    
    // Move count
    const moveCount = Math.ceil(game.history().length / 2);
    print(`Moves: ${moveCount}`, "line");
    
    // Game state
    if (game.in_checkmate()) {
        const winner = game.turn() === "w" ? "Black" : "White";
        print(`Status: Checkmate! ${winner} wins.`, "line err");
    } else if (game.in_stalemate()) {
        print("Status: Stalemate - Draw", "line warn");
    } else if (game.in_draw()) {
        print("Status: Draw", "line warn");
    } else if (game.in_check()) {
        print(`Status: ${turn} is in check!`, "line warn");
    } else {
        print("Status: In progress", "line ok");
    }
    
    updateBoardView();
}

// ============================================================================
// VALIDATORS
// ============================================================================

function isSquare(s) {
    return /^[a-h][1-8]$/.test(s);
}

function mapPiece(p) {
    const k = (p || "").toLowerCase();
    return PIECE_MAP[k] || null;
}

function parse(input) {
    const raw = input.trim();
    const tokens = raw.split(/\s+/);
    return { raw, tokens };
}

function ensureNotResigned() {
    if (resigned) {
        print("Game ended by resignation. Use 'board reset' to start a new game.", "line warn");
        return false;
    }
    return true;
}

// ============================================================================
// COMMAND HANDLERS
// ============================================================================

const handlers = {
    "board status": () => {
        printEnhancedStatus();
    },
    
    "board help": () => {
        const help = [
            "=== Terminal Chess Commands ===",
            "",
            "Movement:",
            "  board move <from> <to> [promo]  - Move piece (e.g., board move e2 e4)",
            "  board move <piece> <from> <to>  - Move with piece name",
            "  board moves [from]              - List all/from-square moves",
            "  board legal [from]              - Detailed legal moves",
            "  board undo / board redo         - Undo/redo moves",
            "",
            "Game Control:",
            "  board status                    - Show detailed status (eval, depth, best line)",
            "  board turn                      - Show current turn",
            "  board reset / board new         - Start new game",
            "  board resign                    - Resign current game",
            "",
            "Export (auto-copies to clipboard):",
            "  board fen                       - Show/copy FEN",
            "  board pgn                       - Show/copy PGN",
            "  board save [name]               - Save to localStorage",
            "  board load [name]               - Load from localStorage",
            "",
            "Bot Commands:",
            "  board bot autoplay [delay]      - Bot plays both sides",
            "  board bot enter [white|black]   - Bot plays one side",
            "  board bot stop                  - Stop bot",
            "  board bot best                  - Make one best move",
            "  board bot random                - Make random move",
            "  board bot depth <n>             - Set search depth (1-12)",
            "",
            "Keyboard Shortcuts:",
            "  Enter     - Execute command",
            "  Tab       - Autocomplete",
            "  Up/Down   - Navigate suggestions (when visible) or history",
            "  Escape    - Close suggestions",
            "",
            "Bot Features:",
            "  - PeSTO evaluation with middlegame/endgame interpolation",
            "  - Alpha-beta with iterative deepening",
            "  - Transposition table with Zobrist-like hashing",
            "  - Quiescence search for tactical accuracy",
            "  - Move ordering: MVV-LVA, killers, history heuristic"
        ].join("\n");
        printBlock(help, "line muted");
    },
    
    "board turn": () => {
        const t = game.turn() === "w" ? "White" : "Black";
        print(`Turn: ${t}`, "line info");
        updateBoardView();
    },
    
    "board fen": () => {
        const fen = game.fen();
        print(fen, "line muted");
        copyToClipboard(fen, "FEN copied to clipboard!");
    },
    
    "board pgn": () => {
        const pgn = game.pgn({ max_width: 80 }) || "(No moves yet)";
        print(pgn, "line muted");
        copyToClipboard(pgn, "PGN copied to clipboard!");
    },
    
    "board reset": () => {
        game.reset();
        redoStack.length = 0;
        resigned = false;
        botActive = false;
        autoplayMode = false;
        botThinking = false;
        gameStartTime = null;
        if (typeof TT !== "undefined") TT.clear();
        if (typeof HISTORY !== "undefined") HISTORY.clear();
        print("Game reset. Bot stopped.", "line ok");
        printStatus("New game");
        updateBoardView();
    },
    
    "board new": () => {
        handlers["board reset"]();
    },
    
    "board undo": () => {
        if (!ensureNotResigned()) return;
        const mv = game.undo();
        if (!mv) {
            print("Nothing to undo.", "line warn");
            return;
        }
        redoStack.push(mv);
        print(`Undo: ${mv.san || mv.from + "-" + mv.to}`, "line info");
        printStatus("After undo");
        updateBoardView();
    },
    
    "board redo": () => {
        if (!ensureNotResigned()) return;
        const mv = redoStack.pop();
        if (!mv) {
            print("Nothing to redo.", "line warn");
            return;
        }
        const applied = game.move({
            from: mv.from,
            to: mv.to,
            promotion: mv.promotion || "q"
        });
        if (!applied) {
            print("Cannot redo (move invalid in current state).", "line err");
            return;
        }
        print(`Redo: ${applied.san || applied.from + "-" + applied.to}`, "line info");
        printStatus("After redo");
        updateBoardView();
    },
    
    "board moves": (args) => {
        if (args.length === 0) {
            const moves = game.moves({ verbose: true });
            if (moves.length === 0) {
                print("No legal moves.", "line warn");
                return;
            }
            const list = moves.map((m) => 
                `${m.from}-${m.to}${m.promotion ? `=${m.promotion}` : ""} (${m.san})`
            ).join(", ");
            printBlock(list, "line muted");
            return;
        }
        
        const from = args[0];
        if (!isSquare(from)) {
            print("Invalid square. Use format a1-h8.", "line err");
            return;
        }
        
        const moves = game.moves({ square: from, verbose: true });
        if (moves.length === 0) {
            print(`No moves from ${from}.`, "line warn");
            return;
        }
        
        const list = moves.map((m) => 
            `${m.from}-${m.to}${m.promotion ? `=${m.promotion}` : ""} (${m.san})`
        ).join(", ");
        printBlock(list, "line muted");
    },
    
    "board legal": (args) => {
        const opt = {};
        if (args.length > 0) {
            const from = args[0];
            if (!isSquare(from)) {
                print("Invalid square. Use format a1-h8.", "line err");
                return;
            }
            opt.square = from;
        }
        
        const moves = game.moves({ verbose: true, ...opt });
        if (moves.length === 0) {
            print("No legal moves.", "line warn");
            return;
        }
        
        const lines = moves.map((m) => {
            const piece = m.color === "w" ? m.piece.toUpperCase() : m.piece;
            const cap = m.captured ? `x${m.captured}` : "";
            return `${piece} ${m.from}-${m.to}${cap} ${m.flags || ""} ${m.san || ""}`.trim();
        }).join("\n");
        printBlock(lines, "line muted");
    },
    
    "board save": (args) => {
        const name = (args[0] || "default").toLowerCase();
        try {
            localStorage.setItem("chess.save." + name, game.fen());
            print(`Saved as '${name}'`, "line ok");
        } catch (e) {
            print("Error saving to localStorage.", "line err");
        }
    },
    
    "board load": (args) => {
        if (!ensureNotResigned()) return;
        const name = (args[0] || "default").toLowerCase();
        try {
            const fen = localStorage.getItem("chess.save." + name);
            if (!fen) {
                print(`Save '${name}' not found.`, "line warn");
                return;
            }
            const ok = game.load(fen);
            redoStack.length = 0;
            if (!ok) {
                print("Invalid FEN.", "line err");
                return;
            }
            print(`Loaded '${name}'`, "line ok");
            printStatus("After load");
        } catch (e) {
            print("Error loading from localStorage.", "line err");
        }
        updateBoardView();
    },
    
    "board move": (args) => {
        if (!ensureNotResigned()) return;
        
        if (args.length < 2) {
            print("Syntax: board move <from> <to> [promotion]", "line err");
            return;
        }
        
        let piece = null, from, to, promo = null;
        
        // Syntax 1: board move <piece> <from> <to>
        if (args.length >= 3 && !isSquare(args[0]) && isSquare(args[1]) && isSquare(args[2])) {
            piece = mapPiece(args[0]);
            from = args[1];
            to = args[2];
            promo = args[3] ? mapPiece(args[3]) || args[3] : null;
        }
        // Syntax 2: board move <from> <to>
        else if (isSquare(args[0]) && isSquare(args[1])) {
            from = args[0];
            to = args[1];
            promo = args[2] ? mapPiece(args[2]) || args[2] : null;
        } else {
            print("Invalid syntax. Example: board move e2 e4", "line err");
            return;
        }
        
        // Validate piece if specified
        if (piece) {
            const sq = game.get(from);
            if (!sq) {
                print(`No piece at ${from}.`, "line err");
                return;
            }
            if (sq.type !== piece) {
                const expect = sq.color === "w" ? sq.type.toUpperCase() : sq.type;
                print(`Piece mismatch at ${from}. Found: ${expect}`, "line err");
                return;
            }
        }
        
        // Auto-promote to queen if needed
        const isPawnPromo = (() => {
            const sq = game.get(from);
            if (!sq || sq.type !== "p") return false;
            const destRank = parseInt(to[1], 10);
            return (sq.color === "w" && destRank === 8) || (sq.color === "b" && destRank === 1);
        })();
        if (isPawnPromo && !promo) promo = "q";
        
        const mv = game.move({ from, to, promotion: promo || undefined });
        if (!mv) {
            print("Illegal move.", "line err");
            return;
        }
        
        redoStack.length = 0;
        print(`Move: ${mv.san || from + "-" + to}`, "line ok");
        printStatus("After move");
        updateBoardView();
        
        // Trigger bot if active
        if (botActive && !game.game_over()) {
            setTimeout(makeBotMove, 300);
        }
    },
    
    "board resign": () => {
        if (resigned) {
            print("Already resigned. Use 'board reset' to start new game.", "line warn");
            return;
        }
        resigned = true;
        const quitter = game.turn() === "w" ? "White" : "Black";
        const winner = game.turn() === "w" ? "Black" : "White";
        print(`${quitter} resigns. ${winner} wins!`, "line err");
        updateBoardView();
    },
    
    "board bot": (args) => {
        if (!ensureNotResigned()) return;
        
        const mode = (args[0] || "best").toLowerCase();
        
        if (mode === "play" || mode === "enter") {
            const sideArg = (args[1] || "").toLowerCase();
            let side = game.turn();
            
            if (sideArg === "white" || sideArg === "w") side = "w";
            else if (sideArg === "black" || sideArg === "b") side = "b";
            
            botSide = side;
            botActive = true;
            autoplayMode = false;
            botThinking = false;
            gameStartTime = Date.now();
            
            print(`Bot enters as ${side === "w" ? "White" : "Black"}`, "line ok");
            makeBotMove();
            return;
        }
        
        if (mode === "autoplay") {
            botSide = "both";
            botActive = true;
            autoplayMode = true;
            botThinking = false;
            gameStartTime = Date.now();
            moveDelay = parseInt(args[1]) || 1000;
            
            print(`Autoplay started (${moveDelay}ms delay). Use 'board bot stop' to end.`, "line ok");
            makeBotMove();
            return;
        }
        
        if (mode === "stop") {
            if (botActive || autoplayMode) {
                const wasAutoplay = autoplayMode;
                botActive = false;
                autoplayMode = false;
                botThinking = false;
                const elapsed = gameStartTime ? Math.round((Date.now() - gameStartTime) / 1000) : 0;
                print(`${wasAutoplay ? "Autoplay" : "Bot"} stopped after ${elapsed}s`, "line info");
            } else {
                print("Bot is not active.", "line warn");
            }
            return;
        }
        
        if (mode === "depth") {
            const d = Math.max(1, Math.min(12, parseInt(args[1] || "8", 10)));
            botDepth = d;
            print(`Bot depth set to ${d}`, "line info");
            return;
        }
        
        if (mode === "random") {
            const ms = game.moves({ verbose: true });
            if (ms.length === 0) {
                print("No legal moves.", "line warn");
                return;
            }
            const rand = ms[Math.floor(Math.random() * ms.length)];
            const applied = game.move(rand);
            redoStack.length = 0;
            print(`Random: ${applied.san}`, "line info");
            printStatus("After random move");
            updateBoardView();
            return;
        }
        
        // Default: make one best move
        const mv = getBestMove(game, botDepth);
        if (!mv) {
            print("Bot couldn't find a move.", "line err");
            return;
        }
        const applied = game.move(mv);
        redoStack.length = 0;
        print(`Bot: ${applied.san}`, "line info");
        printStatus(`Bot (depth ${botDepth})`);
        updateBoardView();
    }
};

// ============================================================================
// COMMAND DISPATCHER
// ============================================================================

function dispatch(input) {
    const { tokens } = parse(input);
    if (tokens.length === 0) return;
    
    if (!game) {
        print("Game not initialized. Please wait or reload.", "line warn");
        return;
    }
    
    const key = (tokens[0] || "").toLowerCase();
    if (key !== "board") {
        print("Commands start with 'board'. Type 'board help' for help.", "line warn");
        return;
    }
    
    const sub = (tokens[1] || "").toLowerCase();
    const args = tokens.slice(2);
    
    const map = {
        status: "board status",
        help: "board help",
        turn: "board turn",
        fen: "board fen",
        pgn: "board pgn",
        reset: "board reset",
        new: "board new",
        undo: "board undo",
        redo: "board redo",
        moves: "board moves",
        legal: "board legal",
        save: "board save",
        load: "board load",
        move: "board move",
        resign: "board resign",
        bot: "board bot"
    };
    
    const full = map[sub];
    if (!full) {
        print(`Unknown command: ${sub}. Type 'board help' for help.`, "line err");
        return;
    }
    
    const fn = handlers[full];
    try {
        fn(args);
    } catch (e) {
        print("Error executing command.", "line err");
        console.error(e);
    }
}

// ============================================================================
// INPUT HANDLING
// ============================================================================

function runCommand() {
    const val = cmdInput.value.trim();
    if (!val) return;
    
    print("> " + val, "line");
    history.push(val);
    histIdx = history.length;
    
    dispatch(val);
    
    cmdInput.value = "";
    hideSuggest();
}

// Keyboard event handling
cmdInput.addEventListener("keydown", (e) => {
    const suggestVisible = suggestList.style.display === "block";
    const items = suggestList.querySelectorAll(".s-item");
    
    // Enter
    if (e.key === "Enter") {
        e.preventDefault();
        
        // If suggestion is selected, use it
        if (suggestVisible && suggestIdx >= 0) {
            selectCurrentSuggestion();
            return;
        }
        
        runCommand();
        return;
    }
    
    // Tab autocomplete
    if (e.key === "Tab") {
        e.preventDefault();
        
        if (suggestVisible && items.length > 0) {
            if (suggestIdx < 0) suggestIdx = 0;
            selectCurrentSuggestion();
        } else {
            const prefix = cmdInput.value.trim();
            const list = COMMANDS.filter(c => c.startsWith(prefix) || c.includes(prefix));
            if (list.length > 0) {
                cmdInput.value = list[0].replace(/\s+\[.*?\]$/, "").replace(/<[^>]+>/g, "");
                showSuggest(cmdInput.value);
            }
        }
        return;
    }
    
    // Arrow Up/Down - Navigate suggestions OR history
    if (e.key === "ArrowUp") {
        e.preventDefault();
        
        // If suggestions visible, navigate them
        if (suggestVisible && items.length > 0) {
            navigateSuggest("up");
            return;
        }
        
        // Otherwise, navigate command history
        if (history.length === 0) return;
        histIdx = Math.max(0, histIdx - 1);
        cmdInput.value = history[histIdx] || "";
        return;
    }
    
    if (e.key === "ArrowDown") {
        e.preventDefault();
        
        // If suggestions visible, navigate them
        if (suggestVisible && items.length > 0) {
            navigateSuggest("down");
            return;
        }
        
        // Otherwise, navigate command history
        if (history.length === 0) return;
        histIdx = Math.min(history.length, histIdx + 1);
        cmdInput.value = history[histIdx] || "";
        return;
    }
    
    // Escape
    if (e.key === "Escape") {
        hideSuggest();
    }
});

cmdInput.addEventListener("input", (e) => {
    showSuggest(e.target.value);
});

// Click handlers
document.addEventListener("click", (e) => {
    if (suggestList.style.display !== "block") return;
    const withinInput = cmdInput.contains(e.target);
    const withinSuggest = suggestList.contains(e.target);
    if (!withinInput && !withinSuggest) {
        hideSuggest();
    }
});

// Button handlers
if (runBtn) runBtn.addEventListener("click", runCommand);
if (clearBtn) clearBtn.addEventListener("click", clearOutput);

// ============================================================================
// BOARD VIEW UPDATE
// ============================================================================

function renderBoardPanel() {
    const container = document.getElementById("boardContainer");
    const meta = document.getElementById("boardMeta");
    if (!container || !game) return;
    
    // Render HTML grid board
    container.innerHTML = renderHtmlBoard();
    
    const opening = detectOpening();
    const turn = game.turn() === "w" ? "White" : "Black";
    
    // Get search info
    let evalStr = "";
    if (typeof getSearchInfo === "function") {
        const info = getSearchInfo();
        if (info && info.depth > 0) {
            evalStr = `Eval: ${formatEval(info.score)}`;
        }
    }
    
    const botStatus = botActive
        ? autoplayMode
            ? `Autoplay${botThinking ? " (thinking...)" : ""}`
            : `Bot: ${botSide === "w" ? "White" : "Black"}${botThinking ? " (thinking...)" : ""}`
        : null;
    
    const gameStatus = game.in_checkmate()
        ? "Checkmate!"
        : game.in_stalemate()
            ? "Stalemate"
            : game.in_draw()
                ? "Draw"
                : game.in_check()
                    ? `${turn} in check`
                    : null;
    
    const statusParts = [
        `Turn: ${turn}`,
        evalStr,
        botStatus,
        opening ? `${opening.name} (${opening.eco})` : null,
        gameStatus
    ].filter(Boolean);
    
    if (meta) {
        meta.textContent = statusParts.join(" | ");
    }
}

function updateBoardView() {
    renderBoardPanel();
}

// ============================================================================
// INITIALIZATION
// ============================================================================

function banner() {
    const lines = [
        "Terminal Chess - Enhanced Bot Engine",
        "",
        "Type 'board help' for commands.",
        "Examples:",
        "  - board status",
        "  - board move e2 e4",
        "  - board bot autoplay"
    ].join("\n");
    printBlock(lines, "line muted");
    printStatus("New game");
}

function initApp() {
    // Theme
    initTheme();
    
    // Theme toggle
    const toggle = document.getElementById("themeToggle");
    if (toggle) {
        toggle.addEventListener("click", toggleTheme);
    }
    
    // Check for chess.js
    const ChessCtor = typeof window.Chess === "function"
        ? window.Chess
        : window.Chess && typeof window.Chess.Chess === "function"
            ? window.Chess.Chess
            : typeof Chess === "function"
                ? Chess
                : null;
    
    if (!ChessCtor) {
        print("chess.js failed to load. Check network/CDN.", "line err");
        return;
    }
    
    game = new ChessCtor();
    
    setChips();
    updateBoardView();
    banner();
}

// Start the app
initApp();
