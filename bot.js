// ============================================================================
// TERMINAL CHESS BOT v2.2 "Grandmaster Flash II"
// Fixes: Hanging Pieces, Quiescence Checks, Aggressive Eval
// Target ELO: ~2100+
// ============================================================================

// --- Constants & Config ---
const MATE_SCORE = 20000;
const INFINITY = 30000;

// Material values
const PV = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };

// Game Phases for Tapered Eval
const PHASE_WEIGHTS = { p: 0, n: 1, b: 1, r: 2, q: 4, k: 0 };
const TOTAL_PHASE = 24;

// --- PeSTO Tables (Source: Rofchade / PeSTO) ---
// White perspective. Flip for Black.
const PESTO_MG = {
    P: [[0, 0, 0, 0, 0, 0, 0, 0], [98, 134, 61, 95, 68, 126, 34, -11], [-6, 7, 26, 31, 65, 56, 25, -20], [-14, 13, 6, 21, 23, 12, 17, -23], [-27, -2, -5, 12, 17, 6, 10, -25], [-26, -4, -4, -10, 3, 3, 33, -12], [-35, -1, -20, -23, -15, 24, 38, -22], [0, 0, 0, 0, 0, 0, 0, 0]],
    N: [[-167, -89, -34, -49, 61, -97, -15, -107], [-73, -41, 72, 36, 23, 62, 7, -17], [-47, 60, 37, 65, 84, 129, 73, 44], [-9, 17, 19, 53, 37, 69, 18, 22], [-13, 4, 16, 13, 28, 19, 21, -8], [-23, -9, 12, 10, 19, 17, 25, -16], [-29, -53, -12, -3, -1, 18, -14, -19], [-105, -21, -58, -33, -17, -28, -19, -23]],
    B: [[-29, 4, -82, -37, -25, -42, 7, -8], [-26, 16, -18, -13, 30, 59, 18, -47], [-16, 37, 43, 40, 35, 50, 37, -2], [-4, 5, 19, 50, 37, 37, 7, -2], [-6, 13, 13, 26, 34, 12, 10, 4], [0, 15, 15, 15, 14, 27, 18, 10], [4, 15, 16, 0, 7, 21, 33, 1], [-33, -3, -14, -21, -13, -12, -39, -21]],
    R: [[32, 42, 32, 51, 63, 9, 31, 43], [27, 32, 58, 62, 80, 67, 26, 44], [-5, 19, 26, 36, 17, 45, 61, 16], [-24, -11, 7, 26, 24, 35, -8, -20], [-36, -26, -12, -1, 9, -7, 6, -23], [-45, -25, -16, -17, 3, 0, -5, -33], [-44, -16, -20, -9, -1, 11, -6, -71], [-19, -13, 1, 17, 16, 7, -37, -26]],
    Q: [[-28, 0, 29, 12, 59, 44, 43, 45], [-24, -39, -5, 1, -16, 57, 28, 54], [-13, -17, 7, 8, 29, 56, 47, 57], [-27, -27, -16, -16, -1, 17, -2, 1], [-9, -26, -9, -10, -2, -4, 3, -3], [-14, 2, -11, -2, -5, 2, 14, 5], [-35, -8, 11, 2, 8, 15, -3, 1], [-1, -18, -9, 10, -15, -25, -31, -50]],
    K: [[-74, -35, -18, -18, -11, 15, 4, -17], [-12, 17, 14, 17, 17, 38, 23, 11], [10, 17, 23, 15, 20, 45, 44, 13], [-8, 22, 24, 27, 26, 33, 26, 3], [-18, -4, 21, 24, 27, 23, 9, -11], [-19, -3, 11, 21, 23, 16, 7, -9], [-27, -11, 4, 13, 14, 4, -5, -17], [-53, -34, -21, -11, -28, -14, -24, -43]]
};

