import R from "./ramda.js";

/**
 * ChainReaction.js is a module to model and play Chain Reaction.
 * Players take turns placing atoms on a grid. When a cell
 * reaches its critical mass it explodes, sending atoms to
 * neighbouring cells. The last player with atoms remaining wins.
 * @namespace ChainReaction
 * @author Student
 * @version 2024/25
 */
const ChainReaction = Object.create(null);

/**
 * A Cell holds the state of one grid position.
 * @memberof ChainReaction
 * @typedef {Object} Cell
 * @property {number} owner The player who owns this cell (0 if empty).
 * @property {number} atoms The number of atoms in this cell.
 */

/**
 * A Board is a 2D array of cells, implemented as
 * an array of rows, each row being an array of cells.
 * @memberof ChainReaction
 * @typedef {ChainReaction.Cell[][]} Board
 */

/**
 * A GameState holds all the information about the current game.
 * @memberof ChainReaction
 * @typedef {Object} GameState
 * @property {ChainReaction.Board} board The current board.
 * @property {number} current_player The player whose turn it is.
 * @property {number} num_players The total number of players.
 */

/**
 * Returns the number of neighbouring cells for a given position.
 * Corner cells have 2 neighbours, edge cells have 3,
 * and all other cells have 4.
 * @memberof ChainReaction
 * @function
 * @param {number} row The row index.
 * @param {number} col The column index.
 * @param {number} gridWidth The width of the board.
 * @param {number} gridHeight The height of the board.
 * @returns {number} The critical mass for this cell.
 */
ChainReaction.critical_mass = function (row, col, gridWidth, gridHeight) {
    const isCorner = (
        (row === 0 || row === gridHeight - 1) &&
        (col === 0 || col === gridWidth - 1)
    );
    const isEdge = (
        row === 0 ||
        row === gridHeight - 1 ||
        col === 0 ||
        col === gridWidth - 1
    );
    if (isCorner) {
        return 2;
    }
    if (isEdge) {
        return 3;
    }
    return 4;
};

/**
 * Creates and returns a new empty board.
 * @memberof ChainReaction
 * @function
 * @param {number} [width = 10] The width of the board.
 * @param {number} [height = 10] The height of the board.
 * @returns {ChainReaction.Board} An empty board.
 */
ChainReaction.empty_board = function (width = 10, height = 10) {
    return R.map(
        () => R.map(() => ({"atoms": 0, "owner": 0}), R.range(0, width)),
        R.range(0, height)
    );
};

/**
 * Creates a new game state with an empty board.
 * @memberof ChainReaction
 * @function
 * @param {number} [num_players = 2] How many players in the game.
 * @returns {ChainReaction.GameState} The initial game state.
 */
ChainReaction.new_game = function (num_players = 2) {
    return {
        "board": ChainReaction.empty_board(),
        "current_player": 1,
        "num_players": num_players
    };
};

/**
 * Returns the player whose turn it is next.
 * @memberof ChainReaction
 * @function
 * @param {ChainReaction.GameState} state The current game state.
 * @returns {number} The next player number.
 */
ChainReaction.next_player = function (state) {
    return (state.current_player % state.num_players) + 1;
};

/**
 * Returns whether a move is valid for a given player.
 * A move is invalid if the cell is owned by another player.
 * @memberof ChainReaction
 * @function
 * @param {number} player The player attempting the move.
 * @param {number} row The row of the target cell.
 * @param {number} col The column of the target cell.
 * @param {ChainReaction.GameState} state The current game state.
 * @returns {boolean} Whether the move is valid.
 */
ChainReaction.is_valid_move = function (player, row, col, state) {
    const cell = state.board[row][col];
    return cell.owner === 0 || cell.owner === player;
};

/**
 * Places an atom for the current player at the given cell,
 * and advances the turn. Does not yet handle explosions.
 * Returns undefined if the move is invalid.
 * @memberof ChainReaction
 * @function
 * @param {number} row The row of the target cell.
 * @param {number} col The column of the target cell.
 * @param {ChainReaction.GameState} state The current game state.
 * @returns {ChainReaction.GameState | undefined} The updated game state.
 */
ChainReaction.ply = function (row, col, state) {
    const player = state.current_player;
    if (!ChainReaction.is_valid_move(player, row, col, state)) {
        return undefined;
    }
    const cell = state.board[row][col];
    const new_cell = {"atoms": cell.atoms + 1, "owner": player};
    const new_board = R.update(
        row,
        R.update(col, new_cell, state.board[row]),
        state.board
    );
    return {
        "board": new_board,
        "current_player": ChainReaction.next_player(state),
        "num_players": state.num_players
    };
};

/**
 * Returns whether the game has ended.
 * Currently just a stub – will be implemented once
 * explosion logic is complete.
 * @memberof ChainReaction
 * @function
 * @param {ChainReaction.GameState} state The current game state.
 * @returns {boolean} Whether the game has ended.
 */
ChainReaction.is_ended = function (state) {
    // TODO: implement once explosions are working
    return false;
};

export default Object.freeze(ChainReaction);