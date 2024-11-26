import { MAX_MOVES_TO_COMPARE } from '../config/constants';
import { parse } from '../app/PGNParser';
const Chess = require('chess.js');

class RepertoireService {
    constructor() {
        // Map of FEN positions to recommended moves
        this.positionMap = new Map();
        this.playerColor = null;
    }

    loadRepertoire(pgn) {
        try {
            console.log('=== Loading Repertoire Start ===');

            if (!pgn || typeof pgn !== 'string') {
                throw new Error('Invalid PGN: Must be a non-empty string');
            }

            // Clean PGN
            const cleanedPGN = this.cleanPGN(pgn);

            // Parse PGN
            console.log('Parsing cleaned PGN:', cleanedPGN);
            const games = parse(cleanedPGN);

            if (!games || games.length === 0) {
                throw new Error('No valid games found in PGN');
            }

            // Reset position map
            this.positionMap.clear();

            // Process each game to build position map
            games.forEach((game, index) => {
                try {
                    if (!game.moves || game.moves.length === 0) {
                        console.warn(`Game ${index + 1} has no moves, skipping`);
                        return;
                    }

                    // Determine player color from first game
                    if (index === 0) {
                        const firstMove = game.moves[0].move || game.moves[0];
                        this.playerColor = firstMove === '1.' ? 'black' : 'white';
                        console.log('Detected player color:', this.playerColor);
                    }

                    this.processGameMoves(game.moves);

                } catch (gameError) {
                    console.error(`Error processing game ${index + 1}:`, gameError);
                }
            });

            console.log(`Loaded repertoire with ${this.positionMap.size} positions`);
            console.log('=== Loading Repertoire End ===');
            return true;

        } catch (error) {
            console.error('Error in loadRepertoire:', error);
            throw error;
        }
    }

    processGameMoves(moves) {
        const chess = new Chess();

        moves.forEach((move, index) => {
            const san = move.move || move;
            const isPlayerMove = this.isPlayerMove(chess);

            if (isPlayerMove) {
                // Store the position before the move
                const fen = chess.fen();
                if (!this.positionMap.has(fen)) {
                    this.positionMap.set(fen, new Set());
                }
                this.positionMap.get(fen).add(san);
            }

            try {
                chess.move(san);
            } catch (error) {
                console.warn(`Invalid move ${san}:`, error);
            }
        });
    }

    isPlayerMove(chess) {
        return (chess.turn() === 'w' && this.playerColor === 'white') ||
               (chess.turn() === 'b' && this.playerColor === 'black');
    }

    compareWithRepertoire(moves) {
        if (!moves || moves.length === 0) return null;

        const result = {
            matches: [],
            deviations: []
        };

        const chess = new Chess();

        for (let i = 0; i < moves.length && i < MAX_MOVES_TO_COMPARE; i++) {
            const move = moves[i];
            const san = move.san || move;

            if (this.isPlayerMove(chess)) {
                const position = chess.fen();
                const recommendedMoves = this.positionMap.get(position);

                if (recommendedMoves && recommendedMoves.has(san)) {
                    result.matches.push(san);
                } else if (recommendedMoves) {
                    result.deviations.push({
                        atMove: i + 1,
                        playedMove: san,
                        repertoireLine: Array.from(recommendedMoves)
                    });
                    break;
                }
            }

            try {
                chess.move(san);
            } catch (error) {
                console.warn(`Invalid move ${san}:`, error);
                break;
            }
        }

        return result;
    }

    cleanPGN(pgn) {
        try {
            console.log('=== PGN Cleaning Start ===');
            console.log('Original PGN:', pgn);

            // First normalize all line endings to \n
            pgn = pgn.replace(/\r\n|\r/g, '\n');

            // Split into headers and moves
            let [headers, ...moveSections] = pgn.split('\n\n');
            let moves = moveSections.join('\n').trim();

            // Clean up comments only, preserve variations
            let cleanedMoves = '';
            let inComment = false;

            for (let i = 0; i < moves.length; i++) {
                const char = moves[i];

                // Skip carriage returns
                if (char === '\r') continue;

                if (char === '{') {
                    inComment = true;
                    continue;
                }
                if (char === '}') {
                    inComment = false;
                    continue;
                }
                if (inComment) continue;

                // Keep the character (including parentheses for variations)
                cleanedMoves += char;
            }

            // Clean up the remaining text
            cleanedMoves = cleanedMoves
                // Remove NAGs
                .replace(/\$\d+/g, '')
                // Fix move numbers
                .replace(/(\d+)\.+/g, '$1.')
                // Ensure space after move numbers
                .replace(/(\d+\.)(\S)/g, '$1 $2')
                // Normalize castling
                .replace(/0-0-0/g, 'O-O-O')
                .replace(/0-0/g, 'O-O')
                // Clean excess whitespace including carriage returns
                .replace(/[\s\r]+/g, ' ')
                .trim();

            // Ensure proper game termination
            if (!cleanedMoves.match(/(?:1-0|0-1|1\/2-1\/2|\*)\s*$/)) {
                cleanedMoves += ' *';
            }

            // Ensure proper spacing between headers and moves
            const cleanedPGN = `${headers}\n\n${cleanedMoves}`;

            console.log('Cleaned PGN:', cleanedPGN);
            console.log('=== PGN Cleaning End ===');

            return cleanedPGN;

        } catch (error) {
            console.error('Error in cleanPGN:', error);
            throw new Error(`PGN cleaning failed: ${error.message}\nOriginal PGN: ${pgn}`);
        }
    }

    getRecommendedMoves(fen) {
        return this.positionMap.get(fen);
    }
}

export default new RepertoireService();