const PESTO_EG = {
    P: [[0, 0, 0, 0, 0, 0, 0, 0], [178, 173, 158, 134, 147, 132, 165, 187], [94, 100, 85, 67, 56, 53, 82, 84], [32, 24, 13, 5, -2, 4, 17, 17], [13, 9, -3, -7, -7, -8, 3, -1], [4, 7, -6, 1, 0, -5, -1, -8], [13, 8, 8, 10, 13, 0, 2, -7], [0, 0, 0, 0, 0, 0, 0, 0]],
    N: [[-58, -38, -13, -28, -31, -27, -63, -99], [-25, -8, -25, -2, -9, -25, -24, -52], [-24, -20, 10, 9, -1, -9, -19, -41], [-17, 3, 22, 22, 22, 11, 8, -18], [-18, -6, 16, 25, 16, 17, 4, -18], [-23, -3, -1, 15, 10, -3, -20, -22], [-42, -20, -10, -5, -2, -20, -23, -44], [-29, -51, -23, -15, -22, -18, -50, -64]],
    B: [[-14, -21, -11, -8, -7, -9, -17, -24], [-8, -4, 7, -12, -3, -13, -4, -14], [2, -8, 0, -1, -2, 6, 0, 4], [-3, 9, 12, 9, 14, 10, 3, 2], [-6, 3, 13, 19, 7, 10, -3, -9], [-12, -3, 8, 10, 13, 3, -7, -15], [-14, -18, -7, -1, 4, -9, -15, -27], [-23, -9, -23, -5, -9, -16, -5, -17]],
    R: [[13, 10, 18, 15, 12, 12, 8, 5], [11, 13, 13, 11, -3, 3, 8, 3], [7, 7, 7, 5, 4, -3, -5, -3], [4, 3, 13, 1, 2, 1, -1, 2], [3, 5, 8, 4, -5, -6, -8, -11], [-4, 0, -5, -1, -7, -12, -8, -16], [-6, -6, 0, 2, -9, -9, -11, -3], [-9, 2, 3, -1, -5, -13, 4, -20]],
    Q: [[-9, 22, 22, 27, 27, 19, 10, 20], [-17, 20, 32, 41, 58, 25, 30, 0], [-20, 6, 9, 49, 47, 35, 19, 9], [3, 22, 24, 45, 57, 40, 57, 36], [-18, 28, 19, 47, 31, 34, 39, 23], [-16, -27, 15, 6, 9, 17, 10, 5], [-22, -23, -30, -16, -16, -23, -36, -32], [-33, -28, -22, -43, -5, -32, -20, -41]],
    K: [[-74, -35, -18, -18, -11, 15, 4, -17], [-12, 17, 14, 17, 17, 38, 23, 11], [10, 17, 23, 15, 20, 45, 44, 13], [-8, 22, 24, 27, 26, 33, 26, 3], [-18, -4, 21, 24, 27, 23, 9, -11], [-19, -3, 11, 21, 23, 16, 7, -9], [-27, -11, 4, 13, 14, 4, -5, -17], [-53, -34, -21, -11, -28, -14, -24, -43]]
};

// Passed Pawn Bonus (by rank)
const PASSED_PAWN_BONUS = [0, 5, 10, 20, 35, 60, 100, 0];

// King Safety
const PAWN_SHIELD_BONUS = 25;
const OPEN_FILE_NEAR_KING_PENALTY = 30;

// Development & Opening
const CASTLING_BONUS = 50;
const DEVELOPMENT_BONUS = 15;
const EARLY_QUEEN_PENALTY = 30;

// Endgame
const CONNECTED_PASSERS_BONUS = [0, 0, 20, 40, 80, 160, 320, 0]; // By rank
const PIECE_COORDINATION_BONUS = 25;
const WINNING_ATTACK_BONUS = 100;
const REPETITION_PENALTY = 50;

// History & Killers & TT
const HISTORY = new Map();
const KILLERS = [];
const TT = Object.create(null); // Faster than Map
let TT_SIZE = 0;
const TT_FLAG = { EXACT: 1, LOWER: 2, UPPER: 3 };
const MAX_TT_SIZE = 1000000; // Reduce to 1M
const MAX_PLY = 64;

let ttGeneration = 0;
for (let i = 0; i < MAX_PLY; i++) KILLERS.push([null, null]);

// --- TT Storage with Aging ---
function storeTT(key, depth, score, flag, bestMove) {
    const existing = TT[key];
    
    // Always replace if:
    // 1. Slot is empty
    // 2. Current search generation
    // 3. Deeper search
    // 4. Exact score (most valuable)
    const shouldReplace = !existing ||
        existing.generation !== ttGeneration ||
        depth >= existing.depth ||
        (flag === TT_FLAG.EXACT && existing.flag !== TT_FLAG.EXACT);
    
    if (shouldReplace) {
        if (!existing) TT_SIZE++;
        TT[key] = { depth, score, flag, bestMove, generation: ttGeneration };
    }
}

function probeTT(key) { 
    return TT[key]; 
}

function newSearchGeneration() {
    ttGeneration++;
    
    // Clear TT if too large (every 8 generations)
    if (ttGeneration % 8 === 0 && TT_SIZE > MAX_TT_SIZE * 0.8) {
        const threshold = ttGeneration - 3;
        const keys = Object.keys(TT);
        
        for (let i = 0; i < keys.length; i++) {
            if (TT[keys[i]].generation < threshold) {
                delete TT[keys[i]];
                TT_SIZE--;
            }
        }
    }
}

// Clear TT completely between games
function clearTT() {
    Object.keys(TT).forEach(key => delete TT[key]);
    TT_SIZE = 0;
}

const historyKey = (m) => `${m.from}-${m.to}-${m.piece}`;
const bumpHistory = (m, depth) => {
    const k = historyKey(m);
    const bonus = depth * depth;
    const old = HISTORY.get(k) || 0;
    HISTORY.set(k, Math.min(20000, old + bonus)); 
};

// --- Countermove Heuristic ---
const COUNTERMOVES = new Map();
function getCountermoveKey(move) {
    if (!move) return null;
    return `${move.from}-${move.to}`;
}
function storeCountermove(prevMove, responseMove) {
    if (!prevMove || !responseMove) return;
    const key = getCountermoveKey(prevMove);
    if (key) COUNTERMOVES.set(key, { from: responseMove.from, to: responseMove.to });
}
function getCountermove(prevMove) {
    if (!prevMove) return null;
    return COUNTERMOVES.get(getCountermoveKey(prevMove));
}

// --- Evaluation Logic ---

