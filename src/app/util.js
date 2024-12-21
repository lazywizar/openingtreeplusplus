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

/**
 * Converts a nested PGN format to flat format
 * @param {string} pgn PGN string with nested variations
 * @returns {string[]} Array of flattened variations
 */
export function flattenPGN(pgn) {
    // Clean up the PGN string
    pgn = pgn.replace(/\{[^}]*\}/g, '')   // Remove comments
         .replace(/\$\d+/g, '')            // Remove NAGs
         .replace(/\s+/g, ' ')             // Normalize whitespace
         .replace(/\*$/, '')               // Remove game termination marker
         .trim()

    console.log('Input PGN after cleanup:', pgn)
    
    // Split into tokens, keeping parentheses separate
    let tokens = pgn.replace(/\(/g, ' ( ')
                   .replace(/\)/g, ' ) ')
                   .split(/\s+/)
                   .filter(t => t.length > 0)
    
    console.log('Tokens:', tokens)
    
    let variations = []
    let stack = []
    let mainLine = []
    let currentMoves = []
    let isInVariation = false
    let basePosition = []
    
    for (let i = 0; i < tokens.length; i++) {
        let token = tokens[i]
        console.log(`Processing token: "${token}"`)
        
        if (token === '(') {
            isInVariation = true
            // Start of a variation - save current state
            console.log('Found variation start, mainLine:', mainLine.join(' '))
            stack.push([...mainLine])
            
            // Find the last white move and its number
            let lastWhiteMoveIndex = -1
            for (let j = mainLine.length - 1; j >= 0; j--) {
                if (mainLine[j].match(/^\d+\./)) {
                    lastWhiteMoveIndex = j;
                    break;
                }
            }
            
            // Get the base position (all moves up to the last white move)
            basePosition = mainLine.slice(0, lastWhiteMoveIndex + 2)
            currentMoves = [...basePosition]
            console.log('Starting variation from:', currentMoves.join(' '))
            continue
        }
        
        if (token === ')') {
            // End of variation - add it to results and restore previous state
            if (currentMoves.length > 0) {
                let variation = currentMoves.join(' ')
                // Clean up any duplicate move numbers and whitespace
                variation = variation.replace(/\s+/g, ' ').trim()
                console.log('Adding variation:', variation)
                variations.push(variation)
            }
            // Restore to previous state
            currentMoves = stack.pop()
            mainLine = [...currentMoves]
            isInVariation = stack.length > 0
            console.log('Restored mainLine to:', mainLine.join(' '))
            continue
        }
        
        // Handle move numbers and moves
        if (token.includes('...')) {
            // For black's moves in variations, add the move but skip the "..."
            if (i + 1 < tokens.length) {
                currentMoves.push(tokens[i + 1])
                if (!isInVariation) mainLine.push(token, tokens[i + 1])
                i++ // Skip the next token since we've used it
            }
        } else if (token.match(/^\d+\./)) {
            let moveNum = parseInt(token)
            // Add move number if it's the main line or a new move in variation
            if (!isInVariation || currentMoves[currentMoves.length - 1].match(/[a-zA-Z]/)) {
                currentMoves.push(token)
                if (!isInVariation) mainLine.push(token)
            }
        } else {
            // Regular move
            currentMoves.push(token)
            if (!isInVariation) mainLine.push(token)
        }
    }
    
    // Add the main line if not already in variations
    let mainLineStr = mainLine.join(' ')
    console.log('Adding main line:', mainLineStr)
    variations.unshift(mainLineStr)  // Add main line as first variation
    
    // Remove any duplicate variations and clean up
    variations = [...new Set(variations)].map(v => 
        v.replace(/\s+/g, ' ')
         .replace(/^\s+|\s+$/g, '')
    )
    
    console.log('All variations:')
    variations.forEach((v, i) => console.log(`${i + 1}. ${v}`))
    
    return variations
}