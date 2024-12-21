import {simplifiedFen, isDateMoreRecentThan, hasNestedVariations, flattenPGN} from './util'
import * as Constants from './Constants'
import {chessLogic, rootFen} from '../app/chess/ChessLogic'

/**
 * Strips PGN headers from the input text
 * @param {string} pgn PGN text that may contain headers
 * @returns {string} PGN text with headers removed
 */
function stripPGNHeaders(pgn) {
    // Remove all header tags [...] including multi-line
    return pgn.replace(/\[\s*\w+\s*"[^"]*"\s*\]\s*/g, '')
             .trim();
}

export default class OpeningGraph {
    constructor(variant) {
        this.graph=new Graph()
        this.hasMoves = false
        this.variant = variant
        this.repertoire = new Map()
        this.repertoireColor = null
    }

    setEntries(arrayEntries, pgnStats){
        this.graph=new Graph(arrayEntries, pgnStats)
        this.hasMoves = true
    }

    clear() {
        this.graph = new Graph()
        this.hasMoves = false
    }

    addPGN(pgnStats, parsedMoves, lastFen, playerColor) {
        pgnStats.index = this.graph.pgnStats.length
        this.graph.pgnStats.push(pgnStats)
        this.graph.playerColor = playerColor
        this.hasMoves = true
        parsedMoves.forEach(parsedMove => {
            this.addMoveForFen(parsedMove.sourceFen, parsedMove.targetFen, parsedMove.moveSan, pgnStats)
        })
        this.addGameResultOnFen(lastFen, pgnStats.index)
        this.addStatsToRoot(pgnStats, this.variant)
    }

    addGameResultOnFen(fullFen, resultIndex) {
        var currNode = this.getNodeFromGraph(fullFen, true)
        if(!currNode.gameResults) {
            currNode.gameResults = []
        }
        currNode.gameResults.push(resultIndex)
    }

    addStatsToRoot(pgnStats, variant) {
        var targetNode = this.getNodeFromGraph(rootFen(variant), true)
        if(!targetNode.details) {
            targetNode.details = emptyDetails()
        }
        let newDetails = this.getUpdatedMoveDetails(targetNode.details, pgnStats)
        targetNode.details = newDetails
    }

    getDetailsForFen(fullFen) {
        let node = this.getNodeFromGraph(simplifiedFen(fullFen), false)
        let details = node && node.details
        if (Number.isInteger(details)) {
            details = this.getUpdatedMoveDetails(emptyDetails(), this.graph.pgnStats[details])
        } else if(!details) {
            return emptyDetails()
        }
        details = this.updateCalculatedValues(details)
        return details
    }

    updateCalculatedValues(details) {
        if(Number.isInteger(details.bestWin)) {
            details.bestWinGame = this.graph.pgnStats[details.bestWin]
            details.bestWinElo = this.getOpponentElo(this.graph.playerColor,details.bestWinGame)
        }
        if(Number.isInteger(details.worstLoss)) {
            details.worstLossGame = this.graph.pgnStats[details.worstLoss]
            details.worstLossElo = this.getOpponentElo(this.graph.playerColor,details.worstLossGame)
        }
        if(Number.isInteger(details.lastPlayed)) {
            details.lastPlayedGame = this.graph.pgnStats[details.lastPlayed]
        }
        if(Number.isInteger(details.longestGame)) {
            details.longestGameInfo = this.graph.pgnStats[details.longestGame]
        }
        if(Number.isInteger(details.shortestGame)) {
            details.shortestGameInfo = this.graph.pgnStats[details.shortestGame]
        }
        details.count = details.whiteWins+details.blackWins+details.draws
        return details
    }

    addMoveForFen(fullSourceFen, fullTargetFen, move, resultObject) {
        let sourceFen = simplifiedFen(fullSourceFen)
        let targetFen = simplifiedFen(fullTargetFen)

        var sourceNode = this.getNodeFromGraph(sourceFen, true)
        var targetNode = this.getNodeFromGraph(targetFen, true)

        if(!sourceNode.playedBy) {
            sourceNode.playedBy = {}
        }
        if(!sourceNode.playedBy[move]) {
            sourceNode.playedBy[move] = 0
        }
        sourceNode.playedBy[move]++

        if(!targetNode.details) {
            targetNode.details = resultObject.index
        } else {
            targetNode.details = this.getUpdatedMoveDetails(targetNode.details, resultObject)
        }

        let moveCount = sourceNode.playedBy[move]
        sourceNode.playedByMax = Math.max(sourceNode.playedByMax, moveCount)
    }

    addBookNode(fullFen, book) {
        let fen = simplifiedFen(fullFen)
        this.graph.book.set(fen, this.transform(book))
    }

    clearBookNodes(){
        this.graph.book = new Map()
    }

    transform(book) {
        if(!book || !book.moves) {
            return book
        }

        // Filter moves based on repertoire color
        let filteredMoves = book.moves.filter(move => {
            let chess = chessLogic(this.variant)
            let isWhiteMove = chess.turn() === 'w'
            return (isWhiteMove && this.repertoireColor === Constants.PLAYER_COLOR_WHITE) ||
                   (!isWhiteMove && this.repertoireColor === Constants.PLAYER_COLOR_BLACK)
        })

        return {
            fetch:"success",
            moves:filteredMoves.map((move)=>{
                let count = move.black+move.white+move.draws
                return {
                    san:move.san,
                    details:{
                        hasData:true,
                        blackWins:move.black,
                        whiteWins:move.white,
                        draws:move.draws,
                        count:count,
                        averageElo:move.averageRating
                    },
                    moveCount:count
                }
            })
        }
    }

    getBookNode(fullFen) {
        let fen = simplifiedFen(fullFen)
        return this.graph.book.get(fen)
    }

    getNodeFromGraph(fullFen, addIfNull) {
        let fen = simplifiedFen(fullFen)
        var currNode = this.graph.nodes.get(fen)
        if(!currNode && addIfNull) {
            currNode = new GraphNode()
            currNode.fen = fen
            this.graph.nodes.set(fen, currNode)
        }
        return currNode
    }

    getUpdatedMoveDetails(currentMoveDetails, resultObject) {
        if(Number.isInteger(currentMoveDetails)) {
            // if this is the second stat object being added
            // calculate the first move details and then merge it with the second one
            currentMoveDetails = this.getUpdatedMoveDetails(emptyDetails(),
                            this.graph.pgnStats[currentMoveDetails])
        } else if(!currentMoveDetails) {
            // if this is the first stat being added to this node,
            // just write the index to calculate the stats later
            return resultObject.index
        }

        let whiteWin = 0, blackWin = 0, draw = 0, resultInt = 0;
        let playerColor = this.graph.playerColor
        if(resultObject.result === '1-0') {
            whiteWin = 1
            resultInt = playerColor === Constants.PLAYER_COLOR_WHITE? 1 : -1
        } else if (resultObject.result === '0-1') {
            blackWin = 1
            resultInt = playerColor === Constants.PLAYER_COLOR_BLACK? 1 : -1
        } else {
            draw = 1
        }

        let opponentElo = this.getOpponentElo(playerColor, resultObject)
        if(resultInt === 1) {
            let currentBestWinGame = null
            if(Number.isInteger(currentMoveDetails.bestWin)) {
                currentBestWinGame = this.graph.pgnStats[currentMoveDetails.bestWin]
            }
            if(!currentBestWinGame || parseInt(opponentElo)>parseInt(this.getOpponentElo(playerColor, currentBestWinGame))) {
                currentMoveDetails.bestWin = resultObject.index
            }
        }
        if(resultInt === -1) {
            let currentWorstLossGame = null
            if(Number.isInteger(currentMoveDetails.worstLoss)) {
                currentWorstLossGame = this.graph.pgnStats[currentMoveDetails.worstLoss]
            }
            if(!currentWorstLossGame || parseInt(opponentElo)<parseInt(this.getOpponentElo(playerColor, currentWorstLossGame))) {
                currentMoveDetails.worstLoss = resultObject.index
            }
        }
        let currentLastPlayedGame = null
        if(Number.isInteger(currentMoveDetails.lastPlayed)) {
            currentLastPlayedGame = this.graph.pgnStats[currentMoveDetails.lastPlayed]
        }
        if(!currentLastPlayedGame ||
            isDateMoreRecentThan(resultObject.date, currentLastPlayedGame.date)) {
                currentMoveDetails.lastPlayed = resultObject.index
        }
        let currentLongestGame = null
        if(Number.isInteger(currentMoveDetails.longestGame)) {
            currentLongestGame = this.graph.pgnStats[currentMoveDetails.longestGame]
        }
        if(!currentLongestGame ||
            resultObject.numberOfPlys > currentLongestGame.numberOfPlys) {
                currentMoveDetails.longestGame = resultObject.index
        }

        let currentShortestGame = null
        if(Number.isInteger(currentMoveDetails.shortestGame)) {
            currentShortestGame = this.graph.pgnStats[currentMoveDetails.shortestGame]
        }
        if(!currentShortestGame ||
            resultObject.numberOfPlys < currentShortestGame.numberOfPlys) {
                currentMoveDetails.shortestGame = resultObject.index
        }

        currentMoveDetails.blackWins += blackWin
        currentMoveDetails.whiteWins += whiteWin
        currentMoveDetails.draws += draw
        currentMoveDetails.totalOpponentElo += parseInt(opponentElo)
        currentMoveDetails.hasData = true
        return currentMoveDetails
    }

    getOpponentElo(playerColor, resultObject) {
        if(playerColor === Constants.PLAYER_COLOR_WHITE) {
            return resultObject.blackElo
        }
        return resultObject.whiteElo
    }

    gameResultsForFen(fullFen) {
        let fen = simplifiedFen(fullFen)

        var currNode = this.graph.nodes.get(fen)
        if(currNode && currNode.gameResults) {
            return currNode.gameResults.map((index)=>this.graph.pgnStats[index])
        }
        return null
    }

    movesForFen(fullFen) {
        let fen = simplifiedFen(fullFen)
        let chess = chessLogic(this.variant, fullFen)
        let isWhiteToMove = chess.turn() === 'w'

        // Only get recommended moves if it's the repertoire color's turn
        let recommendedMove = null
        if ((isWhiteToMove && this.repertoireColor === Constants.PLAYER_COLOR_WHITE) ||
            (!isWhiteToMove && this.repertoireColor === Constants.PLAYER_COLOR_BLACK)) {
            recommendedMove = this.repertoire.get(fen)
        }

        var currNode = this.graph.nodes.get(fen)
        let moves = []

        if(currNode && currNode.playedBy) {
            moves = Object.entries(currNode.playedBy).map(entry => {
                let chess = chessLogic(this.variant, fullFen)
                let move = chess.move(entry[0], {sloppy: true})
                if(!move) {
                    console.warn("Failed to make move:", entry[0], "in position:", fullFen)
                    return null;
                }
                let targetFen = chess.fen()
                let details = this.getDetailsForFen(targetFen)

                let moveObj = {
                    orig: move.from,
                    dest: move.to,
                    san: move.san,
                    details: details,
                    moveCount: entry[1], // Use playedBy count which tracks actual played moves
                    isRecommended: move.san === recommendedMove
                };
                return moveObj;
            }).filter(e=>!!e && (e.moveCount > 0 || e.isRecommended))
        }

        // Add recommended move if it's not in the moves list
        if(recommendedMove && !moves.find(m => m.san === recommendedMove)) {
            let chess = chessLogic(this.variant, fullFen)
            let move = chess.move(recommendedMove, {sloppy: true})
            if(move) {
                let moveObj = {
                    orig: move.from,
                    dest: move.to,
                    san: move.san,
                    details: emptyDetails(),
                    moveCount: 0,
                    isRecommended: true
                };
                moves.push(moveObj)
            }
        }
        return moves
    }

    loadRepertoire(pgnContent, color) {
        this.chess = chessLogic(this.variant)
        this.chess.reset()

        // Strip PGN headers before processing
        pgnContent = stripPGNHeaders(pgnContent);

        // Split into lines and filter out empty ones
        let lines = pgnContent.split('\n').filter(line => line.trim())
        console.log('Input lines:', lines)

        // Check if we're dealing with nested format
        if (hasNestedVariations(pgnContent)) {
            console.log('Detected nested format, converting to flat format...')
            lines = flattenPGN(pgnContent)
            console.log('Converted to flat format:', lines)
        }

        // Clear existing repertoire
        this.repertoire.clear()
        this.repertoireColor = color

        lines.forEach((line) => {
            line = line.trim()
            if(!line.startsWith('1.')) {
                return
            }

            this.chess.reset()
            let moves = line.split(/\s+/)
            for(let i = 0; i < moves.length; i++) {
                let moveText = moves[i]
                if(moveText.match(/^\d+\./)) {
                    continue
                }

                let position = this.chess.fen()
                let simplifiedCurrentFen = simplifiedFen(position)
                let move = this.chess.move(moveText, {sloppy: true})
                if(move) {
                    let isWhiteMove = this.chess.turn() === 'b'
                    if ((isWhiteMove && this.repertoireColor === Constants.PLAYER_COLOR_WHITE) ||
                        (!isWhiteMove && this.repertoireColor === Constants.PLAYER_COLOR_BLACK)) {
                        this.repertoire.set(simplifiedCurrentFen, move.san)
                        let sourceNode = this.getNodeFromGraph(simplifiedCurrentFen, true)
                        if (!sourceNode.playedBy) {
                            sourceNode.playedBy = {}
                        }
                        if (!sourceNode.playedBy[move.san]) {
                            sourceNode.playedBy[move.san] = 0
                        }
                    }
                }
            }
        })
    }

    addRepertoireMove(fullFen, recommendedMove) {
        let fen = simplifiedFen(fullFen)
        this.repertoire.set(fen, recommendedMove)
    }

    getRepertoireMove(fullFen) {
        let fen = simplifiedFen(fullFen)
        let move = this.repertoire.get(fen)
        return move
    }
}

class Graph {
    constructor(arrayEntries, pgnStats){
        this.nodes = new Map()
        this.book = new Map()
        this.pgnStats = []
        this.playerColor = ''
        if(arrayEntries) {
            arrayEntries.forEach((entry)=> {
                this.nodes.set(entry[0],entry[1])
            })
        }
        if(pgnStats) {
            this.pgnStats = pgnStats
        }
    }
}

class GraphNode {
    playedByMax = 0 // used to keep track of how many times the most frequent move is played for ease of calculation later
    //playedBy = {}
    //gameResults = []
}

function emptyDetails() {
    return {
        hasData:false,
//        count: 0,
        blackWins: 0,
        whiteWins: 0,
        draws: 0,
        totalOpponentElo: 0,
        shortestGame:null,
        longestGame:null,
//        bestWin:null,
//        bestWinGame:null,
//        worstLoss:null,
//        worstLossGame:null,
        lastPlayed:null
//        lastPlayedGame:null
    }
}
