// ============================================================================
// CHESS ANALYZER - Game Analysis and PGN Viewer
// Features: PGN Import, Move Navigation, Position Analysis
// ============================================================================

// ---- DOM Elements ----
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// Control elements
const pgnInput = $("#pgnInput");
const fenInput = $("#fenInput");
const pgnFileInput = $("#pgnFileInput");
const loadPgnBtn = $("#loadPgnBtn");
const loadFenBtn = $("#loadFenBtn");
const loadFileBtn = $("#loadFileBtn");

// Navigation elements
const firstBtn = $("#firstBtn");
const prevBtn = $("#prevBtn");
const nextBtn = $("#nextBtn");
const lastBtn = $("#lastBtn");
const moveCounter = $("#moveCounter");
const currentMove = $("#currentMove");

// Board elements
const boardContainer = $("#boardContainer");
const openingDisplay = $("#openingDisplay");
const boardMeta = $("#boardMeta");
const flipBtn = $("#flipBtn");
const exportFenBtn = $("#exportFenBtn");

// Move list elements
const moveList = $("#moveList");
const copyPgnBtn = $("#copyPgnBtn");

// Game info elements
const gameMetadata = $("#gameMetadata");
const themeToggle = $("#themeToggle");

// ---- State Variables ----
let game = null;
let gameHistory = [];
let currentMoveIndex = -1;
let boardFlipped = false;
let chessBoard = null;

// ---- Opening Database (Simplified for analyzer) ----
const OPENINGS = [
    { eco: "B00", name: "King's Pawn Opening", line: ["e4"] },
    { eco: "A40", name: "Queen's Pawn Opening", line: ["d4"] },
    { eco: "C20", name: "Open Game", line: ["e4", "e5"] },
    { eco: "B20", name: "Sicilian Defense", line: ["e4", "c5"] },
    { eco: "C00", name: "French Defense", line: ["e4", "e6"] },
    { eco: "B10", name: "Caro-Kann Defense", line: ["e4", "c6"] },
    { eco: "C50", name: "Italian Game", line: ["e4", "e5", "Nf3", "Nc6", "Bc4"] },
    { eco: "C60", name: "Ruy Lopez", line: ["e4", "e5", "Nf3", "Nc6", "Bb5"] },
    { eco: "D06", name: "Queen's Gambit", line: ["d4", "d5", "c4"] },
    { eco: "E20", name: "Nimzo-Indian Defense", line: ["d4", "Nf6", "c4", "e6", "Nc3", "Bb4"] },
    { eco: "E60", name: "King's Indian Defense", line: ["d4", "Nf6", "c4", "g6"] }
];

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function showToast(message, type = 'info') {
    const container = $("#toastContainer");
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;

    container.appendChild(toast);

    // Animate in
    requestAnimationFrame(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateY(0)';
    });

    // Remove after 3 seconds
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-20px)';
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }, 3000);
}

async function copyToClipboard(text, successMsg = "Copied to clipboard!") {
    try {
        await navigator.clipboard.writeText(text);
        showToast(successMsg, 'success');
        return true;
    } catch (err) {
        showToast("Failed to copy to clipboard", 'error');
        return false;
    }
}

function detectOpening() {
    if (!game) return null;
    
    const moves = game.history();
    if (!moves || moves.length === 0) return null;
    
    let best = null;
    
    for (const opening of OPENINGS) {
        if (moves.length < opening.line.length) continue;
        
        let matches = true;
        for (let i = 0; i < opening.line.length; i++) {
            if (moves[i] !== opening.line[i]) {
                matches = false;
                break;
            }
        }
        
        if (matches && (!best || opening.line.length > best.line.length)) {
            best = opening;
        }
    }
    
    return best;
}

// ============================================================================
// THEME MANAGEMENT
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
    if (!themeToggle) return;
    
    const theme = document.documentElement.getAttribute("data-theme") || "dark";
    const icon = themeToggle.querySelector(".theme-toggle-icon");
    const label = themeToggle.querySelector(".theme-toggle-label");
    
    if (icon) icon.textContent = theme === "dark" ? "\uD83C\uDF19" : "\u2600\uFE0F";
    if (label) label.textContent = theme === "dark" ? "Dark" : "Light";
}

// ============================================================================
// GAME LOADING AND PARSING
// ============================================================================