function isPassedPawn(board, r, c, color) {
    const enemyColor = color === 'w' ? 'b' : 'w';
    const startRank = color === 'w' ? r - 1 : r + 1;
    const endRank = color === 'w' ? 0 : 7;
    const step = color === 'w' ? -1 : 1;
    const minFile = Math.max(0, c - 1);
    const maxFile = Math.min(7, c + 1);

    for (let i = startRank; color === 'w' ? i >= endRank : i <= endRank; i += step) {
        for (let j = minFile; j <= maxFile; j++) {
            const sq = board[i][j];
            if (sq && sq.type === 'p' && sq.color === enemyColor) return false;
        }
    }
    return true;
}

// Check if a piece at r,c is attacked by an enemy PAWN
// This is cheap static safety check
function isAttackedByPawn(board, r, c, color) {
    const enemyPawn = 'p';
    const enemyColor = color === 'w' ? 'b' : 'w';
    // Enemy pawns are "above" white pieces (lower r index) if they are attacking
    // White pawn at r attacks r-1, c+/-1
    // Black pawn at r attacks r+1, c+/-1
    
    const attackRank = color === 'w' ? r - 1 : r + 1;
    if (attackRank < 0 || attackRank > 7) return false;
    
    if (c - 1 >= 0) {
        const sq = board[attackRank][c - 1];
        if (sq && sq.type === 'p' && sq.color === enemyColor) return true;
    }
    if (c + 1 <= 7) {
        const sq = board[attackRank][c + 1];
        if (sq && sq.type === 'p' && sq.color === enemyColor) return true;
    }
    return false;
}

// NEW: Lightweight king safety (O(1) per king)
function evaluateKingSafetyFast(board, color, phase) {
    let kingR = -1, kingC = -1;
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            if (board[r][c]?.type === 'k' && board[r][c]?.color === color) {
                kingR = r; kingC = c; break;
            }
        }
        if (kingR !== -1) break;
    }
    if (kingR === -1) return 0;

    const isOpening = phase > 16;
    let safety = 0;
    
    if (isOpening) {
        const homeRank = color === 'w' ? 7 : 0;
        const shieldRank = color === 'w' ? 6 : 1;
        
        // King on home rank bonus
        if (kingR === homeRank) safety += 50;
        
        // Simple pawn shield (only 3 squares)
        for (let dc = -1; dc <= 1; dc++) {
            const file = kingC + dc;
            if (file >= 0 && file <= 7) {
                const sq = board[shieldRank][file];
                if (sq?.type === 'p' && sq.color === color) {
                    safety += 25;
                }
            }
        }
    } else {
        // Endgame: centralization
        const centerDist = Math.abs(kingR - 3.5) + Math.abs(kingC - 3.5);
        safety += (7 - centerDist) * 8;
    }
    
    return Math.round(safety * (phase / TOTAL_PHASE));
}

// NEW: Fast pawn structure (single pass)
function evaluatePawnStructureFast(board, color) {
    const pawns = new Array(8).fill(0); // Count pawns per file
    let score = 0;
    
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const sq = board[r][c];
            if (sq?.type === 'p' && sq.color === color) {
                pawns[c]++;
            }
        }
    }
    
    // Penalize doubled/tripled pawns
    for (let file = 0; file < 8; file++) {
        if (pawns[file] >= 2) score -= 30;
        if (pawns[file] >= 3) score -= 50; // Additional penalty
        
        // Isolated pawns
        const hasSupport = (file > 0 && pawns[file - 1] > 0) || 
                          (file < 7 && pawns[file + 1] > 0);
        if (pawns[file] > 0 && !hasSupport) {
            score -= 25;
        }
    }
    
    return score;
}

function evaluateKingSafety(board, color, phase) {
    let kingR = -1, kingC = -1;
    for(let r=0; r<8; r++) {
        for(let c=0; c<8; c++) {
            if(board[r][c] && board[r][c].type === 'k' && board[r][c].color === color) {
                kingR = r; kingC = c; break;
            }
        }
    }
    if (kingR === -1) return 0;

    const isOpening = phase > 16;
    const isEndgame = phase <= 8;
    
    if (isOpening) {
        return evaluateOpeningKingSafety(board, color, kingR, kingC);
    } else if (isEndgame) {
        return evaluateEndgameKingActivity(board, color, kingR, kingC, phase);
    } else {
        return evaluateMiddlegameKingSafety(board, color, kingR, kingC, phase);
    }
}

function evaluateOpeningKingSafety(board, color, kingR, kingC) {
    let safety = 0;
    const homeRank = color === 'w' ? 7 : 0;
    const shieldRank = color === 'w' ? kingR - 1 : kingR + 1;
    
    // Strong penalty for king moves in opening
    if (kingR !== homeRank) {
        safety -= 80; // Heavy penalty for moving king off back rank
    }
    
    // Pawn Shield (more important in opening)
    for (let dc = -1; dc <= 1; dc++) {
        const file = kingC + dc;
        if (file >= 0 && file <= 7 && shieldRank >= 0 && shieldRank <= 7) {
            const sq = board[shieldRank][file];
            if (sq && sq.type === 'p' && sq.color === color) {
                safety += PAWN_SHIELD_BONUS * 1.5; // Increased pawn shield value
            }
            let hasFriendly = false;
            for(let r=0; r<8; r++) {
                const s = board[r][file];
                if(s && s.type === 'p' && s.color === color) hasFriendly = true;
            }
            if(!hasFriendly) safety -= OPEN_FILE_NEAR_KING_PENALTY * 1.2;
        }
    }
    
    return safety;
}

