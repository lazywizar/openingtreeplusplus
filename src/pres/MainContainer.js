import React from 'react'
import Chessground from 'react-chessground'
import 'react-chessground/dist/styles/chessground.css'
import { OAuth2AuthCodePKCE } from '@bity/oauth2-auth-code-pkce';

import {
  Button,
  Col,
  Collapse,
  Container,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Row
} from 'reactstrap'

import {
  Checkbox,
  FormControlLabel,
  Snackbar,
  TextField
} from '@material-ui/core'

import * as Constants from '../app/Constants'
import OpeningGraph from '../app/OpeningGraph'
import { chessLogic } from '../app/chess/ChessLogic'
import cookieManager from '../app/CookieManager'
import UserProfile, { USER_PROFILE_NEW_USER } from '../app/UserProfile'
import {initializeAnalytics} from '../app/Analytics'
import { fetchBookMoves } from '../app/OpeningBook'

import Navigator from './Navigator'
import GlobalHeader from './GlobalHeader'
import ControlsContainer from './ControlsContainer'
import { addStateManagement } from './StateManagement'
import SnackbarContentWrapper from './SnackbarContentWrapper'
export default class MainContainer extends React.Component {

  constructor(props){
    super(props)

    let urlVariant = new URLSearchParams(window.location.search).get("variant")
    let selectedVariant = urlVariant || Constants.VARIANT_STANDARD
    this.chess = chessLogic(selectedVariant)
    addStateManagement(this)
    this.state = {
        resize:0,
        fen: this.chess.fen(),
        lastMove: null,
        gamesProcessed:0,
        openingGraph:new OpeningGraph(selectedVariant),
        settings:{
          playerName:'',
          orientation:Constants.PLAYER_COLOR_WHITE,
          playerColor:'',
          movesSettings:this.getMovesSettingsFromCookie(),
          darkMode: this.getDarkModeSettingFromCookie()
        },
        message:'',
        downloadingGames:false,
        feedbackOpen:false,
        diagnosticsDataOpen:false,
        variant:selectedVariant,
        update:0,
        highlightedMove:null,
        boardKey: 0
    }
    this.chessboardWidth = this.getChessboardWidth()
    this.pendingBookMoves = new Map()
    this._isMounted = false

    this.initializeOauth()

    this.forBrushes = ['blue','paleGrey', 'paleGreen', 'green']
    this.againstBrushes = ['blue','paleRed', 'paleRed', 'red']
    this.handleResize = this.handleResize.bind(this)
    window.addEventListener('resize', this.handleResize)
    let userProfile = UserProfile.getUserProfile()
    initializeAnalytics(userProfile.userTypeDesc, this.state.settings.darkMode?"dark":"light",
      this.state.settings.movesSettings.openingBookType)
  }

  componentDidMount() {
    this._isMounted = true;
    window.addEventListener('resize', this.handleResize);
  }

  componentWillUnmount() {
    this._isMounted = false;
    window.removeEventListener('resize', this.handleResize);
    // Cleanup pending book moves
    this.pendingBookMoves.forEach(controller => {
      if (controller) {
        controller.abort();
      }
    });
    this.pendingBookMoves.clear();
  }

  initializeOauth() {
    let clientUrl = (() => {
      const url = new URL(window.location.href);
      url.search = '';
      return `${url.href}?source=lichess`;
    })();
    this.oauth = new OAuth2AuthCodePKCE({
      authorizationUrl: `${Constants.LICHESS_HOST}/oauth`,
      tokenUrl: `${Constants.LICHESS_HOST}/api/token`,
      clientId: Constants.LICHESS_CLIENT_ID,
      scopes: [],
      redirectUrl: clientUrl,
      onAccessTokenExpiry: refreshAccessToken => refreshAccessToken(),
      onInvalidGrant: _retry => {},
    })

    this.oauth.isReturningFromAuthServer().then( (hasAuthCode) => {
      if (hasAuthCode) {
        return this.oauth.getAccessToken()
      }
      return ""
    }).then( (accessToken)=> {
      if(!accessToken) {
        return
      }
      cookieManager.setLichessAccessToken(accessToken.token.value)
      console.log("access token", accessToken)
      window.location.replace(clientUrl)
    }).catch((error) => {
      console.log("error", error)
    })
  }

  handleResize() {
    if (!this._isMounted) return;
    this.chessboardWidth = this.getChessboardWidth();
    this.setState(state => ({
      resize: state.resize + 1
    }));
  }

