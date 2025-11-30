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

// History & Killers & TT
const HISTORY = new Map();
const KILLERS = [];
const TT = new Map();
const TT_FLAG = { EXACT: 1, LOWER: 2, UPPER: 3 };
const MAX_TT_SIZE = 2500000;
const MAX_PLY = 64;

let ttGeneration = 0;
for (let i = 0; i < MAX_PLY; i++) KILLERS.push([null, null]);

// --- TT Storage with Aging ---
function storeTT(key, depth, score, flag, bestMove) {
    const existing = TT.get(key);
    // Prefer deeper search or current generation
    const shouldReplace = !existing ||
        (existing.generation !== ttGeneration) ||
        (depth >= existing.depth) ||
        (flag === TT_FLAG.EXACT && existing.flag !== TT_FLAG.EXACT);
    
    if (shouldReplace) {
        TT.set(key, { depth, score, flag, bestMove, generation: ttGeneration });
    }
}

function probeTT(key) { return TT.get(key); }

function newSearchGeneration() {
    ttGeneration++;
    if (ttGeneration % 16 === 0 && TT.size > MAX_TT_SIZE * 0.9) {
        const threshold = ttGeneration - 4;
        for (const [k, v] of TT) {
            if (v.generation < threshold) TT.delete(k);
        }
    }
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

function evaluateKingSafety(board, color, phase) {
    if (phase < 8) return 0;
    
    let kingR = -1, kingC = -1;
    for(let r=0; r<8; r++) {
        for(let c=0; c<8; c++) {
            if(board[r][c] && board[r][c].type === 'k' && board[r][c].color === color) {
                kingR = r; kingC = c; break;
            }
        }
    }
    if (kingR === -1) return 0;

    let safety = 0;
    const shieldRank = color === 'w' ? kingR - 1 : kingR + 1;
    
    // Pawn Shield
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
                egVal += PASSED_PAWN_BONUS[rankIdx] * 1.5; 
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

    score += (evaluateKingSafety(board, 'w', phase) - evaluateKingSafety(board, 'b', phase));

    return perspectiveColor === 'w' ? score : -score;
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

function orderMoves(moves, ply = 0, ttMove = null, prevMove = null) {
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

        // 3. Killers
        if (ply < MAX_PLY) {
            const killers = KILLERS[ply];
            if (killers[0] && killers[0].from === a.from && killers[0].to === a.to) return -1;
            if (killers[0] && killers[0].from === b.from && killers[0].to === b.to) return 1;
        }

        // 4. History
        const ha = HISTORY.get(historyKey(a)) || 0;
        const hb = HISTORY.get(historyKey(b)) || 0;
        return hb - ha;
    });
}

// --- Quiescence Search ---
const QS_MAX_PLY = 24; 

function quiescence(game, alpha, beta, ply = 0) {
    const stand = evaluateBoard(game.board(), game.turn());
    
    if (stand >= beta) return beta;
    if (alpha < stand) alpha = stand;

    if (ply >= QS_MAX_PLY) return stand;

    // Generate moves
    // IMPORANT FIX: In the first 2 plies of QS, we check CHECKS too.
    // This helps see forks like Qb4+ that win material.
    const allMoves = game.moves({ verbose: true });
    
    let moves = [];
    if (ply < 2) {
        // Aggressive QS: Captures + Checks
        moves = allMoves.filter(m => 
            isCapture(m) || m.promotion || m.san.includes('+')
        );
    } else {
        // Standard QS: Captures only
        moves = allMoves.filter(m => isCapture(m) || m.promotion);
    }
    
    moves.sort((a, b) => mvvLvaScore(b) - mvvLvaScore(a));

    for (const m of moves) {
        // Delta pruning only for captures, not checks
        if (isCapture(m) && stand + (PV[m.captured] || 900) + 200 < alpha) continue;

        game.move(m);
        const score = -quiescence(game, -beta, -alpha, ply + 1);
        game.undo();

        if (score >= beta) return beta;
        if (score > alpha) alpha = score;
    }
    return alpha;
}

// --- Main Search & Time Management ---

let lastSearchInfo = { depth: 0, score: 0, bestLine: [], nodes: 0 };
let searchAborted = false;
let softTimeLimit = 0;
let hardTimeLimit = 0;
let searchStartTime = 0;
let nodesVisited = 0;

