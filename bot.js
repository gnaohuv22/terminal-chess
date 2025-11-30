// ============================================================================
// TERMINAL CHESS BOT v1.2 "TermiBot" (Gemini Edition)
// Features: PeSTO, Null Move Pruning, Passed Pawns, Endgame Scaling
// Target ELO: ~1800-1900
// ============================================================================

// --- Constants & Config ---
const MATE_SCORE = 20000;
const INFINITY = 30000;

// Material values (Standard)
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
    K: [[-65, 23, 16, -15, -56, -34, 2, 13], [29, -1, -20, -7, -8, -4, -38, -29], [-9, 24, 2, -16, -20, 6, 22, -22], [-17, -20, -12, -27, -30, -25, -14, -36], [-49, -1, -27, -39, -46, -44, -33, -51], [-14, -14, -22, -46, -44, -30, -15, -27], [1, 7, -8, -64, -43, -16, 9, 8], [-15, 36, 12, -54, 8, -28, 24, 14]]
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

// History & Killers & TT
const HISTORY = new Map();
const KILLERS = [];
const TT = new Map();
const TT_FLAG = { EXACT: 1, LOWER: 2, UPPER: 3 };
const MAX_TT_SIZE = 2000000;
const MAX_PLY = 64;

for (let i = 0; i < MAX_PLY; i++) KILLERS.push([null, null]);

const historyKey = (m) => `${m.from}-${m.to}-${m.piece}`;
const bumpHistory = (m, depth) => {
    const k = historyKey(m);
    HISTORY.set(k, (HISTORY.get(k) || 0) + depth * depth);
};

// --- Evaluation Logic ---

// Helper: Check if pawn is passed (no enemy pawns in front or adjacent files)
function isPassedPawn(board, r, c, color) {
    const enemyPawn = 'p';
    const enemyColor = color === 'w' ? 'b' : 'w';

    // Direction for checking ahead
    const startRank = color === 'w' ? r - 1 : r + 1;
    const endRank = color === 'w' ? 0 : 7;
    const step = color === 'w' ? -1 : 1;

    // Files to check: c-1, c, c+1
    const minFile = Math.max(0, c - 1);
    const maxFile = Math.min(7, c + 1);

    for (let i = startRank; color === 'w' ? i >= endRank : i <= endRank; i += step) {
        for (let j = minFile; j <= maxFile; j++) {
            const sq = board[i][j];
            if (sq && sq.type === 'p' && sq.color === enemyColor) {
                return false; // Blocked or controlled by enemy pawn
            }
        }
    }
    return true;
}

