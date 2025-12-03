// ============================================================================
// TERMINAL CHESS BOT v1.5
// Fixes: Hanging Pieces, Quiescence Checks, Aggressive Eval
// Target ELO: ~1800+
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

// Enhanced Tactical Constants
const CHECKMATE_THREAT_PENALTY = 10000;
const IMMEDIATE_THREAT_PENALTY = 2000;
const DOUBLED_PAWN_PENALTY = 30;
const TRIPLED_PAWN_PENALTY = 80;
const ISOLATED_PAWN_PENALTY = 25;
const PAWN_CHAIN_BONUS = 15;
const PIN_BONUS = 50;
const FORK_BONUS = 75;
const SKEWER_BONUS = 60;
const BACK_RANK_MATE_THREAT = 500;
const KING_EXPOSURE_PENALTY = 150;

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

// === DELETED EXPENSIVE THREAT DETECTION FUNCTIONS ===
// These functions were removed because they duplicate work done by the search tree
// and were major performance bottlenecks. The search naturally handles threats through
// alpha-beta pruning and evaluation.

// === ENHANCED PAWN STRUCTURE EVALUATION ===

// === DELETED EXPENSIVE KING SAFETY AND PAWN STRUCTURE FUNCTIONS ===
// These were replaced with fast versions that have O(n) complexity instead of O(n²)

// === DELETED EXPENSIVE TACTICAL PATTERN FUNCTIONS ===
// These functions were removed because they have O(n²) or worse complexity
// and were called millions of times during search. Tactical patterns should be
// detected by the search tree, not by static evaluation.

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

            // --- HANGING PIECE DANGER ---
            // If a major piece is attacked by a pawn, penalize heavily
            if (sq.type !== 'p' && sq.type !== 'k') {
                if (isAttackedByPawn(board, r, c, color)) {
                    // Penalty relative to piece value. 
                    // e.g. Queen attacked by pawn = -200 mg
                    const dangerPenalty = Math.floor(matVal / 5); 
                    mgVal -= dangerPenalty;
                    egVal -= dangerPenalty;
                }
            }

            if (sq.type === 'p' && isPassedPawn(board, r, c, color)) {
                const rankIdx = color === 'w' ? (7 - r) : r;
                let passerBonus = PASSED_PAWN_BONUS[rankIdx] * 1.5;
                
                // In endgame, reduce pawn bonus if king safety is at risk
                if (phase <= 12) { // Endgame
                    const kingSafetyScore = evaluateKingSafetyFast(board, color, phase);
                    if (kingSafetyScore < -100) { // King is in danger
                        passerBonus *= 0.6; // Reduce pawn promotion priority
                    } else if (kingSafetyScore < 0) {
                        passerBonus *= 0.8; // Moderate reduction
                    }
                }
                
                egVal += passerBonus;
            }

            if (color === 'w') { mgScore += matVal + mgVal; egScore += matVal + egVal; }
            else { mgScore -= (matVal + mgVal); egScore -= (matVal + egVal); }

            phase += PHASE_WEIGHTS[sq.type];
        }
    }

    phase = Math.min(phase, TOTAL_PHASE);
    const mgPhase = phase;
    const egPhase = TOTAL_PHASE - phase;
    let score = (mgScore * mgPhase + egScore * egPhase) / TOTAL_PHASE;

    // ONLY lightweight king safety
    score += evaluateKingSafetyFast(board, 'w', phase) - evaluateKingSafetyFast(board, 'b', phase);
    
    // Simple pawn structure penalties
    score += evaluatePawnStructureFast(board, 'w') - evaluatePawnStructureFast(board, 'b');
    
    // Opening development bonuses
    if (phase > 16) {
        score += evaluateDevelopment(board, 'w') - evaluateDevelopment(board, 'b');
        score += evaluateCastling(board, 'w') - evaluateCastling(board, 'b');
    }
    
    // Endgame-specific evaluations
    if (phase <= 12) {
        score += evaluateEndgamePatterns(board, whiteMat, blackMat, phase);
    }

    return perspectiveColor === 'w' ? score : -score;
}