function calculateTimeLimits(game, allocatedTimeMs) {
    const soft = allocatedTimeMs * 0.6; 
    const hard = allocatedTimeMs * 1.5; 
    return { soft, hard };
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
    lastSearchInfo = { depth: 0, score: 0, bestLine: [], nodes: 0 };
    searchAborted = false;
    nodesVisited = 0;

    const book = getOpeningMove(game);
    if (book) {
        const m = game.moves({verbose:true}).find(mv => mv.san === book);
        if(m) return m;
    }

    searchStartTime = Date.now();
    const thinkTime = typeof botThinkTime !== 'undefined' ? botThinkTime : 5000;
    const limits = calculateTimeLimits(game, thinkTime);
    softTimeLimit = limits.soft;
    hardTimeLimit = limits.hard;

    let bestMove = null;
    let rootBestScore = -Infinity;
    let safeBestMove = null;

    for (let depth = 1; depth <= maxDepth; depth++) {
        if (Date.now() - searchStartTime > softTimeLimit) break;

        let alpha = -INFINITY;
        let beta = INFINITY;
        
        // Aspiration
        if (depth > 4) {
            alpha = rootBestScore - 50;
            beta = rootBestScore + 50;
        }

        let result = rootSearch(game, depth, alpha, beta);
        
        if (!searchAborted && (result.score <= alpha || result.score >= beta)) {
            // Panic extend
            if (result.score <= alpha) hardTimeLimit += 500;
            result = rootSearch(game, depth, -INFINITY, INFINITY);
        }

        if (searchAborted) break;

        if (result.bestMove) {
            safeBestMove = result.bestMove;
            bestMove = result.bestMove;
            rootBestScore = result.score;
            
            lastSearchInfo.depth = depth;
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
    const moves = orderMoves(game.moves({ verbose: true }), 0);

    for (const m of moves) {
        if (shouldStopSearch()) break;

        game.move(m);
        // PVS at Root
        let score;
        if (bestScore === -INFINITY) {
            score = -search(game, depth - 1, -beta, -alpha, 1);
        } else {
            score = -search(game, depth - 1, -alpha - 1, -alpha, 1);
            if (score > alpha && score < beta && !searchAborted) {
                score = -search(game, depth - 1, -beta, -alpha, 1);
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

function search(game, depth, alpha, beta, ply) {
    nodesVisited++;
    if ((nodesVisited & 2047) === 0) { if (shouldStopSearch()) return 0; }

    if (game.in_draw()) return 0;

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

    // Null Move Pruning
    if (!inCheck && depth >= 3 && Math.abs(beta) < MATE_SCORE) {
        const eval = evaluateBoard(game.board(), game.turn());
        if (eval >= beta) {
            const R = 2 + (depth > 6 ? 1 : 0);
            if (eval - 50 * R >= beta) return beta;
        }
    }

    const moves = orderMoves(game.moves({ verbose: true }), ply, ttMove);
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
        
        // LMR
        let reduction = 0;
        // Don't reduce captures, checks, or promotions
        if (depth >= 3 && i > 3 && !inCheck && !isCapture(m) && !m.promotion && !m.san.includes('+')) {
            reduction = 1;
            if (i > 10) reduction = 2;
        }

        let score;
        if (reduction > 0) {
            score = -search(game, depth - 1 - reduction, -alpha - 1, -alpha, ply + 1);
        } else {
            score = alpha + 1;
        }

        if (score > alpha) {
            score = -search(game, depth - 1, -beta, -alpha, ply + 1);
        }
        
        game.undo();

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
                const scoreDisplay = (lastSearchInfo.score / 100).toFixed(2);
                const info = `Bot: ${mv.san} (${time}ms, ${scoreDisplay})`;
                print(info, "line ok");
                updateBoardView();
                playMoveSound(!!mv.captured);
            }
        } catch (e) {
            console.error("Bot error:", e);
        }
        botThinking = false;
        
        if (botActive && !game.game_over()) {
            setTimeout(makeBotMove, autoplayMode ? moveDelay : 100);
        }
    }, 50);
}

function getSearchInfo() { return lastSearchInfo; }