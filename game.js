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

// ---- Bot Configuration ----
let botThinkTime = 5000; // Default 5 seconds thinking time limit
const DEFAULT_BOT_DEPTH = 8;
const DEFAULT_BOT_THINK_TIME = 5000;

// ---- Move Sound ----
let moveSound = null;
let captureSound = null;
function initSounds() {
    // Create move sound using AudioContext
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        
        // Move sound function
        moveSound = () => {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.frequency.value = 600;
            osc.type = 'sine';
            gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
            gain.gain.exponentialDecayTo = 0.001;
            gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);
            osc.start(audioCtx.currentTime);
            osc.stop(audioCtx.currentTime + 0.1);
        };
        
        // Capture sound function
        captureSound = () => {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.frequency.value = 400;
            osc.type = 'triangle';
            gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);
            osc.start(audioCtx.currentTime);
            osc.stop(audioCtx.currentTime + 0.15);
        };
    } catch (e) {
        console.warn("Audio not supported:", e);
        moveSound = null;
        captureSound = null;
    }
}

function playMoveSound(isCapture = false) {
    try {
        if (isCapture && captureSound) {
            captureSound();
        } else if (moveSound) {
            moveSound();
        }
    } catch (e) {
        // Ignore audio errors
    }
}

// ---- Command Definitions (Simplified - no "board" prefix) ----
const COMMANDS = [
    "status",
    "move <from> <to> [promotion]",
    "move <piece> <from> <to> [promotion]",
    "moves [from]",
    "legal [from]",
    "undo",
    "redo",
    "reset",
    "new",
    "turn",
    "fen",
    "pgn",
    "save [name]",
    "load [name]",
    "resign",
    "bot play [white|black]",
    "bot autoplay [delay_ms]",
    "bot stop",
    "bot best",
    "bot random",
    "bot depth <1-10>",
    "bot think <time_ms>",
    "bot reset",
    "bot enter [white|black]",
    "help"
];

// Common move shortcuts for intelligent autocomplete
const MOVE_SHORTCUTS = [
    "e2 e4", "d2 d4", "c2 c4", "g1 f3", "b1 c3", "e2 e3", "d2 d3",
    "e7 e5", "d7 d5", "c7 c5", "g8 f6", "b8 c6", "e7 e6", "d7 d6",
    "f1 c4", "f1 b5", "f8 c5", "f8 b4", "c1 f4", "c8 f5"
];

const QUICK = [
    { label: "status", cmd: "status" },
    { label: "undo", cmd: "undo" },
    { label: "redo", cmd: "redo" },
    { label: "reset", cmd: "reset" },
    { label: "autoplay", cmd: "bot autoplay" },
    { label: "stop", cmd: "bot stop" },
    { label: "fen", cmd: "fen" },
    { label: "pgn", cmd: "pgn" }
];

