import React from 'react'
import PGNLoader from './loader/PGNLoader'
import SettingsView from './Settings'
import {
  Button,
  Col,
  Modal,
  ModalFooter,
  ModalHeader,
  ModalBody,
  FormGroup,
  Label,
  ButtonGroup,
  Button as RButton,
  Nav,
  NavItem,
  NavLink,
  Row,
  TabContent,
  TabPane
} from 'reactstrap';
import classnames from 'classnames';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faUser, faList, faCog, faChartBar, faBook, faUpload } from '@fortawesome/free-solid-svg-icons'
import MovesList from './moves/MovesList'
import BookMoves from './moves/BookMoves'
import {trackEvent} from '../app/Analytics'
import * as Constants from '../app/Constants'
import ReportControls from './ReportControls'
import { Table, TableRow, TableBody, TableCell } from '@material-ui/core'
import { addStateManagement } from './StateManagement'

export default class ControlsContainer extends React.Component {
    constructor(props){
      super(props)
      addStateManagement(this)
      this.state = {
          activeTab:'user',
          activeGame:null,
          repertoireInput: React.createRef(),
          showRepertoireModal: false,
          repertoireColor: Constants.PLAYER_COLOR_WHITE
      }
      this.toggleModal = ()=>{
        this.setState({activeGame:null})
      }
    }

    handleRepertoireUpload = (event) => {
        const file = event.target.files[0]
        if (file) {
            const reader = new FileReader()
            reader.onload = (e) => {
                this.props.openingGraph.loadRepertoire(e.target.result, this.state.repertoireColor)
                trackEvent(Constants.EVENT_CATEGORY_CONTROLS, "RepertoireUploaded")
                this.props.showInfo(`${this.state.repertoireColor === Constants.PLAYER_COLOR_WHITE ? "White" : "Black"} repertoire loaded successfully`)
                this.setState({ showRepertoireModal: false })
            }
            reader.readAsText(file)
        }
        event.target.value = ''
    }

    toggleRepertoireModal = () => {
        this.setState(prevState => ({
            showRepertoireModal: !prevState.showRepertoireModal
        }))
    }

    handleColorSelect = (color) => {
        this.setState({ repertoireColor: color })
    }

    triggerRepertoireUpload = (e) => {
        e.stopPropagation()
        this.state.repertoireInput.current.click()
    }

    launchGame(game) {
      if(game.url) {
          return (e) => {
              e.stopPropagation()
              window.open(game.url, '_blank');
              trackEvent(Constants.EVENT_CATEGORY_MOVES_LIST, "ViewGameExternal")
          }
      }
      return ((e) => {
        e.stopPropagation()
        this.setState({activeGame:game})
      })
    }
    shouldComponentUpdate(newProps){
      if(this.props.resize !== newProps.resize) {
        // dont update component on resize
        return false
      }
      return true
    }
    toggle(tab) {
        if(this.state.activeTab !== tab) {
            this.setState({activeTab:tab})
            trackEvent(Constants.EVENT_CATEGORY_CONTROLS,`activeTab:${tab}`)
        }
    }
    switchToUserTab() {
      this.toggle('user')
    }
    switchToMovesTab(highlightMove) {
      this.toggle('moves')
      if(highlightMove) {
        this.setState({highlightPlayerMove:highlightMove})
        setTimeout(() => {
          this.setState({
            highlightPlayerMove:null
          })
        }, 1000);
      }
    }
    switchToBookTab(highlightMove) {
      this.toggle('book')
      if(highlightMove) {
        this.setState({highlightBookMove:highlightMove})
        setTimeout(() => {
          this.setState({
            highlightBookMove:null
          })
        }, 1000);
      }
    }

