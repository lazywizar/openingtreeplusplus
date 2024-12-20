import {simplifiedFen, isDateMoreRecentThan} from './util'
import * as Constants from './Constants'
import {chessLogic, rootFen} from '../app/chess/ChessLogic'

export default class OpeningGraph {
    constructor(variant) {
        this.graph=new Graph()
        this.hasMoves = false
        this.variant = variant
        this.repertoire = new Map()
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
        var targetNode = this.getNodeFromGraph(fullTargetFen, true)
        let newDetails = this.getUpdatedMoveDetails(targetNode.details, resultObject)
        targetNode.details = newDetails

        var currNode = this.getNodeFromGraph(fullSourceFen, true)
        if(!currNode.playedBy) {
            currNode.playedBy = {}
        }
        let moveCount = currNode.playedBy[move]
        if(!moveCount) {
            moveCount = 0
        }
        moveCount = moveCount+1
        currNode.playedBy[move] = moveCount
        currNode.playedByMax = Math.max(currNode.playedByMax, moveCount)
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
        return {
            fetch:"success",
            moves:book.moves.map((move)=>{
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

        // Get recommended moves for both sides
        let recommendedMove = this.repertoire.get(fen)

        var currNode = this.graph.nodes.get(fen)
        let moves = []

        if(currNode && currNode.playedBy) {
            moves = Array.from(Object.entries(currNode.playedBy)).map((entry)=> {
                let chess = chessLogic(this.variant, fullFen)
                let move = chess.move(entry[0], {sloppy: true})
                if(!move) {
                    console.warn("Failed to make move:", entry[0], "in position:", fullFen)
                    return null;
                }
                let targetNodeDetails = this.getDetailsForFen(chess.fen())
                let moveObj = {
                    orig: move.from,
                    dest: move.to,
                    level: this.levelFor(entry[1], currNode.playedByMax),
                    san: move.san,
                    details: targetNodeDetails,
                    moveCount: entry[1],
                    isRecommended: move.san === recommendedMove
                };
                return moveObj;
            }).filter(e=>!!e)
        }

        if(recommendedMove && !moves.find(m => m.san === recommendedMove)) {
            let chess = chessLogic(this.variant, fullFen)
            let move = chess.move(recommendedMove, {sloppy: true})
            if(move) {
                let moveObj = {
                    orig: move.from,
                    dest: move.to,
                    level: 1,
                    san: move.san,
                    details: emptyDetails(),
                    moveCount: 0,
                    isRecommended: true
                };
                moves.push(moveObj)
            } else {
                console.warn("Failed to add recommended move:", recommendedMove, "in position:", fullFen)
            }
        }

        return moves
    }

    levelFor(moveCount, maxCount){
        if(maxCount <= 0 ||moveCount/maxCount > 0.8) {
            return 3
        }
        if(moveCount/maxCount>0.3) {
            return 2
        }
        return 1
    }

    loadRepertoire(pgnContent) {
        let chess = chessLogic(this.variant)
        console.log("Loading repertoire from PGN content:", pgnContent)
        this.repertoire.clear() // Clear existing repertoire

        // Parse PGN and process each move
        let lines = pgnContent.split('\n')

        lines.forEach((line, index) => {
            if(line.trim().startsWith('1.')) { // New variation
                chess.reset()

                // Split into moves but keep move numbers
                let moves = line.trim().split(/\s+/)
                let moveNumber = 1
                let position = null

                for(let i = 0; i < moves.length; i++) {
                    let moveText = moves[i]

                    // Skip move numbers but use them to track whose move it is
                    if(moveText.match(/^\d+\./)) {
                        moveNumber = parseInt(moveText)
                        continue
                    }

                    // Store current position before making move
                    position = chess.fen()
                    let simplifiedCurrentFen = simplifiedFen(position)

                    let move = chess.move(moveText, {sloppy: true})
                    if(move) {
                        // Store the move as recommended for the current position
                        this.repertoire.set(simplifiedCurrentFen, move.san)
                    } else {
                        console.warn("Failed to make move:", moveText)
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
