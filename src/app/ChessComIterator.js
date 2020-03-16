import ChessWebAPI from 'chess-web-api'
import { parse }  from './PGNParser'
import request from 'request'

export default class ChessComIterator {

    constructor(playerName, ready, showError) {
        let chessAPI = new ChessWebAPI({
            queue: true,
        });

        let parseGames= (archiveResponse)=>{
            let continueProcessing = ready(archiveResponse.body.games.filter(game=>game.rules==="chess").map(game=>parse(game.pgn)[0]))
            if(!continueProcessing) {
                while(chessAPI.dequeue()){}
            }
        }

        let fetchAllGames = function(responseBody) {
            responseBody.archives.reverse().forEach((archiveUrl)=>{
                let components=archiveUrl.split('/')
                let year=components[components.length-2]
                let month=components[components.length-1]
                chessAPI.dispatch(chessAPI.getPlayerCompleteMonthlyArchives, parseGames, [playerName, year, month]);
            })
        }
        request(`https://api.chess.com/pub/player/${playerName}/games/archives`, function (error, response, body) {
            if(error) {
                showError('Could not connect to chess.com')
            } else if(response.statusCode === 404) {
                showError('Could not find chess.com user '+playerName)
            } else if (response.statusCode !== 200) {
                showError('Could not load games for chess.com user '+playerName)
            } else {
                if(response.body) {
                    try{
                        let jsonBody = JSON.parse(response.body)
                        fetchAllGames(jsonBody)
                    }catch(e) {
                        showError('Could not find games for chess.com user '+playerName)
                    }
                }
            }
        });
    }
}