  getMovesSettingsFromCookie() {
    let { movesSettings } = cookieManager.getSettingsCookie() || {};

    if (!movesSettings || !movesSettings.openingBookType) {
      // default settings
      movesSettings = {
          openingBookType:Constants.OPENING_BOOK_TYPE_LICHESS,
          openingBookRating:Constants.ALL_BOOK_RATINGS,
          openingBookTimeControls: [
            Constants.TIME_CONTROL_BULLET,
            Constants.TIME_CONTROL_BLITZ,
            Constants.TIME_CONTROL_RAPID,
            Constants.TIME_CONTROL_CLASSICAL,
            Constants.TIME_CONTROL_CORRESPONDENCE,
          ],
          openingBookScoreIndicator:false,
          openingBookWinsIndicator:UserProfile.getUserProfile().userType>USER_PROFILE_NEW_USER
        }
    }
    return movesSettings;
  }

  getDarkModeSettingFromCookie () {
    const darkModeCookie = cookieManager.getDarkModeCookie();
    if(darkModeCookie === undefined || darkModeCookie === null){
      return true; // default value
    }
    return darkModeCookie !== 'false'; // treat anything except explicit 'false' as true
  }

  forceFetchBookMoves() {
    // Cancel any existing fetch for this position
    const existingController = this.pendingBookMoves.get(this.state.fen)
    if (existingController) {
      existingController.abort()
      this.pendingBookMoves.delete(this.state.fen)
    }

    // Create new abort controller for this fetch
    const controller = new AbortController()
    this.pendingBookMoves.set(this.state.fen, controller)

    // Start the fetch but don't add the moves yet
    fetchBookMoves(
      this.state.fen,
      this.state.variant,
      this.state.settings.movesSettings,
      (fetchedMoves) => {
        if (!this._isMounted) return
        // Only add the moves once they're actually fetched
        if (fetchedMoves && fetchedMoves.moves) {
          this.state.openingGraph.addBookNode(this.chess.fen(), fetchedMoves)
          this.setState({
            update: this.state.update + 1
          })
        }
        this.pendingBookMoves.delete(this.state.fen)
      },
      controller.signal
    )

    // Return a pending state while we wait for the moves
    return { fetch: 'pending' }
  }

  componentDidUpdate(prevProps, prevState) {
    // If FEN changes, increment boardKey to force clean remount
    if (prevState.fen !== this.state.fen) {
      this.setState(state => ({
        boardKey: state.boardKey + 1
      }))
    }
  }