    render(){
        return <div>
              <input
                  type="file"
                  ref={this.state.repertoireInput}
                  style={{ display: 'none' }}
                  onChange={this.handleRepertoireUpload}
                  accept=".txt,.pgn"
              />
              <Modal isOpen={this.state.activeGame} toggle={this.toggleModal}>
              <ModalHeader toggle={this.toggleModal}>Game details</ModalHeader>
              {!this.state.activeGame?null:
              <Table>
                <TableBody>
                  {
                    Object.entries(this.state.activeGame.headers).map((entry)=>!entry[1]?null:<TableRow className="performanceRatingRow">
                        <TableCell className="performanceRatingRow">{entry[0]}</TableCell>
                        <TableCell className="performanceRatingRow">{entry[1]}</TableCell>
                    </TableRow>
                    )}
                </TableBody>
              </Table>
              }
              <ModalFooter>
          <Button color="secondary" onClick={this.toggleModal}>Done</Button>
        </ModalFooter>
              </Modal>
              <Modal isOpen={this.state.showRepertoireModal} toggle={this.toggleRepertoireModal}>
                <ModalHeader toggle={this.toggleRepertoireModal}>Upload Opening Repertoire</ModalHeader>
                <ModalBody>
                    <FormGroup>
                        <Label>Select Repertoire Color</Label>
                        <div>
                            <ButtonGroup>
                                <RButton 
                                    color={this.state.repertoireColor === Constants.PLAYER_COLOR_WHITE ? "primary" : "secondary"}
                                    onClick={() => this.handleColorSelect(Constants.PLAYER_COLOR_WHITE)}
                                >
                                    White
                                </RButton>
                                <RButton 
                                    color={this.state.repertoireColor === Constants.PLAYER_COLOR_BLACK ? "primary" : "secondary"}
                                    onClick={() => this.handleColorSelect(Constants.PLAYER_COLOR_BLACK)}
                                >
                                    Black
                                </RButton>
                            </ButtonGroup>
                        </div>
                    </FormGroup>
                    <FormGroup>
                        <Label>Select Repertoire File</Label>
                        <div>
                            <RButton color="primary" onClick={this.triggerRepertoireUpload}>
                                Choose File
                            </RButton>
                        </div>
                    </FormGroup>
                </ModalBody>
            </Modal>
            <Nav tabs>
        <NavItem>
          <NavLink
            className={classnames({ active: this.state.activeTab === 'user' })}
            onClick={() => { this.toggle('user'); }}
          >
            <FontAwesomeIcon icon={faUser} /> {this.state.activeTab === 'user'?"User":""}
          </NavLink>
        </NavItem>
        <NavItem>
          <NavLink
            className={classnames({ active: this.state.activeTab === 'moves' })}
            onClick={() => { this.toggle('moves'); }}
          >
            <FontAwesomeIcon icon={faList} /> {this.state.activeTab === 'moves'?"Moves":""}
          </NavLink>
        </NavItem>
        <NavItem>
          <NavLink
            className={classnames({ active: this.state.activeTab === 'book' })}
            onClick={() => { this.toggle('book'); }}
          >
            <FontAwesomeIcon icon={faBook} /> {this.state.activeTab === 'book'?"Opening book":""}
          </NavLink>
        </NavItem>
        <NavItem>
          <NavLink
            className={classnames({ active: this.state.activeTab === 'report' })}
            onClick={() => { this.toggle('report'); }}
          >
            <FontAwesomeIcon icon={faChartBar} /> {this.state.activeTab === 'report'?"Report":""}
          </NavLink>
        </NavItem>
        <NavItem>
          <NavLink>
            <FontAwesomeIcon
                icon={faUpload}
                className="pointer"
                onClick={this.toggleRepertoireModal}
                title="Upload opening repertoire"
            />
          </NavLink>
        </NavItem>
        <NavItem>
          <NavLink
            className={classnames({ active: this.state.activeTab === 'settings' })}
            onClick={() => { this.toggle('settings'); }}
          >
            <FontAwesomeIcon icon={faCog} /> {this.state.activeTab === 'settings'?"Controls":""}
          </NavLink>
        </NavItem>
      </Nav>
      <TabContent activeTab={this.state.activeTab}>
        <TabPane tabId="user">
            <PGNLoader
              switchToMovesTab={this.switchToMovesTab.bind(this)}
              clear = {this.props.clear}
              gamesProcessed = {this.props.gamesProcessed}
              settings = {this.props.settings}
              onChange = {this.props.settingsChange}
              notify = {this.props.updateProcessedGames}
              showError = {this.props.showError}
              showInfo = {this.props.showInfo}
              setDownloading = {this.props.setDownloading}
              isDownloading = {this.props.isDownloading}
              openingGraph={this.props.openingGraph}
              importCallback={this.props.importCallback}
              variant={this.props.variant}
              variantChange={this.props.variantChange}
              oauthManager={this.props.oauthManager}
              />
            </TabPane>
        <TabPane tabId="moves">
            <MovesList
              switchToUserTab={this.switchToUserTab.bind(this)}
              playerMoves={this.props.playerMoves}
              gameResults={this.props.gameResults}
              onMove={this.props.onMove}
              settings={this.props.settings}
              turnColor={this.props.turnColor}
              settingsChange={this.props.settingsChange}
              launchGame = {this.launchGame.bind(this)}
              switchToBookTab={this.switchToBookTab.bind(this)}
              highlightMove={this.state.highlightPlayerMove}
              variant={this.props.variant}
              highlightArrow={this.props.highlightArrow}
            />
        </TabPane>
        <TabPane tabId="book">
            <BookMoves
              bookMoves={this.props.bookMoves}
              getPlayerMoves={this.props.getPlayerMoves}
              gameResults={this.props.bookResults}
              onMove={this.props.onMove}
              settings={this.props.settings}
              turnColor={this.props.turnColor}
              settingsChange={this.props.settingsChange}
              launchGame={this.props.launchGame} //TODO: Check this later
              switchToMovesTab = {this.switchToMovesTab.bind(this)}
              highlightMove = {this.state.highlightBookMove}
              forceFetchBookMoves = {this.props.forceFetchBookMoves}
              variant={this.props.variant}
              highlightArrow={this.props.highlightArrow}
            />
        </TabPane>
        <TabPane tabId="report">
          <ReportControls fen={this.props.fen} simplifiedView = {false}
            moveDetails = {this.props.openingGraph.getDetailsForFen(this.props.fen)}
            launchGame={this.launchGame.bind(this)} settings={this.props.settings}
            switchToUserTab={this.switchToUserTab.bind(this)}
            isOpen = {this.state.activeTab === "report"}
            showInfo = {this.props.showInfo} reportFooter={this.reportFooter()}/>
        </TabPane>
        <TabPane tabId="settings">
          <Row>
            <Col md="9" xs="12">
            <SettingsView
              fen={this.props.fen}
              settings={this.props.settings}
              isOpen = {true}
              clear = {this.props.clear}
              reset = {this.props.reset}
              onChange = {this.props.settingsChange} />
            </Col>
          </Row>
        </TabPane>
      </TabContent>
        </div>
    }

    reportFooter(){
      return <span>Performance rating calculated based on <a href="https://handbook.fide.com/chapter/B022017" target="_blank" rel="noopener noreferrer">FIDE regulations</a></span>
    }
}