function evaluateMiddlegameKingSafety(board, color, kingR, kingC, phase) {
    let safety = 0;
    const shieldRank = color === 'w' ? kingR - 1 : kingR + 1;
    
    // Standard pawn shield evaluation
    for (let dc = -1; dc <= 1; dc++) {
        const file = kingC + dc;
        if (file >= 0 && file <= 7 && shieldRank >= 0 && shieldRank <= 7) {
            const sq = board[shieldRank][file];
            if (sq && sq.type === 'p' && sq.color === color) {
                safety += PAWN_SHIELD_BONUS;
            }
            let hasFriendly = false;
            for(let r=0; r<8; r++) {
                const s = board[r][file];
                if(s && s.type === 'p' && s.color === color) hasFriendly = true;
            }
            if(!hasFriendly) safety -= OPEN_FILE_NEAR_KING_PENALTY;
        }
    }
    
    return Math.round(safety * (phase / TOTAL_PHASE));
}

function evaluateEndgameKingActivity(board, color, kingR, kingC, phase) {
    let activity = 0;
    
    // In endgame, king should be active (centralized)
    const centerDistance = Math.abs(kingR - 3.5) + Math.abs(kingC - 3.5);
    activity += (7 - centerDistance) * 8; // Bonus for central king
    
    // King should be close to pawns in endgame
    let pawnDistance = 0;
    let pawnCount = 0;
    for(let r=0; r<8; r++) {
        for(let c=0; c<8; c++) {
            const sq = board[r][c];
            if(sq && sq.type === 'p') {
                const dist = Math.abs(kingR - r) + Math.abs(kingC - c);
                if(sq.color === color) {
                    pawnDistance += Math.max(0, 4 - dist) * 5; // Bonus for being close to own pawns
                } else {
                    pawnDistance += Math.max(0, 5 - dist) * 3; // Bonus for being close to enemy pawns
                }
                pawnCount++;
            }
        }
    }
    
    activity += pawnCount > 0 ? pawnDistance / pawnCount : 0;
    return Math.round(activity * ((TOTAL_PHASE - phase) / TOTAL_PHASE)); // Scale by endgame factor
}

function evaluateBoard(board, perspectiveColor) {
    let mgScore = 0, egScore = 0;
    let phase = 0;
    let whiteMat = 0, blackMat = 0;

    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const sq = board[r][c];
            if (!sq) continue;

            const type = sq.type.toUpperCase();
            const color = sq.color;
            const matVal = PV[sq.type];

            if (color === 'w') whiteMat += matVal;
            else blackMat += matVal;

            let mgVal, egVal;
            if (color === 'w') {
                mgVal = PESTO_MG[type][r][c];
                egVal = PESTO_EG[type][r][c];
            } else {
                mgVal = PESTO_MG[type][7 - r][c];
                egVal = PESTO_EG[type][7 - r][c];
            }

            // ONLY hanging piece check (fast)
            if (sq.type !== 'p' && sq.type !== 'k' && isAttackedByPawn(board, r, c, color)) {
                const dangerPenalty = Math.floor(matVal / 5);
                mgVal -= dangerPenalty;
                egVal -= dangerPenalty;
            }

            // Simple passed pawn bonus
            if (sq.type === 'p' && isPassedPawn(board, r, c, color)) {
                const rankIdx = color === 'w' ? (7 - r) : r;
                egVal += PASSED_PAWN_BONUS[rankIdx] * 1.5;
            }

            if (color === 'w') { 
                mgScore += matVal + mgVal; 
                egScore += matVal + egVal; 
            } else { 
                mgScore -= (matVal + mgVal); 
                egScore -= (matVal + egVal); 
            }

            phase += PHASE_WEIGHTS[sq.type];
        }
    }

    phase = Math.min(phase, TOTAL_PHASE);
    let score = (mgScore * phase + egScore * (TOTAL_PHASE - phase)) / TOTAL_PHASE;

    // ONLY lightweight king safety and pawn structure
    score += evaluateKingSafetyFast(board, 'w', phase) - evaluateKingSafetyFast(board, 'b', phase);
    score += evaluatePawnStructureFast(board, 'w') - evaluatePawnStructureFast(board, 'b');

    return perspectiveColor === 'w' ? score : -score;
}

// Removed expensive evaluation functions:
// - evaluateDevelopment (redundant with piece-square tables)
// - evaluateCastling (redundant with king safety)
// - evaluateEndgamePatterns (too expensive for eval function)
// - evaluateConnectedPassers (O(n²) complexity)
// - evaluatePieceCoordination (O(n²) complexity) 
// - evaluateWinningAttacks (O(n²) complexity)
// - isAttackingKingArea (helper for above)

// These evaluations are better handled by:
// 1. PeSTO tables (development/positioning)
// 2. Search tree (tactical patterns)
// 3. King safety evaluation (castling benefits)

// Repetition detection for search
const positionHistory = Object.create(null);

function getPositionKey(game) {
    // Only position + castling + en passant matter for repetition
    const fen = game.fen();
    const parts = fen.split(' ');
    return parts[0] + parts[2] + parts[3]; // position + castling + ep
}