function parseGameMetadata(pgnString) {
    const metadata = {};
    const lines = pgnString.split('\n');
    
    for (const line of lines) {
        const tagMatch = line.match(/^\[(\w+)\s+"([^"]+)"\]/);
        if (tagMatch) {
            metadata[tagMatch[1]] = tagMatch[2];
        }
    }
    
    return metadata;
}

function updateGameMetadata(metadata) {
    if (!gameMetadata) return;
    
    const items = gameMetadata.querySelectorAll('.meta-item');
    const labels = ['Event', 'White', 'Black', 'Result', 'Date'];
    
    items.forEach((item, index) => {
        const valueSpan = item.querySelector('.meta-value');
        if (valueSpan && labels[index]) {
            valueSpan.textContent = metadata[labels[index]] || '-';
        }
    });
}

function loadPGN(pgnString) {
    try {
        // Parse metadata first
        const metadata = parseGameMetadata(pgnString);
        updateGameMetadata(metadata);
        
        // Create new game and try to load PGN
        const ChessCtor = typeof window.Chess === "function" ? window.Chess : Chess;
        const newGame = new ChessCtor();
        
        // Clean up PGN string - remove extra whitespace and fix formatting
        let cleanPgn = pgnString.trim();
        
        // Try to load PGN with different approaches
        let loaded = false;
        
        // First attempt: direct load
        if (newGame.load_pgn(cleanPgn)) {
            loaded = true;
        } else {
            // Second attempt: try parsing moves manually if PGN load fails
            try {
                // Extract moves from PGN (remove headers and comments)
                const moveSection = cleanPgn.replace(/\[[^\]]*\]/g, '').trim();
                const moveString = moveSection.replace(/\{[^}]*\}/g, '').replace(/;[^\n]*/g, '').trim();
                
                // Split moves and clean them
                const moveTokens = moveString.split(/\s+/).filter(token => {
                    return token && !token.match(/^\d+\./) && !token.match(/^(1-0|0-1|1\/2-1\/2|\*)$/);
                });
                
                // Create a new game and try to play moves one by one
                newGame.reset();
                for (const moveToken of moveTokens) {
                    const cleanToken = moveToken.replace(/[+#?!]*$/, ''); // Remove annotations
                    const move = newGame.move(cleanToken);
                    if (!move) {
                        throw new Error(`Invalid move: ${cleanToken}`);
                    }
                }
                loaded = true;
            } catch (manualError) {
                throw new Error(`Cannot parse PGN: ${manualError.message}`);
            }
        }
        
        if (!loaded) {
            throw new Error("Invalid PGN format");
        }
        
        // Store the game history
        gameHistory = [];
        const moves = newGame.history({ verbose: true });
        
        // Reset to starting position and replay moves to build history
        newGame.reset();
        gameHistory.push({
            fen: newGame.fen(),
            move: null,
            san: null,
            moveNumber: 0
        });
        
        for (let i = 0; i < moves.length; i++) {
            const move = newGame.move(moves[i]);
            if (move) {
                gameHistory.push({
                    fen: newGame.fen(),
                    move: move,
                    san: move.san,
                    moveNumber: Math.ceil((i + 1) / 2)
                });
            }
        }
        
        // Set up the game state
        game = newGame;
        currentMoveIndex = gameHistory.length - 1;
        
        // Update UI
        renderMoveList();
        updatePosition();
        updateNavigation();
        
        showToast(`PGN loaded successfully (${moves.length} moves)`, 'success');
        
    } catch (error) {
        showToast(`Failed to load PGN: ${error.message}`, 'error');
        console.error('PGN loading error:', error);
    }
}

function loadFEN(fenString) {
    try {
        const ChessCtor = typeof window.Chess === "function" ? window.Chess : Chess;
        const newGame = new ChessCtor();
        
        if (!newGame.load(fenString)) {
            throw new Error("Invalid FEN format");
        }
        
        // Create single-position history
        gameHistory = [{
            fen: fenString,
            move: null,
            san: null,
            moveNumber: 0
        }];
        
        game = newGame;
        currentMoveIndex = 0;
        
        // Clear metadata
        updateGameMetadata({});
        
        // Update UI
        renderMoveList();
        updatePosition();
        updateNavigation();
        
        showToast("FEN loaded successfully", 'success');
        
    } catch (error) {
        showToast(`Failed to load FEN: ${error.message}`, 'error');
        console.error('FEN loading error:', error);
    }
}

