import { REPERTOIRE_CONFIG } from '../config/constants';
import { parse } from '../app/PGNParser';
import RepertoireTree from '../app/RepertoireTree';

class RepertoireService {
    constructor() {
        this.repertoire = null;
    }

    cleanPGN(pgn) {
        // Remove any BOM characters
        pgn = pgn.replace(/^\uFEFF/, '');

        // Ensure proper spacing around move numbers
        pgn = pgn.replace(/(\d+)\.(?!\.\.)(\S)/g, '$1. $2');

        // Remove any comments
        pgn = pgn.replace(/\{[^}]*\}/g, '');

        // Remove any annotations
        pgn = pgn.replace(/!|\?|\$\d+/g, '');

        // Ensure proper spacing around moves
        pgn = pgn.replace(/([NBRQK]?[a-h]?[1-8]?x?[a-h][1-8](?:=[NBRQ])?[+#]?)\s*/g, '$1 ');

        // Remove multiple spaces
        pgn = pgn.replace(/\s+/g, ' ').trim();

        // Ensure proper game termination
        if (!pgn.match(/1-0|0-1|1\/2-1\/2|\*/)) {
            pgn += ' *';
        }

        return pgn;
    }

    loadRepertoire(pgn) {
        try {
            this.repertoire = new RepertoireTree();
            const cleanedPGN = this.cleanPGN(pgn);
            console.log('Cleaned PGN:', cleanedPGN);

            const games = parse(cleanedPGN);
            console.log('Parsed games:', games);

            if (!games || games.length === 0) {
                throw new Error("No valid games found in PGN");
            }

            games.forEach((game, index) => {
                if (game.moves && game.moves.length > 0) {
                    // Convert moves array to the format we need
                    const moves = game.moves.map(move => ({
                        san: move.move || move
                    }));

                    console.log(`Game ${index} moves:`, moves);

                    // Add each move sequence to the tree
                    for (let i = 0; i < moves.length; i++) {
                        this.repertoire.addMove(moves[i], moves.slice(i + 1));
                    }
                }
            });

            // Debug log the repertoire tree
            console.log('Repertoire tree built:', this.repertoire);
        } catch (error) {
            console.error("Error loading repertoire:", error);
            throw new Error("Invalid PGN format. Please ensure your file contains valid chess moves in PGN format.");
        }
    }

    compareWithRepertoire(moves) {
        if (!this.repertoire || !moves) {
            console.log('No repertoire or moves to compare');
            return null;
        }

        const result = {
            matches: [],
            deviations: []
        };

        console.log('Comparing moves:', moves);

        let currentNode = this.repertoire;
        for (let i = 0; i < moves.length && i < REPERTOIRE_CONFIG.MAX_MOVES_TO_COMPARE; i++) {
            const move = moves[i];
            const moveStr = move.san || move;
            console.log(`Checking move ${i}:`, moveStr);

            if (currentNode.hasMove(move)) {
                console.log('Move matches repertoire');
                result.matches.push(moveStr);
                currentNode = currentNode.getNextPosition(move);
            } else {
                console.log('Move deviates from repertoire');
                result.deviations.push({
                    atMove: i + 1,
                    playedMove: moveStr,
                    repertoireLine: currentNode.getMainLine()
                });
                break;
            }
        }

        console.log('Comparison result:', result);
        return result;
    }
}

export default new RepertoireService();