function recordPosition(game) {
    const key = getPositionKey(game);
    const count = positionHistory[key] || 0;
    positionHistory[key] = count + 1;
    return count + 1;
}

function isRepetition(game) {
    const key = getPositionKey(game);
    const count = positionHistory[key] || 0;
    return count >= 2; // 2nd occurrence = 3-fold (position appeared 3 times total)
}

function clearPositionHistory() {
    Object.keys(positionHistory).forEach(key => delete positionHistory[key]);
}

// Important: Clean up after undo
function cleanupPosition(game) {
    const key = getPositionKey(game);
    const count = positionHistory[key];
    if (count > 1) {
        positionHistory[key] = count - 1;
    } else {
        delete positionHistory[key];
    }
}

// --- Extended Opening Book ---
// Format: FEN_KEY -> [List of suggested moves] 
// FEN Key is position + turn + castling rights
const OPENING_BOOK = {
    // 1. Start Position
    "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq": ["e4", "d4", "c4", "Nf3"],
    
    // --- Responses to 1. e4 ---
    "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq": ["c5", "e5", "e6", "c6"],
    
    // --- Responses to 1. d4 ---
    "rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq": ["Nf6", "d5", "e6", "f5"],

    // --- Sicilian Defense (1. e4 c5) ---
    "rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq": ["Nf3", "Nc3"],
    "rnbqkbnr/pp1ppppp/8/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq": ["d6", "Nc6", "e6"],

    // --- French Defense (1. e4 e6) ---
    "rnbqkbnr/pppp1ppp/4p3/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq": ["d4", "Nf3"],

    // --- King's Pawn Game (1. e4 e5) ---
    "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq": ["Nf3", "Bc4", "f4"],
    "rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq": ["Nc6", "Nf6", "d6"],

    // --- Queen's Gambit (1. d4 d5 2. c4) ---
    "rnbqkbnr/ppp1pppp/8/3p4/2PP4/8/PP2PPPP/RNBQKBNR b KQkq": ["e6", "c6", "dxc4"],
    
    // --- English Opening (1. c4) ---
    "rnbqkbnr/pppppppp/8/8/2P5/8/PP1PPPPP/RNBQKBNR b KQkq": ["e5", "Nf6", "c5"]
};

// Normalize FEN for book lookup
function getBookKey(game) {
    const fen = game.fen();
    const parts = fen.split(' ');
    // Use position + turn + castling rights
    return parts[0] + ' ' + parts[1] + ' ' + parts[2];
}

function getOpeningMove(game) {
    const key = getBookKey(game);
    const bookMoves = OPENING_BOOK[key];
    
    if (!bookMoves || bookMoves.length === 0) return null;
    
    // Filter to only legal moves
    const legalMoves = game.moves();
    const validBookMoves = bookMoves.filter(m => legalMoves.includes(m));
    
    if (validBookMoves.length === 0) return null;
    
    // Random selection from book moves
    return validBookMoves[Math.floor(Math.random() * validBookMoves.length)];
}

// --- Search Helpers ---

function hasNonPawnPieces(board, color) {
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const sq = board[r][c];
            if (sq && sq.color === color && sq.type !== 'p' && sq.type !== 'k') {
                return true;
            }
        }
    }
    return false;
}

function isCapture(m) {
    return !!m.captured || (m.flags && (m.flags.includes("c") || m.flags.includes("e")));
}

function mvvLvaScore(m) {
    const victim = m.captured ? PV[m.captured] : 0;
    const attacker = PV[m.piece] || 100;
    // Huge bonus for capturing high value with low value
    // e.g. PxQ = 9000, QxP = 100
    return 10000 + victim * 10 - attacker; 
}

function calculateLMR(depth, moveIndex, isPVNode, isCapture, givesCheck, inCheck) {
    if (depth < 3 || moveIndex < 2) return 0;
    if (isCapture || givesCheck || inCheck) return 0;
    
    // Base reduction from LMR formula
    // R = log(depth) * log(moveIndex) / 2.5
    let reduction = Math.floor(Math.log(depth) * Math.log(moveIndex) / 2.5);
    
    // Adjustments
    if (isPVNode) reduction -= 1;  // Reduce less in PV nodes
    if (moveIndex > 15) reduction += 1;  // Reduce more for very late moves
    
    // Clamp reduction
    reduction = Math.max(0, Math.min(reduction, depth - 2));
    
    return reduction;
}

function orderMoves(moves, ply = 0, ttMove = null, prevMove = null, gamePhase = null, inCheck = false) {
    return moves.sort((a, b) => {
        // 1. Hash Move
        if (ttMove && a.from === ttMove.from && a.to === ttMove.to) return -1;
        if (ttMove && b.from === ttMove.from && b.to === ttMove.to) return 1;

        const isCapA = isCapture(a);
        const isCapB = isCapture(b);
        
        // 2. Good Captures (MVV-LVA)
        if (isCapA && isCapB) {
            return mvvLvaScore(b) - mvvLvaScore(a);
        }
        if (isCapA) return -1; // Captures first!
        if (isCapB) return 1;

        // 3. Checks (when not in check ourselves)
        if (!inCheck) {
            const checksA = a.san.includes('+');
            const checksB = b.san.includes('+');
            if (checksA && !checksB) return -1;
            if (checksB && !checksA) return 1;
        }

        // 4. Killers
        if (ply < MAX_PLY) {
            const killers = KILLERS[ply];
            if (killers[0] && killers[0].from === a.from && killers[0].to === a.to) return -1;
            if (killers[0] && killers[0].from === b.from && killers[0].to === b.to) return 1;
        }
        
        // 5. Penalize king moves in opening
        if (gamePhase && gamePhase > 16) { // Opening phase
            if (a.piece === 'k' && b.piece !== 'k') return 1; // King moves last
            if (b.piece === 'k' && a.piece !== 'k') return -1;
        }

        // 6. History
        const ha = HISTORY.get(historyKey(a)) || 0;
        const hb = HISTORY.get(historyKey(b)) || 0;
        return hb - ha;
    });
}

