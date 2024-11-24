import React from 'react';
import RepertoireService from '../services/RepertoireService';
import './MoveList.css';

export default function MoveList({ moves, onMoveClick }) {
    const moveList = moves.map((move, index) => {
        const movesUpToHere = moves.slice(0, index + 1).map(m => ({
            san: m.san || m
        }));

        const repertoireInfo = RepertoireService.compareWithRepertoire(movesUpToHere);
        console.log('Move:', move, 'RepertoireInfo:', repertoireInfo);

        const isMatchingMove = repertoireInfo?.matches.includes(move.san || move);
        const hasDeviation = repertoireInfo?.deviations.length > 0;

        return (
            <div key={index} className="move-entry" onClick={() => onMoveClick(index)}>
                <span className="move-number">{Math.floor(index/2) + 1}.</span>
                <span className="move">
                    {move.san || move}
                    {isMatchingMove &&
                        <span className="repertoire-match">✓</span>}
                </span>
                {hasDeviation && index === repertoireInfo.deviations[0].atMove - 1 &&
                    <div className="repertoire-suggestion">
                        Repertoire line: {repertoireInfo.deviations[0].repertoireLine.join(' ')}
                    </div>}
            </div>
        );
    });

    return <div className="move-list">{moveList}</div>;
}