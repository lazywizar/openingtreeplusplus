import { REPERTOIRE_CONFIG } from '../config/constants';
import { parse } from '../app/PGNParser';
import RepertoireTree from '../app/RepertoireTree';

class RepertoireService {
    constructor() {
        this.repertoire = null;
    }

    loadRepertoire(pgn) {
        try {
            this.repertoire = new RepertoireTree();
            const games = parse(pgn);

            games.forEach(game => {
                if (game.moves && game.moves.length > 0) {
                    const moves = game.moves.map(move => ({
                        san: move.move || move
                    }));

                    for (let i = 0; i < moves.length; i++) {
                        this.repertoire.addMove(moves[i], moves.slice(i + 1));
                    }
                }
            });
        } catch (error) {
            throw new Error("Invalid PGN format. Please ensure your file contains valid chess moves in PGN format.");
        }
    }

    compareWithRepertoire(moves) {
        if (!this.repertoire || !moves) return null;

        const result = {
            matches: [],
            deviations: []
        };

        let currentNode = this.repertoire;
        for (let i = 0; i < moves.length && i < REPERTOIRE_CONFIG.MAX_MOVES_TO_COMPARE; i++) {
            const move = moves[i];
            if (currentNode.hasMove(move)) {
                result.matches.push(move.san || move);
                currentNode = currentNode.getNextPosition(move);
            } else {
                break;
            }
        }

        return result;
    }
}

export default new RepertoireService();