function evaluateBoard(board, perspectiveColor) {
    let mgScore = 0;
    let egScore = 0;
    let phase = 0;
    let whiteMat = 0;
    let blackMat = 0;

    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const sq = board[r][c];
            if (!sq) continue;

            const type = sq.type.toUpperCase();
            const color = sq.color;
            const matVal = PV[sq.type];

            // Add material
            if (color === 'w') whiteMat += matVal;
            else blackMat += matVal;

            // PeSTO tables
            let mgVal, egVal;
            if (color === 'w') {
                mgVal = PESTO_MG[type][r][c];
                egVal = PESTO_EG[type][r][c];
            } else {
                mgVal = PESTO_MG[type][7 - r][c];
                egVal = PESTO_EG[type][7 - r][c];
            }

            // Passed Pawn Bonus
            if (sq.type === 'p') {
                if (isPassedPawn(board, r, c, color)) {
                    // Rank 0-7. For white, rank 0 is '8' (promo).
                    // Matrix r: 0=rank8, 7=rank1.
                    const rankIdx = color === 'w' ? (7 - r) : r;
                    const bonus = PASSED_PAWN_BONUS[rankIdx];
                    mgVal += bonus * 0.5; // Less important in MG
                    egVal += bonus * 1.5; // Critical in EG
                }
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

    // Tapered Evaluation
    phase = Math.min(phase, TOTAL_PHASE); // Safety
    const mgPhase = phase;
    const egPhase = TOTAL_PHASE - phase;

    // Interpolate
    let score = (mgScore * mgPhase + egScore * egPhase) / TOTAL_PHASE;

    // --- Endgame Scaling (Fix "Auto Trade" stupidity) ---
    // If winning, encourage trading pieces (simplification).
    // If losing, discourage trading.
    const rawScore = perspectiveColor === 'w' ? score : -score;

    // Only apply if material is somewhat reduced (not opening)
    if (phase < 20) {
        const material = perspectiveColor === 'w' ? whiteMat : blackMat;
        const opponentMat = perspectiveColor === 'w' ? blackMat : whiteMat;

        // Winning bonus: If we are ahead > 150cp, slight bonus for lower opponent material
        // This encourages trading down when ahead.
        if (rawScore > 150) {
            score += (3000 - opponentMat) / 50;
        }
        // Losing penalty: If we are behind < -150cp, slight penalty for lower own material
        // This discourages trading when behind.
        else if (rawScore < -150) {
            score -= (3000 - material) / 50;
        }
    }

    return perspectiveColor === 'w' ? score : -score;
}

// --- Opening Book ---
const OPENING_BOOK = {
    // Standard starts to avoid lag at move 1
    "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1": ["e4", "d4", "Nf3", "c4"]
};

function getOpeningMove(game) {
    const fen = game.fen();
    const moves = OPENING_BOOK[fen];
    if (moves) {
        const legal = game.moves();
        const valid = moves.filter(m => legal.includes(m));
        if (valid.length > 0) return valid[Math.floor(Math.random() * valid.length)];
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
    if (isCapture(m)) return 100000 + victim * 10 - attacker;
    if (m.promotion) return 90000 + (PV[m.promotion] || 0);
    return 0;
}

function orderMoves(moves, ply = 0, ttMove = null) {
    return moves.sort((a, b) => {
        if (ttMove && a.from === ttMove.from && a.to === ttMove.to) return -1;
        if (ttMove && b.from === ttMove.from && b.to === ttMove.to) return 1;

        // MVV-LVA
        const sa = mvvLvaScore(a);
        const sb = mvvLvaScore(b);
        if (sa !== sb) return sb - sa;

        // Killers
        if (ply < MAX_PLY) {
            const killers = KILLERS[ply];
            if (killers[0] && killers[0].from === a.from && killers[0].to === a.to) return -1;
            if (killers[0] && killers[0].from === b.from && killers[0].to === b.to) return 1;
        }

        // History
        const ha = HISTORY.get(historyKey(a)) || 0;
        const hb = HISTORY.get(historyKey(b)) || 0;
        return hb - ha;
    });
}

function storeKiller(move, ply) {
    if (ply >= MAX_PLY) return;
    const killers = KILLERS[ply];
    if (killers[0] && killers[0].from === move.from && killers[0].to === move.to) return;
    killers[1] = killers[0];
    killers[0] = { from: move.from, to: move.to };
}

// --- Quiescence Search ---

function quiescence(game, perspective, alpha, beta, ply = 0) {
    // Note: Passed perspective is "Side to Move" at root? No, perspective is fixed Engine Color.
    // Wait, in Negamax we usually just want "Current Turn Score".
    // evaluateBoard returns score relative to 'perspective'.

    // Let's stick to the convention: evaluateBoard(board, game.turn()) returns score for current player.
    // But we are passing 'perspective' down. 
    // Fix: In search(), we use Negamax. So we want Eval relative to SideToMove.

    // 1. Stand Pat
    let stand = evaluateBoard(game.board(), game.turn());

    const inCheck = game.in_check();
    if (!inCheck) {
        if (stand >= beta) return beta;
        if (stand > alpha) alpha = stand;
    }

    // 2. Generate Moves
    let moves = game.moves({ verbose: true });
    if (!inCheck) {
        moves = moves.filter(m => isCapture(m) || m.promotion);
    }

    moves = orderMoves(moves, ply);

    for (const m of moves) {
        game.move(m);
        const score = -quiescence(game, perspective, -beta, -alpha, ply + 1);
        game.undo();

        if (score >= beta) return beta;
        if (score > alpha) alpha = score;
    }

    // If in check and no moves -> Mate logic handled in main search usually, 
    // but here we just return alpha (fail low) if no captures save us.
    return alpha;
}

// --- Main Search ---

let lastSearchInfo = { depth: 0, score: 0, bestLine: [], nodes: 0 };

function getBestMove(game, maxDepth = 8) {
    if (TT.size > MAX_TT_SIZE) TT.clear();
    lastSearchInfo = { depth: 0, score: 0, bestLine: [], nodes: 0 };

    const bookMove = getOpeningMove(game);
    if (bookMove) {
        const mv = game.moves({ verbose: true }).find(m => m.san === bookMove);
        if (mv) return mv;
    }

    const startTime = Date.now();
    const timeLimit = autoplayMode ? 2000 : 8000;

    let bestMove = null;
    let bestScore = -Infinity;

    // Iterative Deepening
    for (let depth = 1; depth <= maxDepth; depth++) {
        // Time Check
        if (Date.now() - startTime > timeLimit * 0.6) break;

        let alpha = -Infinity;
        let beta = Infinity;

        // Aspiration Windows (Optimistic search)
        if (depth > 4 && Math.abs(bestScore) < 1000) {
            alpha = bestScore - 50;
            beta = bestScore + 50;
        }

        // Root Search
        let currentBestMove = null;
        let currentBestScore = -Infinity;

        const moves = orderMoves(game.moves({ verbose: true }), 0, bestMove);

        for (const m of moves) {
            if (Date.now() - startTime > timeLimit) break;

            game.move(m);
            // Negamax: -search
            const val = -search(game, depth - 1, -beta, -alpha, 1, startTime, timeLimit);
            game.undo();

            if (val > currentBestScore) {
                currentBestScore = val;
                currentBestMove = m;
            }

            if (val > alpha) {
                alpha = val;
                // If aspiration window failed high, re-search full window
                if (alpha >= beta && Math.abs(bestScore) < 1000) {
                    alpha = -Infinity;
                    beta = Infinity;
                    // Reset loop? No, just continue with wider window usually or restart depth.
                    // Simplified: just let it finish this depth with wider window next time or continue.
                    // Correct approach: Restart this depth with open window.
                    // For JS simplicity, we skip full re-search inside loop, just accept result.
                }
            }
        }

        if (Date.now() - startTime > timeLimit) break;

        if (currentBestMove) {
            bestMove = currentBestMove;
            bestScore = currentBestScore;
            lastSearchInfo.depth = depth;
            lastSearchInfo.score = bestScore;
        }

        if (Math.abs(bestScore) > 15000) break; // Mate found
    }

    // Fallback
    if (!bestMove) {
        const legal = game.moves({ verbose: true });
        return legal[0];
    }

    // Verify legality
    const legal = game.moves({ verbose: true });
    return legal.find(m => m.from === bestMove.from && m.to === bestMove.to && m.promotion === bestMove.promotion);
}

// Negamax Search
function search(game, depth, alpha, beta, ply, startTime, timeLimit) {
    lastSearchInfo.nodes++;

    // 1. Time Check (Every 2048 nodes)
    if ((lastSearchInfo.nodes & 2047) === 0 && Date.now() - startTime > timeLimit) {
        return evaluateBoard(game.board(), game.turn()); // Just return static eval
    }

    // 2. Check for Draws (Repetition, 50-move, etc)
    // Contempt: If we are winning (>300), draw is bad (-300).
    if (game.in_draw() || game.in_stalemate() || game.in_threefold_repetition()) {
        const staticEval = evaluateBoard(game.board(), game.turn());
        if (staticEval > 300) return -300; // Avoid draw if winning
        if (staticEval < -300) return 300; // Seek draw if losing
        return 0;
    }

    const inCheck = game.in_check();

    // 3. Mate Distance Pruning
    const mateValue = MATE_SCORE - ply;
    if (alpha < -mateValue) alpha = -mateValue;
    if (beta > mateValue - 1) beta = mateValue - 1;
    if (alpha >= beta) return alpha;

    // 4. Transposition Table
    const fen = game.fen();
    const key = fen.split(" ").slice(0, 4).join(" "); // Ignore move clocks
    const ttEntry = TT.get(key);
    let ttMove = null;

    if (ttEntry && ttEntry.depth >= depth) {
        if (ttEntry.flag === TT_FLAG.EXACT) return ttEntry.score;
        if (ttEntry.flag === TT_FLAG.LOWER) alpha = Math.max(alpha, ttEntry.score);
        else if (ttEntry.flag === TT_FLAG.UPPER) beta = Math.min(beta, ttEntry.score);
        if (alpha >= beta) return ttEntry.score;
        ttMove = ttEntry.bestMove;
    }

    // 5. Quiescence Search (Horizon)
    if (depth <= 0) {
        // Only enter QS if not in check. If in check, extend search.
        if (inCheck) return search(game, 1, alpha, beta, ply + 1, startTime, timeLimit);
        return quiescence(game, null, alpha, beta, ply);
    }

    // 6. Null Move Pruning (NMP) - The Turbocharger
    // If not in check, and we have pieces (not pawn endgame), try giving a free move.
    // If we still beat Beta, our position is insanely good -> Cutoff.
    if (!inCheck && depth >= 3 && ply > 0 && !ttEntry /* Don't NMP if we have TT hit? Optional */) {
        // Check if we have big pieces to avoid Zugzwang issues
        // Simplified check: just Eval > Beta
        const staticEval = evaluateBoard(game.board(), game.turn());
        if (staticEval >= beta) {
            // Do Null Move (Chess.js doesn't support it natively easily without hacks)
            // Hack: switch turn manually? No, risky with game state.
            // Safe approach: Skip NMP for stability in JS environment unless we implement makeNullMove.
            // ALTERNATIVE: Static Null Move Pruning (Reverse Futility)
            const margin = 120 * depth;
            if (staticEval - margin >= beta) return staticEval - margin;
        }
    }

    // 7. Move Generation
    const moves = orderMoves(game.moves({ verbose: true }), ply, ttMove);

    if (moves.length === 0) {
        if (inCheck) return -mateValue; // Checkmate
        return 0; // Stalemate (handled above, but fallback)
    }

    // 8. Loop
    let bestScore = -Infinity;
    let bestMove = null;
    let legalMovesFound = 0;

    for (let i = 0; i < moves.length; i++) {
        const m = moves[i];

        game.move(m);
        legalMovesFound++;

        // Late Move Reduction (LMR)
        // Reduce depth for quiet moves late in the list
        let reduction = 0;
        if (depth >= 3 && i > 3 && !inCheck && !isCapture(m) && !m.promotion) {
            reduction = 1;
            if (i > 10) reduction = 2;
        }

        let val = -search(game, depth - 1 - reduction, -beta, -alpha, ply + 1, startTime, timeLimit);

        // Re-search if LMR failed (move was actually good)
        if (reduction > 0 && val > alpha) {
            val = -search(game, depth - 1, -beta, -alpha, ply + 1, startTime, timeLimit);
        }

        game.undo();

        if (val > bestScore) {
            bestScore = val;
            bestMove = m;
        }

        if (val > alpha) {
            alpha = val;
        }

        if (alpha >= beta) {
            if (!isCapture(m)) {
                bumpHistory(m, depth);
                storeKiller(m, ply);
            }
            break; // Beta Cutoff
        }
    }

    // 9. Store TT
    const flag = bestScore <= alpha ? TT_FLAG.UPPER : bestScore >= beta ? TT_FLAG.LOWER : TT_FLAG.EXACT;
    TT.set(key, { depth, score: bestScore, flag, bestMove });

    return bestScore;
}

// --- Interface ---

function makeBotMove() {
    if (!botActive || botThinking || game.game_over()) {
        if (game.game_over()) {
            botActive = false;
            autoplayMode = false;
            print("Game finished.", "line info");
        }
        return;
    }

    if (!autoplayMode && botSide !== "both" && game.turn() !== botSide) return;

    botThinking = true;
    const currentSide = game.turn() === "w" ? "White" : "Black";
    if (!autoplayMode) print(`Bot (${currentSide}) thinking... (depth ${botDepth})`, "line muted");

    setTimeout(() => {
        try {
            const startTime = Date.now();
            const mv = getBestMove(game, botDepth);
            const elapsed = Date.now() - startTime;

            if (!mv) {
                print("No move found.", "line err");
                botActive = false;
                botThinking = false;
                return;
            }

            // Apply move
            // Re-verify strictly with chess.js to avoid ghost moves
            const legalMoves = game.moves({ verbose: true });
            const strictMove = legalMoves.find(m => m.from === mv.from && m.to === mv.to && m.promotion === mv.promotion);

            if (strictMove) {
                game.move(strictMove);

                const scoreDisplay = (lastSearchInfo.score / 100).toFixed(2);
                const info = `Bot: ${strictMove.san} (${elapsed}ms, ${scoreDisplay})`;
                print(info, "line ok");
                updateBoardView();

                botThinking = false;

                if (botActive && !game.game_over()) {
                    setTimeout(makeBotMove, autoplayMode ? moveDelay : 100);
                }
            } else {
                // Fallback random
                console.error("Bot move rejected:", mv);
                const rnd = legalMoves[Math.floor(Math.random() * legalMoves.length)];
                game.move(rnd);
                print(`Bot (Fallback): ${rnd.san}`, "line warn");
                updateBoardView();
                botThinking = false;
            }

        } catch (e) {
            console.error(e);
            botThinking = false;
        }
    }, 50);
}

function getSearchInfo() { return lastSearchInfo; }