function evaluateDevelopment(board, color) {
    let devScore = 0;
    const homeRank = color === 'w' ? 7 : 0;
    const knightSquares = color === 'w' ? ['b1', 'g1'] : ['b8', 'g8'];
    const bishopSquares = color === 'w' ? ['c1', 'f1'] : ['c8', 'f8'];
    
    // Check knight development
    knightSquares.forEach(sq => {
        const file = sq.charCodeAt(0) - 97; // a=0, b=1, etc.
        const rank = parseInt(sq[1]) - 1;
        const piece = board[7-rank][file]; // Convert to 0-7 indexing
        if (!piece || piece.type !== 'n' || piece.color !== color) {
            devScore += DEVELOPMENT_BONUS; // Bonus for developing knights
        }
    });
    
    // Check bishop development
    bishopSquares.forEach(sq => {
        const file = sq.charCodeAt(0) - 97;
        const rank = parseInt(sq[1]) - 1;
        const piece = board[7-rank][file];
        if (!piece || piece.type !== 'b' || piece.color !== color) {
            devScore += DEVELOPMENT_BONUS; // Bonus for developing bishops
        }
    });
    
    // Penalty for early queen development
    const queenHomeSquare = color === 'w' ? [7, 3] : [0, 3]; // d1/d8
    const queenPiece = board[queenHomeSquare[0]][queenHomeSquare[1]];
    if (!queenPiece || queenPiece.type !== 'q' || queenPiece.color !== color) {
        // Queen has moved, check if it's moved too early
        let queenMoved = false;
        for(let r=0; r<8; r++) {
            for(let c=0; c<8; c++) {
                const sq = board[r][c];
                if(sq && sq.type === 'q' && sq.color === color) {
                    // Check if minor pieces are still undeveloped
                    let undevelopedPieces = 0;
                    knightSquares.concat(bishopSquares).forEach(devSq => {
                        const file = devSq.charCodeAt(0) - 97;
                        const rank = parseInt(devSq[1]) - 1;
                        const piece = board[7-rank][file];
                        if (piece && ((piece.type === 'n') || (piece.type === 'b')) && piece.color === color) {
                            undevelopedPieces++;
                        }
                    });
                    if (undevelopedPieces >= 2) {
                        devScore -= EARLY_QUEEN_PENALTY;
                    }
                    queenMoved = true;
                    break;
                }
            }
            if (queenMoved) break;
        }
    }
    
    return devScore;
}

function evaluateCastling(board, color) {
    // This is a simplified castling check - in a real implementation
    // you'd want to check the game state for actual castling rights
    const kingHomeSquare = color === 'w' ? [7, 4] : [0, 4]; // e1/e8
    const king = board[kingHomeSquare[0]][kingHomeSquare[1]];
    
    // If king is not on home square, assume it may have castled
    if (!king || king.type !== 'k' || king.color !== color) {
        // Check if king is in a castled position
        const castledPositions = color === 'w' 
            ? [[7, 6], [7, 2]] // g1, c1
            : [[0, 6], [0, 2]]; // g8, c8
            
        for (const pos of castledPositions) {
            const piece = board[pos[0]][pos[1]];
            if (piece && piece.type === 'k' && piece.color === color) {
                return CASTLING_BONUS; // Bonus for castling
            }
        }
    }
    
    return 0;
}

function evaluateEndgamePatterns(board, whiteMat, blackMat, phase) {
    let egScore = 0;
    
    // Connected passed pawns evaluation
    egScore += evaluateConnectedPassers(board, 'w') - evaluateConnectedPassers(board, 'b');
    
    // Piece coordination in endgame
    egScore += evaluatePieceCoordination(board, 'w') - evaluatePieceCoordination(board, 'b');
    
    // Winning attack patterns (Q+R, R+R, etc.)
    egScore += evaluateWinningAttacks(board, 'w') - evaluateWinningAttacks(board, 'b');
    
    return egScore;
}

function evaluateConnectedPassers(board, color) {
    let bonus = 0;
    const passedPawns = [];
    
    // Find all passed pawns first
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const sq = board[r][c];
            if (sq && sq.type === 'p' && sq.color === color && isPassedPawn(board, r, c, color)) {
                const rank = color === 'w' ? (7 - r) : r;
                passedPawns.push({ rank, file: c, pos: [r, c] });
            }
        }
    }
    
    // Check for connected passed pawns
    for (let i = 0; i < passedPawns.length; i++) {
        for (let j = i + 1; j < passedPawns.length; j++) {
            const pawn1 = passedPawns[i];
            const pawn2 = passedPawns[j];
            
            // Connected if on adjacent files
            if (Math.abs(pawn1.file - pawn2.file) === 1) {
                const avgRank = Math.floor((pawn1.rank + pawn2.rank) / 2);
                const connectedBonus = CONNECTED_PASSERS_BONUS[Math.min(avgRank, 6)];
                
                // Extra bonus if both pawns are advanced
                if (pawn1.rank >= 4 && pawn2.rank >= 4) {
                    bonus += connectedBonus * 1.5;
                } else {
                    bonus += connectedBonus;
                }
            }
        }
    }
    
    return bonus;
}