// --- Quiescence Search ---
const QS_MAX_PLY = 16; // Reduce depth

function quiescence(game, alpha, beta, ply = 0) {
    nodesVisited++;
    
    const stand = evaluateBoard(game.board(), game.turn());
    
    // Stand-pat
    if (stand >= beta) return beta;
    
    // Delta pruning - more aggressive
    const BIG_DELTA = 975; // Queen value + margin
    if (stand + BIG_DELTA < alpha && !game.in_check()) {
        return alpha;
    }
    
    if (alpha < stand) alpha = stand;
    if (ply >= QS_MAX_PLY) return stand;

    const inCheck = game.in_check();
    const allMoves = game.moves({ verbose: true });
    
    let moves = [];
    if (inCheck) {
        // When in check, consider all moves (evasions)
        moves = allMoves;
    } else if (ply < 2) {
        // First 2 plies: captures + checks + promotions
        moves = allMoves.filter(m => 
            isCapture(m) || m.promotion || m.san.includes('+')
        );
    } else {
        // Deep in QS: only good captures + promotions
        moves = allMoves.filter(m => {
            if (m.promotion) return true;
            if (!isCapture(m)) return false;
            
            // SEE pruning: skip bad captures
            const captureValue = PV[m.captured] || 0;
            const attackerValue = PV[m.piece] || 100;
            
            // Simplified SEE: don't capture with valuable piece unless target is more valuable
            if (attackerValue > captureValue + 200) return false;
            
            return true;
        });
    }
    
    // Sort by MVV-LVA
    moves.sort((a, b) => mvvLvaScore(b) - mvvLvaScore(a));

    for (const m of moves) {
        // Futility pruning in QS
        if (!inCheck && !m.promotion) {
            const captureValue = PV[m.captured] || 900;
            if (stand + captureValue + 200 < alpha) continue;
        }

        game.move(m);
        const score = -quiescence(game, -beta, -alpha, ply + 1);
        game.undo();

        if (score >= beta) return beta;
        if (score > alpha) alpha = score;
    }
    
    return alpha;
}

// --- Main Search & Time Management ---

let lastSearchInfo = { depth: 0, score: 0, bestLine: [], nodes: 0, actualDepth: 0, isBookMove: false, isRandomMove: false };
let searchAborted = false;
let softTimeLimit = 0;
let hardTimeLimit = 0;
let searchStartTime = 0;
let nodesVisited = 0;

function calculateTimeLimits(game, allocatedTimeMs, depth) {
    const movesLeft = Math.max(20, 40 - game.history().length / 2);
    const baseTime = allocatedTimeMs / movesLeft;
    
    // Base allocation
    let softLimit = baseTime * 0.8;
    let hardLimit = baseTime * 2.5;
    
    // Adjustments based on position
    const lastScore = lastSearchInfo.score || 0;
    
    // If position is critical (large score drop), think longer
    if (depth > 4 && Math.abs(lastScore) > 200) {
        softLimit *= 1.3;
        hardLimit *= 1.5;
    }
    
    // If winning big, think less
    if (lastScore > 200) {
        softLimit *= 0.7;
        hardLimit *= 0.8;
    }
    
    // If losing, think longer
    if (lastScore < -200) {
        softLimit *= 1.2;
        hardLimit *= 1.4;
    }
    
    // Ensure minimums
    softLimit = Math.max(500, softLimit);
    hardLimit = Math.max(1000, hardLimit);
    
    return { soft: softLimit, hard: hardLimit };
}

function shouldStopSearch() {
    if (searchAborted) return true;
    if ((nodesVisited & 2047) === 0) {
        if (Date.now() - searchStartTime > hardTimeLimit) {
            searchAborted = true;
            return true;
        }
    }
    return false;
}

