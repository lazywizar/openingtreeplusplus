import { REPERTOIRE_CONFIG } from '../config/constants';
import { parse } from '../app/PGNParser';

class RepertoireTree {
    constructor() {
        this.root = {
            moves: {},
            parent: null
        };
        this.current = this.root;
    }

    addLine(moves) {
        let node = this.root;

        moves.forEach(move => {
            const san = move.san || move;
            if (!node.moves[san]) {
                node.moves[san] = {
                    moves: {},
                    parent: node
                };
            }
            node = node.moves[san];
        });
    }

    hasMove(move) {
        const san = move.san || move;
        return !!this.current.moves[san];
    }

    getNextPosition(move) {
        const san = move.san || move;
        if (this.hasMove(move)) {
            this.current = this.current.moves[san];
            return this.current;
        }
        return null;
    }

    reset() {
        this.current = this.root;
    }
}

class RepertoireService {
    constructor() {
        this.repertoire = new RepertoireTree();
    }

    cleanPGN(pgn) {
        try {
            console.log('=== PGN Cleaning Start ===');
            console.log('Original PGN:', pgn);

            // Normalize line endings and whitespace
            pgn = pgn.replace(/\r\n/g, '\n')
                    .replace(/\r/g, '\n')
                    .trim();

            // Split into headers and moves
            let [headers, ...moveSections] = pgn.split('\n\n');

            // If there's no clear separation, try to separate headers and moves
            if (!moveSections.length) {
                const lines = pgn.split('\n');
                const headerLines = [];
                const moveLines = [];

                let inHeaders = true;
                for (const line of lines) {
                    if (line.trim().startsWith('[') && line.trim().endsWith(']')) {
                        headerLines.push(line.trim());
                    } else if (line.trim()) {
                        inHeaders = false;
                        moveLines.push(line.trim());
                    }
                }

                headers = headerLines.join('\n');
                moveSections = [moveLines.join(' ')];
            }

            let moves = moveSections.join('\n');

            // Pre-process move text
            moves = moves
                // Remove comments
                .replace(/\{[^}]*\}/g, '')
                // Remove NAGs
                .replace(/\$\d+/g, '')
                // Handle nested parentheses
                .replace(/\([^()]*(?:\([^()]*\)[^()]*)*\)/g, '')
                // Normalize whitespace
                .replace(/\s+/g, ' ')
                .trim();

            // Process moves with proper formatting
            moves = moves.split(' ').map(token => {
                // Handle move numbers
                if (/^\d+\.{1,3}$/.test(token)) {
                    return token.replace(/\.{1,3}$/, '.'); // Standardize to single period
                }
                // Fix castling notation
                if (token === '0-0') return 'O-O';
                if (token === '0-0-0') return 'O-O-O';
                return token;
            }).join(' ');

            // Clean up any remaining issues
            moves = moves
                // Ensure proper spacing after move numbers
                .replace(/(\d+\.)(\S)/g, '$1 $2')
                // Remove extra periods
                .replace(/\.{2,}/g, '.')
                // Normalize spacing
                .replace(/\s+/g, ' ')
                .trim();

            // Ensure proper game termination
            if (!moves.match(/(?:1-0|0-1|1\/2-1\/2|\*)\s*$/)) {
                moves += ' *';
            }

            const cleanedPGN = `${headers}\n\n${moves}`;
            console.log('Cleaned PGN:', cleanedPGN);
            console.log('=== PGN Cleaning End ===');

            // Validate the format before returning
            try {
                parse(cleanedPGN);
            } catch (parseError) {
                console.error('Parse validation failed:', parseError);
                throw new Error(`PGN validation failed: ${parseError.message}`);
            }

            return cleanedPGN;

        } catch (error) {
            console.error('Error in cleanPGN:', error);
            throw new Error(`PGN cleaning failed: ${error.message}`);
        }
    }

    loadRepertoire(pgn) {
        try {
            console.log('=== Loading Repertoire Start ===');

            if (!pgn || typeof pgn !== 'string') {
                throw new Error('Invalid PGN: Must be a non-empty string');
            }

            // Initialize new repertoire tree
            this.repertoire = new RepertoireTree();

            // Clean PGN
            const cleanedPGN = this.cleanPGN(pgn);

            // Parse PGN
            console.log('Parsing cleaned PGN:', cleanedPGN);
            const games = parse(cleanedPGN);
            console.log('Parsed games:', games);

            if (!games || games.length === 0) {
                throw new Error('No valid games found in PGN');
            }

            // Process each game
            games.forEach((game, index) => {
                try {
                    if (!game.moves || game.moves.length === 0) {
                        console.warn(`Game ${index + 1} has no moves, skipping`);
                        return;
                    }

                    // Convert moves to standardized format
                    const moves = game.moves.map(move => {
                        if (typeof move === 'string') {
                            return { san: move };
                        }
                        if (move.move) {
                            return { san: move.move };
                        }
                        console.warn('Invalid move format:', move);
                        throw new Error(`Invalid move format in game ${index + 1}`);
                    });

                    console.log(`Adding moves to repertoire:`, moves);
                    this.repertoire.addLine(moves);

                } catch (gameError) {
                    console.error(`Error processing game ${index + 1}:`, gameError);
                    throw new Error(`Failed to process game ${index + 1}: ${gameError.message}`);
                }
            });

            console.log('=== Loading Repertoire End ===');
            return true;

        } catch (error) {
            console.error('Error in loadRepertoire:', error);
            throw new Error(`Failed to load repertoire: ${error.message}`);
        }
    }

    compareWithRepertoire(moves) {
        if (!this.repertoire || !moves) return null;

        const result = {
            matches: [],
            deviations: []
        };

        this.repertoire.reset();
        for (let i = 0; i < moves.length && i < REPERTOIRE_CONFIG.MAX_MOVES_TO_COMPARE; i++) {
            const move = moves[i];
            if (this.repertoire.hasMove(move)) {
                result.matches.push(move.san || move);
                this.repertoire.getNextPosition(move);
            } else {
                break;
            }
        }

        return result;
    }
}

export default new RepertoireService();