// ---- Extended Opening Database (More detailed for first moves) ----
const OPENINGS = [
    // === FIRST MOVE OPENINGS (Very detailed) ===
    // 1.e4 - King's Pawn Opening
    { eco: "B00", name: "King's Pawn Opening", line: ["e4"], desc: "The most popular first move. Opens lines for queen and bishop." },
    
    // 1.d4 - Queen's Pawn Opening  
    { eco: "A40", name: "Queen's Pawn Opening", line: ["d4"], desc: "Solid and strategic. Controls center with pawn support." },
    
    // 1.c4 - English Opening
    { eco: "A10", name: "English Opening", line: ["c4"], desc: "Flexible flank opening. Often transposes to d4 openings." },
    
    // 1.Nf3 - Reti Opening
    { eco: "A04", name: "Reti Opening", line: ["Nf3"], desc: "Hypermodern approach. Delays central pawn advance." },
    
    // 1.g3 - King's Fianchetto
    { eco: "A00", name: "King's Fianchetto Opening", line: ["g3"], desc: "Prepares Bg2 for long diagonal control." },
    
    // 1.b3 - Larsen's Opening
    { eco: "A01", name: "Larsen's Opening (Nimzo-Larsen Attack)", line: ["b3"], desc: "Fianchetto queen's bishop. Flexible and unusual." },
    
    // 1.f4 - Bird's Opening
    { eco: "A02", name: "Bird's Opening", line: ["f4"], desc: "Aggressive flank opening controlling e5." },
    
    // 1.b4 - Sokolsky Opening
    { eco: "A00", name: "Sokolsky Opening (Polish)", line: ["b4"], desc: "Rare but tricky. Controls a5 and c5." },
    
    // 1.g4 - Grob's Attack
    { eco: "A00", name: "Grob's Attack", line: ["g4"], desc: "Provocative and risky. Weakens kingside." },
    
    // 1.Nc3 - Van Geet Opening
    { eco: "A00", name: "Van Geet Opening (Dunst)", line: ["Nc3"], desc: "Develops knight, keeps pawn structure flexible." },
    
    // 1.e3 - Van't Kruijs Opening
    { eco: "A00", name: "Van't Kruijs Opening", line: ["e3"], desc: "Modest but solid. Prepares d4." },
    
    // 1.d3 - Mieses Opening
    { eco: "A00", name: "Mieses Opening", line: ["d3"], desc: "Quiet start. Often leads to King's Indian setup." },
    
    // === RESPONSES TO 1.e4 ===
    { eco: "C20", name: "Open Game", line: ["e4", "e5"], desc: "Classical response. Leads to open tactical play." },
    { eco: "B20", name: "Sicilian Defense", line: ["e4", "c5"], desc: "Most popular response. Asymmetrical and fighting." },
    { eco: "C00", name: "French Defense", line: ["e4", "e6"], desc: "Solid and strategic. Prepares d5 counter." },
    { eco: "B10", name: "Caro-Kann Defense", line: ["e4", "c6"], desc: "Solid defense preparing d5 with c6 support." },
    { eco: "B01", name: "Scandinavian Defense", line: ["e4", "d5"], desc: "Immediately challenges e4. Sharp play." },
    { eco: "B02", name: "Alekhine's Defense", line: ["e4", "Nf6"], desc: "Hypermodern. Invites e5 to attack the knight." },
    { eco: "B06", name: "Modern Defense (Robatsch)", line: ["e4", "g6"], desc: "Fianchetto setup. Flexible piece placement." },
    { eco: "B07", name: "Pirc Defense", line: ["e4", "d6"], desc: "Hypermodern. Allows White center, attacks later." },
    { eco: "B00", name: "Owen's Defense", line: ["e4", "b6"], desc: "Rare. Fianchettoes queen's bishop early." },
    { eco: "B00", name: "Nimzowitsch Defense", line: ["e4", "Nc6"], desc: "Unusual knight development. Hypermodern ideas." },
    
    // === RESPONSES TO 1.d4 ===
    { eco: "D00", name: "Queen's Pawn Game", line: ["d4", "d5"], desc: "Classical response. Solid central presence." },
    { eco: "A45", name: "Indian Defense", line: ["d4", "Nf6"], desc: "Flexible. Can lead to many Indian systems." },
    { eco: "A80", name: "Dutch Defense", line: ["d4", "f5"], desc: "Aggressive counter. Controls e4 square." },
    { eco: "A40", name: "Modern Defense vs d4", line: ["d4", "g6"], desc: "Fianchetto setup against queen's pawn." },
    { eco: "A41", name: "Old Indian Defense", line: ["d4", "d6"], desc: "Solid but passive. Prepares e5 break." },
    { eco: "E00", name: "Catalan Opening Declined", line: ["d4", "e6"], desc: "Flexible. Often leads to QGD or Nimzo." },
    { eco: "A43", name: "Benoni Defense (Old)", line: ["d4", "c5"], desc: "Immediate challenge to d4. Dynamic play." },
    
    // === DETAILED CONTINUATIONS ===
    // Open Game continuations
    { eco: "C21", name: "Center Game", line: ["e4", "e5", "d4"] },
    { eco: "C22", name: "Center Game Accepted", line: ["e4", "e5", "d4", "exd4"] },
    { eco: "C25", name: "Vienna Game", line: ["e4", "e5", "Nc3"] },
    { eco: "C30", name: "King's Gambit", line: ["e4", "e5", "f4"] },
    { eco: "C31", name: "King's Gambit Declined", line: ["e4", "e5", "f4", "d5"] },
    { eco: "C33", name: "King's Gambit Accepted", line: ["e4", "e5", "f4", "exf4"] },
    { eco: "C42", name: "Petrov's Defense (Russian)", line: ["e4", "e5", "Nf3", "Nf6"] },
    { eco: "C44", name: "Scotch Game", line: ["e4", "e5", "Nf3", "Nc6", "d4"] },
    { eco: "C45", name: "Scotch Game: Classical", line: ["e4", "e5", "Nf3", "Nc6", "d4", "exd4", "Nxd4"] },
    { eco: "C50", name: "Italian Game", line: ["e4", "e5", "Nf3", "Nc6", "Bc4"] },
    { eco: "C51", name: "Evans Gambit", line: ["e4", "e5", "Nf3", "Nc6", "Bc4", "Bc5", "b4"] },
    { eco: "C53", name: "Giuoco Piano", line: ["e4", "e5", "Nf3", "Nc6", "Bc4", "Bc5"] },
    { eco: "C54", name: "Giuoco Piano: Main Line", line: ["e4", "e5", "Nf3", "Nc6", "Bc4", "Bc5", "c3"] },
    { eco: "C55", name: "Two Knights Defense", line: ["e4", "e5", "Nf3", "Nc6", "Bc4", "Nf6"] },
    { eco: "C57", name: "Fried Liver Attack", line: ["e4", "e5", "Nf3", "Nc6", "Bc4", "Nf6", "Ng5"] },
    { eco: "C60", name: "Ruy Lopez (Spanish)", line: ["e4", "e5", "Nf3", "Nc6", "Bb5"] },
    { eco: "C65", name: "Berlin Defense", line: ["e4", "e5", "Nf3", "Nc6", "Bb5", "Nf6"] },
    { eco: "C70", name: "Morphy Defense", line: ["e4", "e5", "Nf3", "Nc6", "Bb5", "a6"] },
    { eco: "C78", name: "Archangel Variation", line: ["e4", "e5", "Nf3", "Nc6", "Bb5", "a6", "Ba4", "Nf6", "O-O", "b5"] },
    { eco: "C80", name: "Open Variation", line: ["e4", "e5", "Nf3", "Nc6", "Bb5", "a6", "Ba4", "Nf6", "O-O", "Nxe4"] },
    { eco: "C84", name: "Closed Defense", line: ["e4", "e5", "Nf3", "Nc6", "Bb5", "a6", "Ba4", "Nf6", "O-O", "Be7"] },
    
    // Sicilian continuations
    { eco: "B21", name: "Grand Prix Attack", line: ["e4", "c5", "f4"] },
    { eco: "B22", name: "Alapin Variation", line: ["e4", "c5", "c3"] },
    { eco: "B23", name: "Closed Sicilian", line: ["e4", "c5", "Nc3"] },
    { eco: "B27", name: "Sicilian: Accelerated Dragon", line: ["e4", "c5", "Nf3", "g6"] },
    { eco: "B30", name: "Sicilian: Rossolimo", line: ["e4", "c5", "Nf3", "Nc6", "Bb5"] },
    { eco: "B32", name: "Sicilian: Kalashnikov", line: ["e4", "c5", "Nf3", "Nc6", "d4", "cxd4", "Nxd4", "e5"] },
    { eco: "B33", name: "Sicilian: Sveshnikov", line: ["e4", "c5", "Nf3", "Nc6", "d4", "cxd4", "Nxd4", "Nf6", "Nc3", "e5"] },
    { eco: "B40", name: "Sicilian: Pin Variation", line: ["e4", "c5", "Nf3", "e6"] },
    { eco: "B50", name: "Sicilian Defense: Open", line: ["e4", "c5", "Nf3", "d6"] },
    { eco: "B52", name: "Sicilian: Moscow Variation", line: ["e4", "c5", "Nf3", "d6", "Bb5+"] },
    { eco: "B60", name: "Sicilian: Richter-Rauzer", line: ["e4", "c5", "Nf3", "d6", "d4", "cxd4", "Nxd4", "Nf6", "Nc3", "Nc6", "Bg5"] },
    { eco: "B70", name: "Sicilian: Dragon", line: ["e4", "c5", "Nf3", "d6", "d4", "cxd4", "Nxd4", "Nf6", "Nc3", "g6"] },
    { eco: "B80", name: "Sicilian: Scheveningen", line: ["e4", "c5", "Nf3", "d6", "d4", "cxd4", "Nxd4", "Nf6", "Nc3", "e6"] },
    { eco: "B90", name: "Sicilian: Najdorf", line: ["e4", "c5", "Nf3", "d6", "d4", "cxd4", "Nxd4", "Nf6", "Nc3", "a6"] },
    
    // French continuations
    { eco: "C01", name: "French: Exchange Variation", line: ["e4", "e6", "d4", "d5", "exd5"] },
    { eco: "C02", name: "French: Advance Variation", line: ["e4", "e6", "d4", "d5", "e5"] },
    { eco: "C03", name: "French: Tarrasch Variation", line: ["e4", "e6", "d4", "d5", "Nd2"] },
    { eco: "C10", name: "French: Rubinstein Variation", line: ["e4", "e6", "d4", "d5", "Nc3", "dxe4"] },
    { eco: "C11", name: "French: Classical Variation", line: ["e4", "e6", "d4", "d5", "Nc3", "Nf6"] },
    { eco: "C15", name: "French: Winawer Variation", line: ["e4", "e6", "d4", "d5", "Nc3", "Bb4"] },
    
    // Caro-Kann continuations
    { eco: "B12", name: "Caro-Kann: Advance Variation", line: ["e4", "c6", "d4", "d5", "e5"] },
    { eco: "B13", name: "Caro-Kann: Exchange Variation", line: ["e4", "c6", "d4", "d5", "exd5", "cxd5"] },
    { eco: "B14", name: "Caro-Kann: Panov-Botvinnik", line: ["e4", "c6", "d4", "d5", "exd5", "cxd5", "c4"] },
    { eco: "B17", name: "Caro-Kann: Steinitz Variation", line: ["e4", "c6", "d4", "d5", "Nc3", "dxe4", "Nxe4", "Nd7"] },
    { eco: "B18", name: "Caro-Kann: Classical Variation", line: ["e4", "c6", "d4", "d5", "Nc3", "dxe4", "Nxe4", "Bf5"] },
    
    // Scandinavian continuations
    { eco: "B01", name: "Scandinavian: Modern", line: ["e4", "d5", "exd5", "Nf6"] },
    { eco: "B01", name: "Scandinavian: Main Line", line: ["e4", "d5", "exd5", "Qxd5"] },
    { eco: "B01", name: "Scandinavian: Icelandic Gambit", line: ["e4", "d5", "exd5", "Nf6", "c4", "e6"] },
    
    // Pirc/Modern continuations  
    { eco: "B07", name: "Pirc Defense: Classical", line: ["e4", "d6", "d4", "Nf6", "Nc3", "g6"] },
    { eco: "B08", name: "Pirc Defense: Austrian Attack", line: ["e4", "d6", "d4", "Nf6", "Nc3", "g6", "f4"] },
    
    // Queen's Pawn continuations
    { eco: "D02", name: "London System", line: ["d4", "d5", "Nf3", "Nf6", "Bf4"] },
    { eco: "D06", name: "Queen's Gambit", line: ["d4", "d5", "c4"] },
    { eco: "D10", name: "Slav Defense", line: ["d4", "d5", "c4", "c6"] },
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
    { eco: "A56", name: "Benoni Defense", line: ["d4", "Nf6", "c4", "c5"] },
    { eco: "A57", name: "Benko Gambit", line: ["d4", "Nf6", "c4", "c5", "d5", "b5"] },
    { eco: "E10", name: "Blumenfeld Gambit", line: ["d4", "Nf6", "c4", "e6", "Nf3", "c5", "d5", "b5"] },
    
    // English continuations
    { eco: "A20", name: "English: King's English", line: ["c4", "e5"] },
    { eco: "A25", name: "English: Sicilian Reversed", line: ["c4", "e5", "Nc3", "Nc6"] },
    { eco: "A30", name: "English: Symmetrical", line: ["c4", "c5"] },
    { eco: "A16", name: "English: Anglo-Indian", line: ["c4", "Nf6"] },
    
    // Reti continuations
    { eco: "A06", name: "Reti: Old Indian Attack", line: ["Nf3", "d5", "g3"] },
    { eco: "A09", name: "Reti Accepted", line: ["Nf3", "d5", "c4"] },
    { eco: "A05", name: "Reti: King's Indian Attack", line: ["Nf3", "Nf6", "g3"] }
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
    
    const trimmed = prefix.trim().toLowerCase();
    
    // Get command suggestions
    let list = COMMANDS.filter(
        (c) => c.toLowerCase().startsWith(trimmed) || c.toLowerCase().includes(trimmed)
    );
    
    // Add smart move suggestions if input looks like a square
    if (game && /^[a-h][1-8]?$/.test(trimmed)) {
        const square = trimmed.length === 2 ? trimmed : null;
        if (square) {
            // Get legal moves from this square
            const moves = game.moves({ square, verbose: true });
            const moveSuggestions = moves.map(m => `move ${m.from} ${m.to}`);
            list = [...moveSuggestions, ...list];
        } else {
            // Show common opening moves
            const turn = game.turn();
            const openingMoves = turn === "w" 
                ? ["e2 e4", "d2 d4", "c2 c4", "g1 f3", "b1 c3"]
                : ["e7 e5", "d7 d5", "c7 c5", "g8 f6", "b8 c6"];
            const filtered = openingMoves.filter(m => m.startsWith(trimmed));
            list = [...filtered, ...list];
        }
    }
    
    // If typing "m" or "mo" etc, prioritize move suggestions with actual legal moves
    if (game && /^m(o(v(e)?)?)?$/.test(trimmed)) {
        const legalMoves = game.moves({ verbose: true }).slice(0, 5);
        const moveSuggestions = legalMoves.map(m => `move ${m.from} ${m.to}`);
        list = [...moveSuggestions, ...list.filter(c => !c.startsWith("move "))];
    }
    
    // Limit and deduplicate
    list = [...new Set(list)].slice(0, 12);
    
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
    print("=== Game Status ===", "line info");
    
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
        let openingStr = `Opening: ${opening.name} (${opening.eco})`;
        if (opening.desc) {
            openingStr += ` - ${opening.desc}`;
        }
        print(openingStr, "line");
    }
    
    // Move count
    const moveCount = Math.ceil(game.history().length / 2);
    print(`Moves: ${moveCount}`, "line");
    
    // Bot configuration
    print("", "line");
    print("=== Bot Configuration ===", "line info");
    print(`Bot Depth: ${botDepth}`, "line");
    print(`Bot Think Time: ${botThinkTime}ms`, "line");
    print(`Bot Active: ${botActive ? "Yes" : "No"}`, "line");
    if (botActive) {
        print(`Bot Side: ${autoplayMode ? "Autoplay (both)" : (botSide === "w" ? "White" : "Black")}`, "line");
    }
    
    // Game state
    print("", "line");
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
    "status": () => {
        printEnhancedStatus();
    },
    
    "help": () => {
        const help = [
            "=== Terminal Chess Commands ===",
            "",
            "Movement:",
            "  move <from> <to> [promo]        - Move piece (e.g., move e2 e4)",
            "  move <piece> <from> <to>        - Move with piece name",
            "  moves [from]                    - List all/from-square moves",
            "  legal [from]                    - Detailed legal moves",
            "  undo / redo                     - Undo/redo moves",
            "",
            "Game Control:",
            "  status                          - Show game & bot status",
            "  turn                            - Show current turn",
            "  reset / new                     - Start new game",
            "  resign                          - Resign current game",
            "",
            "Export (auto-copies to clipboard):",
            "  fen                             - Show/copy FEN",
            "  pgn                             - Show/copy PGN",
            "  save [name]                     - Save to localStorage",
            "  load [name]                     - Load from localStorage",
            "",
            "Bot Commands:",
            "  bot autoplay [delay]            - Bot plays both sides",
            "  bot enter [white|black]         - Bot plays one side",
            "  bot stop                        - Stop bot",
            "  bot best                        - Make one best move",
            "  bot random                      - Make random move",
            "  bot depth <1-10>                - Set search depth",
            "  bot think <time_ms>             - Set thinking time limit",
            "  bot reset                       - Reset bot to defaults",
            "",
            "Quick Tips:",
            "  - Type 'e2e4' or 'e2 e4' for quick moves",
            "  - Tab autocompletes commands",
            "  - Up/Down navigates history",
            "",
            "Bot Features:",
            "  - PeSTO evaluation",
            "  - Alpha-beta + Transposition Table",
            "  - Quiescence search"
        ].join("\n");
        printBlock(help, "line muted");
    },
    
    "turn": () => {
        const t = game.turn() === "w" ? "White" : "Black";
        print(`Turn: ${t}`, "line info");
        updateBoardView();
    },
    
    "fen": () => {
        const fen = game.fen();
        print(fen, "line muted");
        copyToClipboard(fen, "FEN copied to clipboard!");
    },
    
    "pgn": () => {
        const pgn = game.pgn({ max_width: 80 }) || "(No moves yet)";
        print(pgn, "line muted");
        copyToClipboard(pgn, "PGN copied to clipboard!");
    },
    
    "reset": () => {
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
    
    "new": () => {
        handlers["reset"]();
    },
    
    "undo": () => {
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
    
    "redo": () => {
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
        playMoveSound(false);
        printStatus("After redo");
        updateBoardView();
    },
    
    "moves": (args) => {
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
    
    "legal": (args) => {
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
    
    "save": (args) => {
        const name = (args[0] || "default").toLowerCase();
        try {
            localStorage.setItem("chess.save." + name, game.fen());
            print(`Saved as '${name}'`, "line ok");
        } catch (e) {
            print("Error saving to localStorage.", "line err");
        }
    },
    
    "load": (args) => {
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
    
    "move": (args) => {
        if (!ensureNotResigned()) return;
        
        if (args.length < 2) {
            print("Syntax: move <from> <to> [promotion]", "line err");
            return;
        }
        
        let piece = null, from, to, promo = null;
        
        // Syntax 1: move <piece> <from> <to>
        if (args.length >= 3 && !isSquare(args[0]) && isSquare(args[1]) && isSquare(args[2])) {
            piece = mapPiece(args[0]);
            from = args[1];
            to = args[2];
            promo = args[3] ? mapPiece(args[3]) || args[3] : null;
        }
        // Syntax 2: move <from> <to>
        else if (isSquare(args[0]) && isSquare(args[1])) {
            from = args[0];
            to = args[1];
            promo = args[2] ? mapPiece(args[2]) || args[2] : null;
        } else {
            print("Invalid syntax. Example: move e2 e4", "line err");
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
        playMoveSound(!!mv.captured);
        print(`Move: ${mv.san || from + "-" + to}`, "line ok");
        printStatus("After move");
        updateBoardView();
        
        // Trigger bot if active
        if (botActive && !game.game_over()) {
            setTimeout(makeBotMove, 300);
        }
    },
    
    "resign": () => {
        if (resigned) {
            print("Already resigned. Use 'reset' to start new game.", "line warn");
            return;
        }
        resigned = true;
        const quitter = game.turn() === "w" ? "White" : "Black";
        const winner = game.turn() === "w" ? "Black" : "White";
        print(`${quitter} resigns. ${winner} wins!`, "line err");
        updateBoardView();
    },
    
    "bot": (args) => {
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
            
            print(`Autoplay started (${moveDelay}ms delay). Use 'bot stop' to end.`, "line ok");
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
            const d = Math.max(1, Math.min(10, parseInt(args[1] || "8", 10)));
            botDepth = d;
            print(`Bot depth set to ${d}`, "line info");
            return;
        }
        
        if (mode === "think") {
            const t = Math.max(100, Math.min(60000, parseInt(args[1] || "5000", 10)));
            botThinkTime = t;
            print(`Bot think time set to ${t}ms`, "line info");
            return;
        }
        
        if (mode === "reset") {
            botDepth = DEFAULT_BOT_DEPTH;
            botThinkTime = DEFAULT_BOT_THINK_TIME;
            print(`Bot config reset: depth=${botDepth}, think=${botThinkTime}ms`, "line ok");
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
            playMoveSound(!!applied.captured);
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
        playMoveSound(!!applied.captured);
        print(`Bot: ${applied.san}`, "line info");
        printStatus(`Bot (depth ${botDepth})`);
        updateBoardView();
    }
};

// ============================================================================
// COMMAND DISPATCHER
// ============================================================================

// Smart input parser - handles shortcuts like "e2e4" -> "move e2 e4"
function parseSmartInput(input) {
    const raw = input.trim().toLowerCase();
    
    // Handle compact move notation: e2e4 -> move e2 e4
    const compactMove = /^([a-h][1-8])([a-h][1-8])([qrbn])?$/;
    const match = raw.match(compactMove);
    if (match) {
        const [, from, to, promo] = match;
        return { cmd: "move", args: promo ? [from, to, promo] : [from, to] };
    }
    
    // Handle spaced move notation: e2 e4 -> move e2 e4
    const spacedMove = /^([a-h][1-8])\s+([a-h][1-8])(\s+[qrbn])?$/;
    const spacedMatch = raw.match(spacedMove);
    if (spacedMatch) {
        const [, from, to, promo] = spacedMatch;
        const args = [from, to];
        if (promo) args.push(promo.trim());
        return { cmd: "move", args };
    }
    
    return null;
}

function dispatch(input) {
    const { tokens } = parse(input);
    if (tokens.length === 0) return;
    
    if (!game) {
        print("Game not initialized. Please wait or reload.", "line warn");
        return;
    }
    
    // Try smart input parsing first (e.g., "e2e4" or "e2 e4")
    const smart = parseSmartInput(input);
    if (smart) {
        const fn = handlers[smart.cmd];
        if (fn) {
            try {
                fn(smart.args);
            } catch (e) {
                print("Error executing command.", "line err");
                console.error(e);
            }
            return;
        }
    }
    
    const key = (tokens[0] || "").toLowerCase();
    const args = tokens.slice(1);
    
    // Direct command mapping (simplified - no "board" prefix needed)
    const directCommands = [
        "status", "help", "turn", "fen", "pgn", "reset", "new",
        "undo", "redo", "moves", "legal", "save", "load", "move", "resign", "bot"
    ];
    
    if (directCommands.includes(key)) {
        const fn = handlers[key];
        if (fn) {
            try {
                fn(args);
            } catch (e) {
                print("Error executing command.", "line err");
                console.error(e);
            }
            return;
        }
    }
    
    // Legacy support: "board <command>" still works
    if (key === "board") {
        const sub = (tokens[1] || "").toLowerCase();
        const subArgs = tokens.slice(2);
        
        if (directCommands.includes(sub)) {
            const fn = handlers[sub];
            if (fn) {
                try {
                    fn(subArgs);
                } catch (e) {
                    print("Error executing command.", "line err");
                    console.error(e);
                }
                return;
            }
        }
        
        print(`Unknown command: ${sub}. Type 'help' for available commands.`, "line err");
        return;
    }
    
    print(`Unknown command: ${key}. Type 'help' for available commands.`, "line err");
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
    const openingDisplay = document.getElementById("openingDisplay");
    if (!container || !game) return;
    
    // Render HTML grid board
    container.innerHTML = renderHtmlBoard();
    
    const opening = detectOpening();
    const turn = game.turn() === "w" ? "White" : "Black";
    
    // Update opening display
    if (openingDisplay) {
        if (opening) {
            let openingText = `${opening.name} (${opening.eco})`;
            if (opening.desc) {
                openingText += ` - ${opening.desc}`;
            }
            openingDisplay.textContent = openingText;
            openingDisplay.style.display = "block";
        } else {
            openingDisplay.textContent = "";
            openingDisplay.style.display = "none";
        }
    }
    
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
        "Type 'help' for commands.",
        "Examples:",
        "  - status          - Show game status",
        "  - move e2 e4      - Make a move",
        "  - e2e4            - Quick move shortcut",
        "  - bot autoplay    - Watch bot play",
        "  - bot depth 5     - Set bot depth"
    ].join("\n");
    printBlock(lines, "line muted");
    printStatus("New game");
}

function initApp() {
    // Theme
    initTheme();
    
    // Initialize sounds
    initSounds();
    
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
