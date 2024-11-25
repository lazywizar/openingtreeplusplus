export default class RepertoireTree {
    constructor() {
        this.children = new Map();
        this.mainLine = [];
    }

    addMove(move, remainingMoves) {
        if (!move) return;
        const moveStr = move.san || move;

        if (!this.children.has(moveStr)) {
            this.children.set(moveStr, new RepertoireTree());
        }

        const child = this.children.get(moveStr);
        if (remainingMoves.length > 0) {
            child.addMove(remainingMoves[0], remainingMoves.slice(1));
        }
    }

    hasMove(move) {
        const moveStr = move.san || move;
        return this.children.has(moveStr);
    }

    getNextPosition(move) {
        const moveStr = move.san || move;
        return this.children.get(moveStr);
    }
}