// ============================================================================
// MOVE LIST RENDERING
// ============================================================================

function renderMoveList() {
    if (!moveList) return;
    
    if (gameHistory.length <= 1) {
        moveList.innerHTML = '<div class="empty-moves">No moves to display</div>';
        return;
    }
    
    let html = '<div class="moves-grid">';
    
    for (let i = 1; i < gameHistory.length; i++) {
        const position = gameHistory[i];
        const isWhiteMove = (i - 1) % 2 === 0;
        const moveNumber = position.moveNumber;
        
        if (isWhiteMove) {
            html += `<div class="move-row">`;
            html += `<span class="move-number">${moveNumber}.</span>`;
        }
        
        const isActive = i === currentMoveIndex ? 'active' : '';
        html += `<button class="move-button ${isActive}" data-index="${i}">${position.san}</button>`;
        
        if (!isWhiteMove || i === gameHistory.length - 1) {
            html += `</div>`;
        }
    }
    
    html += '</div>';
    moveList.innerHTML = html;
    
    // Add click handlers
    const moveButtons = moveList.querySelectorAll('.move-button');
    moveButtons.forEach(button => {
        button.addEventListener('click', () => {
            const index = parseInt(button.dataset.index);
            goToMove(index);
        });
    });
    
    // Scroll active move into view
    const activeButton = moveList.querySelector('.move-button.active');
    if (activeButton) {
        activeButton.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

// ============================================================================
// POSITION MANAGEMENT
// ============================================================================

function updatePosition() {
    if (!game || currentMoveIndex < 0 || currentMoveIndex >= gameHistory.length) {
        return;
    }
    
    const position = gameHistory[currentMoveIndex];
    
    // Load the position
    game.load(position.fen);
    
    // Update board
    if (chessBoard) {
        // Set last move highlight if available
        if (position.move) {
            chessBoard.setLastMove(position.move);
        } else {
            chessBoard.setLastMove(null);
        }
        
        chessBoard.render(boardContainer, game, { flipped: boardFlipped });
    }
    
    // Update opening display
    if (openingDisplay) {
        const opening = detectOpening();
        if (opening) {
            openingDisplay.textContent = `${opening.name} (${opening.eco})`;
            openingDisplay.style.display = "block";
        } else {
            openingDisplay.style.display = "none";
        }
    }
    
    // Update board meta
    if (boardMeta) {
        const turn = game.turn() === 'w' ? 'White' : 'Black';
        let status = `Turn: ${turn}`;
        
        if (game.in_checkmate()) {
            const winner = game.turn() === 'w' ? 'Black' : 'White';
            status += ` | Checkmate! ${winner} wins`;
        } else if (game.in_stalemate()) {
            status += ' | Stalemate';
        } else if (game.in_draw()) {
            status += ' | Draw';
        } else if (game.in_check()) {
            status += ` | ${turn} in check`;
        }
        
        boardMeta.textContent = status;
    }
    
    // Update move counter and current move
    if (moveCounter) {
        const moveNum = currentMoveIndex === 0 ? 0 : Math.ceil(currentMoveIndex / 2);
        moveCounter.textContent = `Move: ${moveNum}`;
    }
    
    if (currentMove) {
        if (currentMoveIndex === 0) {
            currentMove.textContent = "Starting position";
        } else {
            const position = gameHistory[currentMoveIndex];
            currentMove.textContent = position.san;
        }
    }
}

function updateNavigation() {
    if (firstBtn) firstBtn.disabled = currentMoveIndex <= 0;
    if (prevBtn) prevBtn.disabled = currentMoveIndex <= 0;
    if (nextBtn) nextBtn.disabled = currentMoveIndex >= gameHistory.length - 1;
    if (lastBtn) lastBtn.disabled = currentMoveIndex >= gameHistory.length - 1;
}

// ============================================================================
// NAVIGATION FUNCTIONS
// ============================================================================

function goToMove(index) {
    if (index < 0 || index >= gameHistory.length) return;
    
    currentMoveIndex = index;
    updatePosition();
    updateNavigation();
    renderMoveList();
}

function goToFirst() {
    goToMove(0);
}

function goToPrevious() {
    goToMove(currentMoveIndex - 1);
}

function goToNext() {
    goToMove(currentMoveIndex + 1);
}

function goToLast() {
    goToMove(gameHistory.length - 1);
}

// ============================================================================
// EVENT HANDLERS
// ============================================================================

function initEventHandlers() {
    // Theme toggle
    if (themeToggle) {
        themeToggle.addEventListener('click', toggleTheme);
    }
    
    // Import buttons
    if (loadPgnBtn) {
        loadPgnBtn.addEventListener('click', () => {
            const pgn = pgnInput.value.trim();
            if (pgn) {
                loadPGN(pgn);
            } else {
                showToast("Please enter a PGN", 'warning');
            }
        });
    }
    
    if (loadFenBtn) {
        loadFenBtn.addEventListener('click', () => {
            const fen = fenInput.value.trim();
            if (fen) {
                loadFEN(fen);
            } else {
                showToast("Please enter a FEN", 'warning');
            }
        });
    }
    
    if (loadFileBtn) {
        loadFileBtn.addEventListener('click', () => {
            pgnFileInput.click();
        });
    }
    
    if (pgnFileInput) {
        pgnFileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    loadPGN(event.target.result);
                };
                reader.readAsText(file);
            }
        });
    }
    
    // Navigation buttons
    if (firstBtn) firstBtn.addEventListener('click', goToFirst);
    if (prevBtn) prevBtn.addEventListener('click', goToPrevious);
    if (nextBtn) nextBtn.addEventListener('click', goToNext);
    if (lastBtn) lastBtn.addEventListener('click', goToLast);
    
    // Board actions
    if (flipBtn) {
        flipBtn.addEventListener('click', () => {
            boardFlipped = !boardFlipped;
            updatePosition();
        });
    }
    
    if (exportFenBtn) {
        exportFenBtn.addEventListener('click', () => {
            if (game) {
                copyToClipboard(game.fen(), "FEN copied to clipboard!");
            }
        });
    }
    
    if (copyPgnBtn) {
        copyPgnBtn.addEventListener('click', () => {
            if (game && gameHistory.length > 1) {
                // Reconstruct PGN from move history
                const ChessCtor = typeof window.Chess === "function" ? window.Chess : Chess;
                const tempGame = new ChessCtor();
                
                for (let i = 1; i < gameHistory.length; i++) {
                    const position = gameHistory[i];
                    if (position.move) {
                        tempGame.move(position.move);
                    }
                }
                
                const pgn = tempGame.pgn({ max_width: 80 });
                copyToClipboard(pgn, "PGN copied to clipboard!");
            }
        });
    }
    
    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
            return; // Don't interfere with text input
        }
        
        switch (e.key) {
            case 'ArrowLeft':
                e.preventDefault();
                goToPrevious();
                break;
            case 'ArrowRight':
                e.preventDefault();
                goToNext();
                break;
            case 'Home':
                e.preventDefault();
                goToFirst();
                break;
            case 'End':
                e.preventDefault();
                goToLast();
                break;
        }
    });
}