function getBestMove(game, maxDepth = 12) {
    newSearchGeneration();
    clearPositionHistory(); // Clear position history for new search
    lastSearchInfo = { depth: 0, score: 0, bestLine: [], nodes: 0, actualDepth: 0, isBookMove: false, isRandomMove: false };
    searchAborted = false;
    nodesVisited = 0;

    const book = getOpeningMove(game);
    if (book) {
        const m = game.moves({verbose:true}).find(mv => mv.san === book);
        if(m) {
            lastSearchInfo.isBookMove = true;
            lastSearchInfo.actualDepth = 0;
            return m;
        }
    }

    searchStartTime = Date.now();
    const thinkTime = typeof botThinkTime !== 'undefined' ? botThinkTime : 5000;
    const limits = calculateTimeLimits(game, thinkTime, maxDepth);
    softTimeLimit = limits.soft;
    hardTimeLimit = limits.hard;

    let bestMove = null;
    let rootBestScore = -Infinity;
    let safeBestMove = null;
    let aspirationWindow = 50;
    let unstablePosition = false;
    let lastDepthScore = 0;

    for (let depth = 1; depth <= maxDepth; depth++) {
        const elapsed = Date.now() - searchStartTime;
        
        // Stop if approaching soft limit and position is stable
        if (elapsed > softTimeLimit && !unstablePosition && depth > 6) {
            break;
        }
        
        // Always stop at hard limit
        if (elapsed > hardTimeLimit) break;

        let alpha = -INFINITY;
        let beta = INFINITY;
        
        // Aspiration windows starting from depth 5
        if (depth >= 5 && lastSearchInfo.bestMove) {
            alpha = rootBestScore - aspirationWindow;
            beta = rootBestScore + aspirationWindow;
        }

        let result = rootSearch(game, depth, alpha, beta);
        
        // Handle aspiration window failures
        if (!searchAborted) {
            if (result.score <= alpha || result.score >= beta) {
                // Widen window and re-search
                aspirationWindow *= 2;
                
                if (result.score <= alpha) {
                    alpha = -INFINITY;
                    beta = rootBestScore + aspirationWindow;
                } else {
                    alpha = rootBestScore - aspirationWindow;
                    beta = INFINITY;
                }
                
                result = rootSearch(game, depth, alpha, beta);
            } else {
                // Search succeeded, narrow window for next depth
                aspirationWindow = Math.max(25, Math.floor(aspirationWindow * 0.8));
            }
        }

        if (searchAborted) break;

        if (result.bestMove) {
            const scoreDrop = Math.abs(result.score - lastDepthScore);
            unstablePosition = scoreDrop > 100; // Large score change
            
            // If unstable, extend time slightly
            if (unstablePosition && depth >= 8) {
                softTimeLimit += 300;
            }
            
            lastDepthScore = result.score;
            safeBestMove = result.bestMove;
            bestMove = result.bestMove;
            rootBestScore = result.score;
            
            lastSearchInfo.depth = depth;
            lastSearchInfo.actualDepth = depth;
            lastSearchInfo.score = rootBestScore;
        }
        
        if (Math.abs(rootBestScore) > MATE_SCORE - 1000) break;
    }

    if (!safeBestMove) {
        const moves = game.moves({verbose:true});
        return moves[0];
    }

    const moves = game.moves({verbose:true});
    const clean = moves.find(m => m.from === safeBestMove.from && m.to === safeBestMove.to && m.promotion === safeBestMove.promotion);
    return clean || moves[0];
}

function rootSearch(game, depth, alpha, beta) {
    let bestMove = null;
    let bestScore = -INFINITY;
    
    // Calculate game phase for move ordering
    let phase = 0;
    const board = game.board();
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const sq = board[r][c];
            if (sq) phase += PHASE_WEIGHTS[sq.type];
        }
    }
    phase = Math.min(phase, TOTAL_PHASE);
    
    const moves = orderMoves(game.moves({ verbose: true }), 0, null, null, phase);

    for (const m of moves) {
        if (shouldStopSearch()) break;

        game.move(m);
        // PVS at Root
        let score;
        if (bestScore === -INFINITY) {
            score = -search(game, depth - 1, -beta, -alpha, 1, true);
        } else {
            score = -search(game, depth - 1, -alpha - 1, -alpha, 1, false);
            if (score > alpha && score < beta && !searchAborted) {
                score = -search(game, depth - 1, -beta, -alpha, 1, true);
            }
        }
        game.undo();

        if (searchAborted) return { bestMove, score: bestScore };

        if (score > bestScore) {
            bestScore = score;
            bestMove = m;
        }
        if (score > alpha) {
            alpha = score;
        }
        if (alpha >= beta) break;
    }

    return { bestMove, score: bestScore };
}