function evaluatePieceCoordination(board, color) {
    let coordination = 0;
    const pieces = [];
    
    // Collect major pieces (Q, R)
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const sq = board[r][c];
            if (sq && sq.color === color && (sq.type === 'q' || sq.type === 'r')) {
                pieces.push({ type: sq.type, pos: [r, c] });
            }
        }
    }
    
    // Evaluate coordination between major pieces
    for (let i = 0; i < pieces.length; i++) {
        for (let j = i + 1; j < pieces.length; j++) {
            const piece1 = pieces[i];
            const piece2 = pieces[j];
            
            // Same rank or file = coordination bonus
            if (piece1.pos[0] === piece2.pos[0] || piece1.pos[1] === piece2.pos[1]) {
                coordination += PIECE_COORDINATION_BONUS;
            }
            
            // Q+R on adjacent ranks/files = extra coordination
            if ((piece1.type === 'q' && piece2.type === 'r') || (piece1.type === 'r' && piece2.type === 'q')) {
                const rankDiff = Math.abs(piece1.pos[0] - piece2.pos[0]);
                const fileDiff = Math.abs(piece1.pos[1] - piece2.pos[1]);
                if ((rankDiff <= 2 && fileDiff === 0) || (rankDiff === 0 && fileDiff <= 2)) {
                    coordination += PIECE_COORDINATION_BONUS / 2;
                }
            }
        }
    }
    
    return coordination;
}

function evaluateWinningAttacks(board, color) {
    let attackBonus = 0;
    
    // Find enemy king
    let enemyKingPos = null;
    const enemyColor = color === 'w' ? 'b' : 'w';
    
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const sq = board[r][c];
            if (sq && sq.type === 'k' && sq.color === enemyColor) {
                enemyKingPos = [r, c];
                break;
            }
        }
    }
    
    if (!enemyKingPos) return 0;
    
    // Find our major pieces
    const ourQueens = [];
    const ourRooks = [];
    
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const sq = board[r][c];
            if (sq && sq.color === color) {
                if (sq.type === 'q') ourQueens.push([r, c]);
                if (sq.type === 'r') ourRooks.push([r, c]);
            }
        }
    }
    
    // Q+R attack patterns bonus
    if (ourQueens.length > 0 && ourRooks.length > 0) {
        for (const queenPos of ourQueens) {
            for (const rookPos of ourRooks) {
                // Both pieces attacking enemy king area = big bonus
                if (isAttackingKingArea(queenPos, enemyKingPos) && 
                    isAttackingKingArea(rookPos, enemyKingPos)) {
                    attackBonus += WINNING_ATTACK_BONUS;
                }
                
                // One piece close, other attacking = moderate bonus
                else if (isAttackingKingArea(queenPos, enemyKingPos) || 
                         isAttackingKingArea(rookPos, enemyKingPos)) {
                    const distance = Math.abs(queenPos[0] - rookPos[0]) + Math.abs(queenPos[1] - rookPos[1]);
                    if (distance <= 3) { // Pieces are coordinated
                        attackBonus += WINNING_ATTACK_BONUS / 2;
                    }
                }
            }
        }
    }
    
    // Double rook attacks
    if (ourRooks.length >= 2) {
        let attackingRooks = 0;
        for (const rookPos of ourRooks) {
            if (isAttackingKingArea(rookPos, enemyKingPos)) {
                attackingRooks++;
            }
        }
        if (attackingRooks >= 2) {
            attackBonus += WINNING_ATTACK_BONUS * 0.8;
        }
    }
    
    return attackBonus;
}

function isAttackingKingArea(piecePos, kingPos) {
    const [pr, pc] = piecePos;
    const [kr, kc] = kingPos;
    
    // King area is 3x3 around king
    const kingArea = [];
    for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
            const nr = kr + dr;
            const nc = kc + dc;
            if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
                kingArea.push([nr, nc]);
            }
        }
    }
    
    // Check if piece is close to king area (within 2-3 squares)
    for (const [ar, ac] of kingArea) {
        const distance = Math.abs(pr - ar) + Math.abs(pc - ac);
        if (distance <= 2) return true;
    }
    
    return false;
}