// ============================================================================
// INITIALIZATION
// ============================================================================

function initAnalyzer() {
    // Initialize theme
    initTheme();
    
    // Check for chess.js
    const ChessCtor = typeof window.Chess === "function" ? window.Chess : Chess;
    if (!ChessCtor) {
        showToast("chess.js failed to load. Please check your internet connection.", 'error');
        return;
    }
    
    // Initialize chess board component
    chessBoard = new ChessBoard({
        useUnicodePieces: true,
        interactive: false
    });
    
    // Initialize empty game state
    game = new ChessCtor();
    gameHistory = [{
        fen: game.fen(),
        move: null,
        san: null,
        moveNumber: 0
    }];
    currentMoveIndex = 0;
    
    // Initialize event handlers
    initEventHandlers();
    
    // Initial render
    updatePosition();
    updateNavigation();
    renderMoveList();
    
    // Load sample game if provided in URL
    const urlParams = new URLSearchParams(window.location.search);
    const samplePgn = urlParams.get('pgn');
    if (samplePgn) {
        try {
            const decodedPgn = decodeURIComponent(samplePgn);
            loadPGN(decodedPgn);
        } catch (error) {
            console.error('Failed to load PGN from URL:', error);
        }
    }
    
    showToast("Chess Analyzer ready. Load a PGN to start analyzing!", 'info');
}

// Start the analyzer when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAnalyzer);
} else {
    initAnalyzer();
}