function search(game, depth, alpha, beta, ply, isPVNode = true) {
    nodesVisited++;
    if ((nodesVisited & 2047) === 0) { if (shouldStopSearch()) return 0; }

    if (game.in_draw()) return 0;
    
    // Penalize repetition when we're ahead in material
    if (ply > 0 && isRepetition(game)) {
        const currentEval = evaluateBoard(game.board(), game.turn());
        if (currentEval > 100) { // We're ahead, avoid repetition
            return currentEval - REPETITION_PENALTY;
        }
    }

    const inCheck = game.in_check();
    if (inCheck) depth++; // Check Extension

    if (depth <= 0) return quiescence(game, alpha, beta, ply);

    const mateValue = MATE_SCORE - ply;
    if (alpha < -mateValue) alpha = -mateValue;
    if (beta > mateValue - 1) beta = mateValue - 1;
    if (alpha >= beta) return alpha;

    const fenKey = game.fen().split(' ').slice(0,4).join(''); 
    const ttEntry = probeTT(fenKey);
    let ttMove = null;
    
    if (ttEntry && ttEntry.depth >= depth && Math.abs(ttEntry.score) < MATE_SCORE) {
        if (ttEntry.flag === TT_FLAG.EXACT) return ttEntry.score;
        if (ttEntry.flag === TT_FLAG.LOWER && ttEntry.score >= beta) return ttEntry.score;
        if (ttEntry.flag === TT_FLAG.UPPER && ttEntry.score <= alpha) return ttEntry.score;
        if (ttEntry.bestMove) ttMove = ttEntry.bestMove;
    }

    // TRUE Null Move Pruning
    if (!inCheck && depth >= 3 && Math.abs(beta) < MATE_SCORE && ply > 0) {
        const evalScore = evaluateBoard(game.board(), game.turn());
        
        // Only try NMP if we're not in a zugzwang-prone endgame
        const hasNonPawnMaterial = hasNonPawnPieces(game.board(), game.turn());
        
        if (evalScore >= beta && hasNonPawnMaterial) {
            const R = 2 + Math.floor(depth / 6) + Math.floor((evalScore - beta) / 200);
            
            // Make null move - switch turns without moving
            game._turn = game.turn() === 'w' ? 'b' : 'w';
            const nullScore = -search(game, depth - 1 - R, -beta, -beta + 1, ply + 1, false);
            game._turn = game.turn() === 'w' ? 'b' : 'w'; // Restore
            
            if (nullScore >= beta) {
                return beta; // Null move cutoff
            }
        }
    }

    // Calculate game phase for move ordering  
    let currentPhase = 0;
    const currentBoard = game.board();
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const sq = currentBoard[r][c];
            if (sq) currentPhase += PHASE_WEIGHTS[sq.type];
        }
    }
    currentPhase = Math.min(currentPhase, TOTAL_PHASE);
    
    const moves = orderMoves(game.moves({ verbose: true }), ply, ttMove, null, currentPhase, inCheck);
    if (moves.length === 0) {
        if (inCheck) return -mateValue;
        return 0;
    }

    let bestScore = -INFINITY;
    let bestMove = null;
    let flag = TT_FLAG.UPPER;

    for (let i = 0; i < moves.length; i++) {
        const m = moves[i];
        game.move(m);
        recordPosition(game); // Track position for repetition detection
        
        let score;
        
        // LMR calculation
        const reduction = calculateLMR(depth, i, isPVNode, isCapture(m), m.san.includes('+'), inCheck);
        
        // PVS with LMR
        if (i === 0) {
            // First move - full window search
            score = -search(game, depth - 1 - reduction, -beta, -alpha, ply + 1, isPVNode);
        } else {
            // Later moves - null window search (scout)
            score = -search(game, depth - 1 - reduction, -alpha - 1, -alpha, ply + 1, false);
            
            // If scout fails high and we reduced, re-search without reduction
            if (score > alpha && reduction > 0) {
                score = -search(game, depth - 1, -alpha - 1, -alpha, ply + 1, false);
            }
            
            // If still fails high, do full re-search
            if (score > alpha && score < beta) {
                score = -search(game, depth - 1, -beta, -alpha, ply + 1, true);
            }
        }
        
        game.undo();
        
        // Clean up position tracking
        cleanupPosition(game);

        if (searchAborted) return 0;

        if (score > bestScore) {
            bestScore = score;
            bestMove = m;
        }

        if (score > alpha) {
            alpha = score;
            flag = TT_FLAG.EXACT;
        }

        if (alpha >= beta) {
            flag = TT_FLAG.LOWER;
            if (!isCapture(m)) {
                bumpHistory(m, depth);
                const killer = KILLERS[ply];
                if (!killer[0] || (killer[0].from !== m.from || killer[0].to !== m.to)) {
                     killer[1] = killer[0];
                     killer[0] = { from: m.from, to: m.to };
                }
                if (i > 0) storeCountermove(null, m);
            }
            break;
        }
    }

    storeTT(fenKey, depth, bestScore, flag, bestMove);
    return bestScore;
}

// --- Interface ---

function makeBotMove() {
    if (!botActive || botThinking || game.game_over()) return;

    if (!autoplayMode && botSide !== "both" && game.turn() !== botSide) return;

    botThinking = true;
    const currentSide = game.turn() === "w" ? "White" : "Black";
    if (!autoplayMode) print(`Bot (${currentSide}) thinking... (depth ${botDepth})`, "line muted");

    setTimeout(() => {
        try {
            const start = Date.now();
            const mv = getBestMove(game, botDepth);
            const time = Date.now() - start;

            if (mv) {
                game.move(mv);
                let depthDisplay;
                if (lastSearchInfo.isBookMove) {
                    depthDisplay = "Book";
                } else if (lastSearchInfo.isRandomMove) {
                    depthDisplay = "N/A";
                } else {
                    depthDisplay = lastSearchInfo.actualDepth;
                }
                const scoreDisplay = lastSearchInfo.isBookMove || lastSearchInfo.isRandomMove ? "Book" : (lastSearchInfo.score / 100).toFixed(2);
                const info = `Bot: ${mv.san} (${(time / 1000).toFixed(2)}s, depth: ${depthDisplay}, eval: ${scoreDisplay})`;
                print(info, "line ok");
                updateBoardView();
                playMoveSound(!!mv.captured);
            }
        } catch (e) {
            console.error("Bot error:", e);
        }
        botThinking = false;
        
        if (botActive && !game.game_over()) {
            setTimeout(makeBotMove, autoplayMode ? 200 : 200);
        }
    }, 50);
}

function getSearchInfo() { return lastSearchInfo; }