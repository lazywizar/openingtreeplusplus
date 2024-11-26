import React from 'react';
import RepertoireService from '../services/RepertoireService';
import { chessLogic } from '../app/chess/ChessLogic';
import './MoveList.css';

export default function MoveList({ moves, onMoveClick, variant = 'standard' }) {
    const chess = chessLogic(variant);

    const moveList = moves.map((move, index) => {
        // Reset chess position and play all moves up to this point
        chess.reset();
        const movesUpToHere = moves.slice(0, index);
        movesUpToHere.forEach(m => {
            chess.move(m.san || m);
        });

        // Get current position's FEN before the move
        const currentFen = chess.fen();

        // Get recommended moves for this position from repertoire
        const recommendedMoves = RepertoireService.getRecommendedMoves(currentFen);
        const currentMove = move.san || move;

        // Check if current move is in recommended moves
        const isMatchingMove = recommendedMoves && recommendedMoves.has(currentMove);

        return (
            <div key={index} className="move-entry" onClick={() => onMoveClick(index)}>
                <span className="move-number">{Math.floor(index/2) + 1}.</span>
                <span className={`move ${isMatchingMove ? 'matching-move' : ''}`}>
                    {currentMove}
                    {isMatchingMove &&
                        <span className="repertoire-match" title="Move matches repertoire">✓</span>
                    }
                </span>
                {recommendedMoves && !isMatchingMove &&
                    <div className="repertoire-suggestion">
                        Recommended: {Array.from(recommendedMoves).join(', ')}
                    </div>
                }
            </div>
        );
    });

    return <div className="move-list">{moveList}</div>;
}