  render() {
    const playerMoves = this.getPlayerMoves()
    let shapes = [];
    
    if (this.state.highlightedMove && typeof this.state.highlightedMove === 'string') {
      shapes = [{
        orig: this.state.highlightedMove.substring(0, 2),
        dest: this.state.highlightedMove.substring(2, 4),
        brush: 'paleBlue'
      }];
    }

    let lastMoveArray = this.state.lastMove ? [this.state.lastMove.from, this.state.lastMove.to] : null
    let snackBarOpen = Boolean(this.state.message)

    let bookMoves = this.getBookMoves()
    if(bookMoves) {
        this.mergePlayerAndBookMoves(playerMoves, bookMoves)
    }

    return <div className="rootView">
      <GlobalHeader settings={this.state.settings}
                    settingsChange={this.settingsChange.bind(this)}
                    toggleFeedback = {this.toggleFeedback(false)}/>
      <Container className="mainContainer">
        <Row>
          <Col lg={{order:0, size:2}} xs={{order:2}}>
            <Navigator fen = {this.state.fen} move={this.state.lastMove}
              onChange ={this.navigateTo.bind(this)}
              variant = {this.state.variant}
              playerMoves={playerMoves} />
          </Col>
          <Col lg="6">
            <div style={{ width: this.chessboardWidth, height: this.chessboardWidth }}>
              <Chessground 
                key={`${this.state.resize}-${this.state.boardKey}`}
                width={this.chessboardWidth}
                height={this.chessboardWidth}
                orientation={this.orientation()}
                turnColor={this.turnColor()}
                movable={this.calcMovable()}
                lastMove={lastMoveArray}
                fen={this.state.fen}
                onMove={this.onMoveAction.bind(this)}
                animation={{ enabled: true, duration: 150 }}
                drawable={{
                  enabled: true,
                  visible: true,
                  autoShapes: shapes || [],
                  brushes: {
                    paleBlue: { key: 'b', color: '#003088', opacity: 0.4, lineWidth: 10 }
                  }
                }}
              />
            </div>
          </Col>
          <Col lg="4" className="paddingTop">
            <ControlsContainer fen={this.state.fen}
              resize ={this.state.resize}
              gamesProcessed={this.state.gamesProcessed}
              updateProcessedGames={this.updateProcessedGames.bind(this)}
              settingsChange={this.settingsChange.bind(this)}
              settings={this.state.settings}
              reset={this.reset.bind(this)}
              clear={this.clear.bind(this)}
              playerMoves={playerMoves}
              bookMoves={bookMoves}
              gameResults={this.gameResults()}
              onMove={this.onMove.bind(this)}
              turnColor={this.turnColor()}
              showError={this.showError.bind(this)}
              showInfo={this.showInfo.bind(this)}
              setDownloading={this.setDownloading.bind(this)}
              isDownloading={this.state.downloadingGames}
              openingGraph={this.state.openingGraph}
              importCallback={this.importGameState.bind(this)}
              variant={this.state.variant}
              variantChange={this.variantChange.bind(this)}
              forceFetchBookMoves={this.forceFetchBookMoves.bind(this)}
              highlightArrow={this.highlightArrow.bind(this)}
              oauthManager={this.oauth}
              getPlayerMoves={this.getPlayerMoves.bind(this)}
            />
          </Col>
        </Row>
      </Container>
      <Snackbar anchorOrigin={{ vertical:'bottom', horizontal:"left" }}
        open={snackBarOpen} autoHideDuration={6000}
        onClose={this.closeError.bind(this)}
      >
        <SnackbarContentWrapper
          onClose={this.closeError.bind(this)}
          variant={this.state.messageSeverity}
          message={this.state.message}
          subMessage={this.state.subMessage}
          showReportButton={this.state.messageSeverity==='error'}
          action={this.state.errorAction}
          actionText={this.state.errorActionText}
        />
      </Snackbar>

      <Modal isOpen={this.state.feedbackOpen} toggle={this.toggleFeedback(false)}>
        <ModalHeader toggle={this.toggleFeedback(false)}>
          Feedback
        </ModalHeader>
        <ModalBody>
          Your feedback is greatly appreciated. Reach out to me for feedback, suggestions, bug report or just a game of chess.
          <ul>
            <li>Email me: <a rel="noopener noreferrer" href={this.getEmailLink()} target="_blank">{Constants.OPENING_TREE_EMAIL}</a></li>
            <li>Message me on reddit <a rel="noopener noreferrer" href={this.getRedditLink()} target="_blank">u/{Constants.OPENING_TREE_REDDIT}</a></li>
            <li>Message me on lichess: <a rel="noopener noreferrer" href={`https://lichess.org/inbox/${Constants.OPENING_TREE_LICHESS}`} target="_blank">{Constants.OPENING_TREE_LICHESS}</a></li>
            <li>Message me on chess.com: <a rel="noopener noreferrer" href={`https://www.chess.com/messages/compose/${Constants.OPENING_TREE_CHESS_COM}`} target="_blank">{Constants.OPENING_TREE_CHESS_COM}</a></li>
            <li>Join my <a rel="noopener noreferrer" href={Constants.OPENING_TREE_DISCORD}target="_blank">discord server</a> to chat</li>
          </ul>
          <FormControlLabel
            control={
              <Checkbox
                checked={this.state.diagnosticsDataOpen}
                onChange={this.toggleDiagnosticsData}
                name="diagnostics"
                color="primary"
              />}
            label="Add diagnostics data to message"
          />
          <Collapse isOpen={this.state.diagnosticsDataOpen}>
            <TextField id="diagnosticsText" label="Click to copy." variant="outlined"
            className="fullWidth" value={this.getDiagnosticsValue()}
            rowsMax={4} onClick={this.copyDiagnostics} multiline />
          </Collapse>
        </ModalBody>
        <ModalFooter>
          <Button color="secondary" onClick={this.toggleFeedback(false)}>Done</Button>
        </ModalFooter>
      </Modal>
    </div>
  }

  getPlayerMoves() {
    let moves = this.state.openingGraph.movesForFen(this.state.fen)
    console.log("Moves from OpeningGraph:", JSON.parse(JSON.stringify(moves)))
    return moves
  }
}
