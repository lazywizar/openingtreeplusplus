import * as Constants from '../app/Constants'
import * as Common from '../app/Common'

export function createSubObjectWithProperties(mainObject, properties) {
    let subObject = {}
    properties.forEach(property => {
        subObject[property] = mainObject[property]
    });
    return subObject
}
export function simplifiedFen(fen) {
    let fenComponents = fen.split(' ')
    // Only use piece placement and side to move, ignore castling rights,
    // en passant square, and move counters for consistent position comparison
    return `${fenComponents[0]} ${fenComponents[1]}`
}

export function getTimeControlsArray(site,timeControlState, selected) {
    let allTimeControls = site === Constants.SITE_LICHESS ?
        Common.LICHESS_TIME_CONTROLS : Common.CHESS_DOT_COM_TIME_CONTROLS
    return allTimeControls.filter((timeControl)=>!!timeControlState[timeControl] === selected)
}

export function simplifyCount(count){
    if(count>=1000000){
        return `${(count/1000000).toFixed(1)}M`
    }
    if(count>=10000){
        return `${Math.round(count/1000)}k`
    }

    return count
}

export function getPerformanceDetails(totalOpponentElo, averageElo, white, draws, black, playerColor) {
    let totalGames = white + draws + black
    let averageOpponentElo = totalOpponentElo?Math.round(totalOpponentElo/totalGames):null
    let playerWins = playerColor === Constants.PLAYER_COLOR_BLACK?black:white
    let playerLosses = playerColor !== Constants.PLAYER_COLOR_BLACK?black:white
    let score = playerWins+(draws/2)
    let scorePercentage = score*100/totalGames
    let ratingChange = Common.DP_TABLE[Math.round(scorePercentage)]
    let performanceRating = null
    if(averageOpponentElo) {
        performanceRating = averageOpponentElo+ratingChange
    }
    return {
        results:`+${simplifyCount(playerWins)}-${simplifyCount(playerLosses)}=${simplifyCount(draws)}`,
        performanceRating:performanceRating,
        averageOpponentElo: averageOpponentElo,// avg rating of opponents only
        averageElo:averageElo, // avg rating of all players
        score:`${Number.isInteger(scorePercentage)?scorePercentage:scorePercentage.toFixed(1)}% for ${playerColor === Constants.PLAYER_COLOR_BLACK?'black':'white'}`,
        ratingChange:`${ratingChange===0?'':(ratingChange>0?'+':'-')}${Math.abs(ratingChange)}`
    }
}

export function isOpponentEloInSelectedRange(elo, range) {
    if(range[1]===Constants.MAX_ELO_RATING) {
        return elo>=range[0]
    }
    return elo<=range[1] && elo>=range[0]
}

export function isDateMoreRecentThan(date, than) {
    // give priority to game which has a date
    if(!than) {
        return false
    }
    if(!date) {
        return true
    }
    return new Date(date)>new Date(than)
}

/**
 * Checks if a PGN string contains nested variations
 * @param {string} pgn PGN string to check
 * @returns {boolean} true if contains nested variations
 */
export function hasNestedVariations(pgn) {
    return pgn.includes('(') && pgn.includes(')')
}

export function flattenPGN(pgn) {
    // Clean up the PGN string
    pgn = cleanPGN(pgn);
    console.log('=== Input PGN after cleanup ===');
    console.log(pgn);

    const lines = [];
    let mainLine = [];
    let variationStack = [];
    let isBlackToMove = false;

    // Split the input into tokens
    const tokens = pgn.match(/\d+\.|\.{3}|[KQRBN]?[a-h]?[1-8]?x?[a-h][1-8]|O-O(?:-O)?|\(|\)|\S+/g) || [];

    let currentPosition = 0;
    let lastMoveNumber = 1;
    let lastWhiteMove = '';

    while (currentPosition < tokens.length) {
        const token = tokens[currentPosition];

        // Track move numbers
        if (token.match(/^\d+\.$/)) {
            lastMoveNumber = parseInt(token);
            currentPosition++;
            continue;
        }

        if (token === '(') {
            variationStack.push({
                line: [...mainLine],
                isBlack: isBlackToMove,
                moveNumber: lastMoveNumber,
                whiteMove: lastWhiteMove
            });

            // If this is a Black variation after White's move
            if (tokens[currentPosition + 1] === '...' || tokens[currentPosition + 1] === '..') {
                mainLine = mainLine.slice(0, -1);
                isBlackToMove = true;
            } else {
                mainLine = mainLine.slice(0, isBlackToMove ? -2 : -1);
                isBlackToMove = false;
            }
            currentPosition++;
            continue;
        }

        if (token === ')') {
            if (mainLine.length > 0) {
                lines.push(formatPGNLine(mainLine));
            }
            const prevState = variationStack.pop();
            mainLine = prevState.line;
            isBlackToMove = prevState.isBlack;
            lastMoveNumber = prevState.moveNumber;
            lastWhiteMove = prevState.whiteMove;
            currentPosition++;
            continue;
        }

        // Skip ellipsis
        if (token === '...' || token === '..') {
            isBlackToMove = true;
            currentPosition++;
            continue;
        }

        // Add the move to the main line
        if (token.match(/[KQRBN]?[a-h]?[1-8]?x?[a-h][1-8]|O-O(?:-O)?/)) {
            mainLine.push(token);
            if (!isBlackToMove) {
                lastWhiteMove = token;
            }
            isBlackToMove = !isBlackToMove;
        }
        currentPosition++;
    }

    // Add the main line if it's not empty
    if (mainLine.length > 0) {
        lines.push(formatPGNLine(mainLine));
    }

    return lines;
}

function cleanPGN(pgn) {
    return pgn
        // Remove comments in curly braces {comment}
        .replace(/\{[^}]*\}/g, '')

        // Remove Numeric Annotation Glyphs (NAGs) like $1, $2, etc.
        .replace(/\$\d+/g, '')

        // Remove annotation symbols (!!, !, ?!, ?, ??, ⩲, ±, etc.)
        .replace(/[!?△⌓★☆⩱⩲±∓∞⟫⟪]+/g, '')

        // Remove move evaluation marks (+-, -+, =, etc.)
        .replace(/[+\-=]+(?:\s|$)/g, '')

        // Remove result markers (1-0, 0-1, 1/2-1/2)
        .replace(/(?:1-0|0-1|1\/2-1\/2)$/g, '')

        // Remove game termination marker
        .replace(/\*$/, '')

        // Remove clock times in square brackets [%clk 1:19:00]
        .replace(/\[[%\w\s\d:.]+\]/g, '')

        // Normalize all types of dots for Black's moves
        .replace(/\.{2,}/g, '...')

        // Normalize whitespace: multiple spaces/newlines to single space
        .replace(/\s+/g, ' ')

        // Final trim
        .trim();
}

function formatPGNLine(moves) {
    let formattedLine = '';
    let moveNumber = 1;

    for (let i = 0; i < moves.length; i++) {
        if (i % 2 === 0) {
            formattedLine += moveNumber + '. ';
            moveNumber++;
        }
        formattedLine += moves[i] + ' ';
    }

    return formattedLine.trim();
}