// Use chess.js internal position hash if available, or FEN without move counters
const positionHistory = Object.create(null);

function getPositionKey(game) {
    // Position + turn + castling + en passant matter for repetition
    const fen = game.fen();
    const parts = fen.split(' ');
    return parts[0] + ' ' + parts[1] + ' ' + parts[2] + ' ' + parts[3]; // position + turn + castling + ep

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
// FEN Key is the first 4 parts of FEN (position + turn + castling + enpassant)
const OPENING_BOOK = {
    // 1. Start Position
    "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -": ["e4", "d4", "c4", "Nf3", "g3", "b3"],
    
    // --- Responses to 1. e4 ---
    // Sicilian, French, Caro-Kann, e5, Pirc, Alekhine
    "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq -": ["c5", "e5", "e6", "c6", "d6", "Nf6"],
    
    // --- Responses to 1. d4 ---
    // Indian defenses, d5, Dutch
    "rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq -": ["Nf6", "d5", "e6", "f5", "g6"],

    // --- Sicilian Defense (1. e4 c5) ---
    "rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq -": ["Nf3", "Nc3", "c3", "d4", "f4"],
    // Open Sicilian (1. e4 c5 2. Nf3)
    "rnbqkbnr/pp1ppppp/8/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq -": ["d6", "Nc6", "e6", "g6", "a6"],

    // --- French Defense (1. e4 e6) ---
    "rnbqkbnr/pppp1ppp/4p3/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq -": ["d4", "d3", "Nf3", "Nc3"],
    // French Main (1. e4 e6 2. d4 d5)
    "rnbqkbnr/pppp1ppp/4p3/3P4/4P3/8/PPP2PPP/RNBQKBNR b KQkq -": ["exd5", "Nf6", "Qxd5"], // Just Exchange logic usually handles d5 better

    // --- Ruy Lopez / Italian (1. e4 e5 2. Nf3 Nc6) ---
    "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq -": ["Bb5", "Bc4", "d4", "Nc3", "c3"],
    // Ruy Lopez (3. Bb5)
    "r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq -": ["a6", "Nf6", "d6", "f5"],
    // Italian (3. Bc4)
    "r1bqkbnr/pppp1ppp/2n5/2B1p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq -": ["Bc5", "Nf6", "d6"],

    // --- Queen's Gambit (1. d4 d5 2. c4) ---
    "rnbqkbnr/ppp1pppp/8/3p4/2PP4/8/PP2PPPP/RNBQKBNR b KQkq -": ["e6", "c6", "dxc4", "Nc6", "Nf6"],
    // QGD (2... e6)
    "rnbqkbnr/ppp2ppp/4p3/3p4/2PP4/8/PP2PPPP/RNBQKBNR w KQkq -": ["Nc3", "Nf3", "g3"],
    
    // --- King's Indian Defense (1. d4 Nf6 2. c4 g6) ---
    "rnbqkb1r/pppppppp/5n2/8/2PP4/8/PP2PPPP/RNBQKBNR b KQkq -": ["g6", "e6", "c5"],
    "rnbqkb1r/pppppp1p/5np1/8/2PP4/8/PP2PPPP/RNBQKBNR w KQkq -": ["Nc3", "Nf3", "g3", "f3"],
    
    // --- Caro-Kann (1. e4 c6) ---
    "rnbqkbnr/pp1ppppp/2p5/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq -": ["d4", "Nc3", "Nf3"],
    
    // --- Reti Opening (1. Nf3 d5) ---
    "rnbqkbnr/ppp1pppp/8/3p4/8/5N2/PPPPPPPP/RNBQKB1R w KQkq -": ["c4", "d4", "g3", "b3"],
    
    // --- English Opening (1. c4) ---
    "rnbqkbnr/pppppppp/8/8/2P5/8/PP1PPPPP/RNBQKBNR b KQkq -": ["e5", "Nf6", "c5", "e6", "g6"]
};

function getOpeningMove(game) {
    // Key uses first 4 parts to catch transpositions somewhat, ignoring move counts
    const fenParts = game.fen().split(' ');
    const fenKey = fenParts.slice(0, 3).join(' '); // Just position + turn + castling (En Passant can matter, but keeping it simple)
    
    // Try simplified key first (without en passant) to hit broad positions
    let moves = OPENING_BOOK[fenKey];
    
    // If not found, try simpler key (Position + Turn)
    if (!moves) {
         const simpleKey = fenParts.slice(0, 2).join(' ') + ' -'; // Assume no weird castling
         // This is a rough lookup fallback
    }
    
    // Actually, let's just use the manual key style defined above.
    // The keys in OPENING_BOOK are "fen_pos turn castling -" mostly.
    
    // Let's iterate keys to find partial match since castling rights might change slightly in notation
    // Or just exact match logic.
    
    // Better logic: standard FEN lookup
    // My dictionary keys above are simplified "w KQkq -" style.
    // Real game might be "w KQkq - 0 1" or "w KQkq e3 0 2"
    
    const currentFenBase = fenParts.slice(0, 3).join(' '); // "rnbqk... w KQkq"
    
    // Check direct match or loose match
    for (const key in OPENING_BOOK) {
        if (game.fen().startsWith(key) || currentFenBase === key) {
            const possibleMoves = OPENING_BOOK[key];
            const legalMoves = game.moves();
            const validBookMoves = possibleMoves.filter(m => legalMoves.includes(m));
            
            if (validBookMoves.length > 0) {
                // Weighted random? Or just random. Random is fun.
                return validBookMoves[Math.floor(Math.random() * validBookMoves.length)];
            }
        }
    }
    
    return null;
}

// --- Search Helpers ---

// Helper function for null move pruning
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

// Logarithmic Late Move Reduction formula
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

// Static Exchange Evaluation - determines if a capture is good
function SEE(game, move, threshold = 0) {
    if (!move.captured) return 0;
    
    // Simple SEE: assume recapture with cheapest piece
    const captureValue = PV[move.captured] || 0;
    const attackerValue = PV[move.piece] || 100;
    
    // Basic SEE: if we capture with a more valuable piece, assume it gets recaptured
    if (attackerValue > captureValue) {
        return captureValue - attackerValue;
    }
    
    return captureValue >= threshold ? captureValue : 0;
}

function algebraicToCoords(sq) {
    const file = sq.charCodeAt(0) - 97;
    const rank = 8 - parseInt(sq[1]);
    return [rank, file];
}

function orderMoves(moves, ply = 0, ttMove = null, prevMove = null, gamePhase = null, inCheck = false) {
    return moves.sort((a, b) => {
        // 1. Hash Move
        if (ttMove && a.from === ttMove.from && a.to === ttMove.to) return -1;
        if (ttMove && b.from === ttMove.from && b.to === ttMove.to) return 1;

        // 2. Check escape moves (when in check, prioritize getting out of check)
        if (inCheck) {
            // Prioritize moves that get out of check efficiently
            if (a.piece === 'k' && b.piece !== 'k') return -1; // King moves first when in check
            if (b.piece === 'k' && a.piece !== 'k') return 1;
            
            // Prioritize blocking/capturing checking piece
            if (isCapture(a) && !isCapture(b)) return -1;
            if (isCapture(b) && !isCapture(a)) return 1;
        }

        const isCapA = isCapture(a);
        const isCapB = isCapture(b);
        
        // 3. Good Captures (MVV-LVA) - Enhanced
        if (isCapA && isCapB) {
            const scoreA = mvvLvaScore(a);
            const scoreB = mvvLvaScore(b);
            
            // Extra bonus for capturing pieces that are giving check
            let finalScoreA = scoreA;
            let finalScoreB = scoreB;
            if (a.san && a.san.includes('+')) finalScoreA += 1000;
            if (b.san && b.san.includes('+')) finalScoreB += 1000;
            
            return finalScoreB - finalScoreA;
        }
        if (isCapA) return -1; // Captures first!
        if (isCapB) return 1;

        // 4. Checks (giving check is often powerful)
        const givesCheckA = a.san && a.san.includes('+');
        const givesCheckB = b.san && b.san.includes('+');
        if (givesCheckA && !givesCheckB) return -1;
        if (givesCheckB && !givesCheckA) return 1;

        // 5. Killers
        if (ply < MAX_PLY) {
            const killers = KILLERS[ply];
            if (killers[0] && killers[0].from === a.from && killers[0].to === a.to) return -1;
            if (killers[0] && killers[0].from === b.from && killers[0].to === b.to) return 1;
        }
        
        // 6. Penalize king moves in opening (unless in check)
        if (!inCheck && gamePhase && gamePhase > 16) { // Opening phase
            if (a.piece === 'k' && b.piece !== 'k') return 1; // King moves last
            if (b.piece === 'k' && a.piece !== 'k') return -1;
        }
        
        // 7. Promote development in opening
        if (gamePhase && gamePhase > 16) {
            const developmentA = (a.piece === 'n' || a.piece === 'b') ? 200 : 0;
            const developmentB = (b.piece === 'n' || b.piece === 'b') ? 200 : 0;
            if (developmentA !== developmentB) return developmentB - developmentA;
        }

        // 8. History
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
    if (lastScore > 500) {
        softLimit *= 0.7;
        hardLimit *= 0.8;
    }
    
    // If losing, think longer
    if (lastScore < -500) {
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
    if ((nodesVisited & 1023) === 0) {
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
    
    let bestMove = null;
    let rootBestScore = -Infinity;
    let safeBestMove = null;
    let unstablePosition = false;
    let lastDepthScore = 0;

    for (let depth = 1; depth <= maxDepth; depth++) {
        // Calculate time limits dynamically based on current depth and position
        const limits = calculateTimeLimits(game, thinkTime, depth);
        softTimeLimit = limits.soft;
        hardTimeLimit = limits.hard;
        
        const elapsed = Date.now() - searchStartTime;
        
        // Stop if approaching soft limit and position is stable
        if (elapsed > softTimeLimit && !unstablePosition && depth > 6) {
            break;
        }
        
        // Always stop at hard limit
        if (elapsed > hardTimeLimit) break;

        let alpha = -INFINITY;
        let beta = INFINITY;
        let aspirationWindow = depth === 1 ? 50 : (unstablePosition ? 75 : 35);
        
        // Aspiration windows starting from depth 5
        if (depth >= 5 && safeBestMove) {
            alpha = rootBestScore - aspirationWindow;
            beta = rootBestScore + aspirationWindow;
        }

        let result = rootSearch(game, depth, alpha, beta);
        
        // Handle aspiration window failures
        if (!searchAborted) {
            if (result.score <= alpha || result.score >= beta) {
                // Widen window and re-search
                aspirationWindow *= 2;
                const originalAlpha = alpha; // Save original alpha for panic extend check
                
                if (result.score <= alpha) {
                    alpha = -INFINITY;
                    beta = rootBestScore + aspirationWindow;
                    if (result.score <= originalAlpha) hardTimeLimit += 500; // Panic extend
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
            
            safeBestMove = result.bestMove;
            bestMove = result.bestMove;
            rootBestScore = result.score;
            lastDepthScore = result.score;
            
            lastSearchInfo.depth = depth;
            lastSearchInfo.actualDepth = depth; // Track the actual depth completed
            lastSearchInfo.score = rootBestScore;
            
            // Panic: If losing, think longer
            if (depth > 4 && rootBestScore < -100) {
                 softTimeLimit += 800;
            }
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
    
    const inCheck = game.in_check();
    let moves = orderMoves(game.moves({ verbose: true }), 0, null, null, phase, inCheck);

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
    if ((nodesVisited & 1023) === 0) { if (shouldStopSearch()) return 0; }

    if (game.in_draw()) return 0;
    
    // Enhanced repetition avoidance when ahead in material
    if (ply > 0 && isRepetition(game)) {
        const currentEval = evaluateBoard(game.board(), game.turn());
        if (currentEval > 50) { // We're ahead, strongly avoid repetition
            const materialAdvantage = Math.min(currentEval, 300);
            const repetitionPenalty = REPETITION_PENALTY + (materialAdvantage / 3);
            return currentEval - repetitionPenalty;
        } else if (currentEval > 25) { // Slightly ahead, moderate avoidance
            return currentEval - (REPETITION_PENALTY * 0.7);
        } else if (currentEval < -50) { // We're behind, repetition is okay
            return 0; // Draw is acceptable
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
            const nullScore = -search(game, depth - 1 - R, -beta, -beta + 1, ply + 1);
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
    
    let moves = orderMoves(game.moves({ verbose: true }), ply, ttMove, null, currentPhase, inCheck);
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
        cleanupPosition(game); // Clean up position tracking

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