# Openingtree
Code for [openingtree.com](https://www.openingtree.com). It downloads chess games in form of a pgn from any source, applies specified filters and constructs an openingtree.
The tree is visualized on a chessboard. It also shows win percentages and other statistics with different moves.

## Features
* Download and analyze games from chess.com and lichess.com
* Visualize opening trees with statistics
* Upload personal opening repertoire (PGN format)
* Compare played games against repertoire
  * Green tick for moves matching repertoire
  * Shows alternative lines from repertoire when deviating
  * Configurable depth for repertoire comparison (default: 10 moves)

## Architecture diagram
This does not correlate one to one with the code modules but the interactions at a high level are depicted accurately.

![GitHub Logo](/docs/images/architecture.png)

## Install dependencies and build
```
yarn install && yarn build
```

## Run locally
```
yarn start
```
starts a server on port `3000`

## Build for production
```
yarn build
```

## Environment Variables:
```
NODE_OPTIONS=--openssl-legacy-provider --no-experimental-fetch
PORT=3000
```