import R from "./ramda.js";

/**
 * Players place atoms on a grid. When a
 * cell reaches maximum capacity it explodes onto
 * adjacent cells, potentially triggering chain
 * reactions. The last player with atoms on the board wins.
 * @namespace ChainReaction
 * @author Tara Nilforooshan
 * @version 2026
 */
const ChainReaction = Object.create(null);

/**
 * A board is a 2D grid storing the state of each cell.
 * Implemented as an array of rows, where each row is
 * an array of cell objects.
 * owner: which player owns the cell (0 = empty)
 * atoms: how many atoms are in that cell
 * @memberof ChainReaction
 * @typedef {Object[][]} Board
 */

/**
 * The complete game state at any point in the game.
 * @memberof ChainReaction
 * @typedef {Object} GameState
 * @property {ChainReaction.Board} board Current board
 * @property {number} num_players Total players (2-4)
 * @property {number} grid_width Width of the board
 * @property {number} grid_height Height of the board
 * @property {number} turns_played Total turns completed
 * @property {number[]} turn_order Remaining players in
 *     turn order. Eliminated players are removed.
 * @property {boolean} initial_phase True while each
 *     player is yet to place their first atom
 * @property {boolean} game_ended Whether game has ended
 * @property {number} winner Winning player (0 if none)
 * @property {ChainReaction.Board[]} explosion_steps
 *     Intermediate board states produced during the
 *     most recent chain reaction, in order. Empty when
 *     no chain reaction occurred this turn.
 */

/**
 * Map of player count to ordered player numbers.
 * Determines turn order for each player count.
 * @memberof ChainReaction
 * @enum {number[]}
 */
ChainReaction.player_order = Object.freeze({
    "2": [1, 2],
    "3": [1, 2, 3],
    "4": [1, 2, 3, 4]
});

/**
 * Map of cell position types to max atom capacities.
 * Atom capacities are the number of adjcent cells.
 * @memberof ChainReaction
 * @enum {number}
 */
ChainReaction.max_capacity = Object.freeze({
    "corner": 2,
    "edge": 3,
    "middle": 4
});

/**
 * Determines if a cell is at a corner of the grid.
 * @memberof ChainReaction
 * @function
 * @param {number} row The row index
 * @param {number} col The column index
 * @param {number} grid_width Width of the grid
 * @param {number} grid_height Height of the grid
 * @returns {boolean} True if the cell is a corner
 */
ChainReaction.is_corner = function (
    row,
    col,
    grid_width,
    grid_height
) {
    const max_row = grid_height - 1;
    const max_col = grid_width - 1;
    const is_top_or_bottom = (row === 0 || row === max_row);
    const is_left_or_right = (col === 0 || col === max_col);
    return is_top_or_bottom && is_left_or_right;
};

/**
 * Determines if a cell is only on the edge of the grid
 * @memberof ChainReaction
 * @function
 * @param {number} row The row index
 * @param {number} col The column index
 * @param {number} grid_width Width of the grid
 * @param {number} grid_height Height of the grid
 * @returns {boolean} True if the cell is an edge cell
 */
ChainReaction.is_edge = function (
    row,
    col,
    grid_width,
    grid_height
) {
    if (ChainReaction.is_corner(
        row,
        col,
        grid_width,
        grid_height
    )) {
        return false;
    }
    const max_row = grid_height - 1;
    const max_col = grid_width - 1;
    return (
        row === 0 || row === max_row ||
        col === 0 || col === max_col
    );
};

/**
 * Determines if a cell is in the middle of the grid
 * A middle cell isn't on the border at all
 * @memberof ChainReaction
 * @function
 * @param {number} row The row index
 * @param {number} col The column index
 * @param {number} grid_width Width of the grid
 * @param {number} grid_height Height of the grid
 * @returns {boolean} True if the cell is a middle cell
 */
ChainReaction.is_middle = function (
    row,
    col,
    grid_width,
    grid_height
) {
    return !(
        ChainReaction.is_corner(
            row,
            col,
            grid_width,
            grid_height
        ) ||
        ChainReaction.is_edge(
            row,
            col,
            grid_width,
            grid_height
        )
    );
};

/**
 * Returns the maximum atom capacity for a cell.
 * Capacity depends on position: corner=2, edge=3, middle=4.
 * @memberof ChainReaction
 * @function
 * @param {number} row The row index
 * @param {number} col The column index
 * @param {number} grid_width Width of the grid
 * @param {number} grid_height Height of the grid
 * @returns {number} Maximum atom capacity (2, 3, or 4)
 */
ChainReaction.get_max_capacity = function (
    row,
    col,
    grid_width,
    grid_height
) {
    if (ChainReaction.is_corner(
        row,
        col,
        grid_width,
        grid_height
    )) {
        return ChainReaction.max_capacity.corner;
    }
    if (ChainReaction.is_edge(
        row,
        col,
        grid_width,
        grid_height
    )) {
        return ChainReaction.max_capacity.edge;
    }
    return ChainReaction.max_capacity.middle;
};

/**
 * Returns all valid adjacent cells for a given
 * position, cells outside the grid are excluded
 * @memberof ChainReaction
 * @function
 * @param {number} row The row index of the cell
 * @param {number} col The column index of the cell
 * @param {number} grid_width Width of the grid
 * @param {number} grid_height Height of the grid
 * @returns {Array<Array<number>>} Array of [row, col]
 *     pairs within bounds
 */
ChainReaction.get_adjacent_cells = function (
    row,
    col,
    grid_width,
    grid_height
) {
    const all_directions = [
        [row - 1, col], // above
        [row + 1, col], // below
        [row, col - 1], // left
        [row, col + 1]  // right
    ];

    const within_grid = function (cell) {
        const cell_row = cell[0];
        const cell_col = cell[1];
        return (
            cell_row >= 0 && cell_row < grid_height &&
            cell_col >= 0 && cell_col < grid_width
        );
    };

    return R.filter(within_grid, all_directions);
};

/**
 * Creates a new empty cell object with no owner.
 * Each call returns a fresh independent object so
 * cells do not share references.
 * @memberof ChainReaction
 * @function
 * @returns {Object} Empty cell {owner: 0, atoms: 0}
 */
ChainReaction.empty_cell = function () {
    return {"atoms": 0, "owner": 0};
};

/**
 * Creates a new empty board of given dimensions.
 * Uses R.times so each cell is a fresh independent
 * object with no shared references.
 * @memberof ChainReaction
 * @function
 * @param {number} grid_width Width of the board
 * @param {number} grid_height Height of the board
 * @returns {ChainReaction.Board} A fresh empty board
 */
ChainReaction.create_empty_board = function (
    grid_width,
    grid_height
) {
    return R.times(function () {
        return R.times(ChainReaction.empty_cell, grid_width);
    }, grid_height);
};

/**
 * Creates a new game state ready to play.
 * @memberof ChainReaction
 * @function
 * @param {number} num_players Number of players (2-4)
 * @param {number} grid_width Width of the board
 * @param {number} grid_height Height of the board
 * @returns {ChainReaction.GameState} New game state
 * @throws If num_players not between 2 and 4, or grid
 *     size is not 10 or 15
 */
ChainReaction.create_game = function (
    num_players,
    grid_width,
    grid_height
) {
    const valid_players = (
        num_players >= 2 && num_players <= 4
    );
    if (!valid_players) {
        throw new Error(
            "num_players must be between 2 and 4"
        );
    }

    const valid_size = (
        (grid_width === 10 || grid_width === 15) &&
        (grid_height === 10 || grid_height === 15)
    );
    if (!valid_size) {
        throw new Error("Grid size must be 10 or 15");
    }

    return {
        "board": ChainReaction.create_empty_board(
            grid_width,
            grid_height
        ),
        "explosion_steps": [],
        "game_ended": false,
        "grid_height": grid_height,
        "grid_width": grid_width,
        "initial_phase": true,
        "num_players": num_players,
        "turn_order": ChainReaction.player_order[
            num_players
        ].slice(),
        "turns_played": 0,
        "winner": 0
    };
};

/**
 * Returns which player should move next
 * The current player is always turn_order[0]. After
 * each turn place_atom rotates the list so the next
 * player moves to the front, eliminated players are
 * removed from the list
 * @memberof ChainReaction
 * @function
 * @param {ChainReaction.GameState} game_state The state
 * @returns {number} The current player number (1-4)
 */
ChainReaction.get_current_player = function (game_state) {
    if (
        !game_state ||
        !Array.isArray(game_state.turn_order) ||
        game_state.turn_order.length === 0
    ) {
        throw new Error(
            "game_state must have a non-empty turn_order"
        );
    }
    return game_state.turn_order[0];
};

/**
 * Checks whether given coordinates are within the grid.
 * @memberof ChainReaction
 * @function
 * @param {number} row The row index to check
 * @param {number} col The column index to check
 * @param {number} grid_width Width of the grid
 * @param {number} grid_height Height of the grid
 * @returns {boolean} True if within bounds
 */
ChainReaction.is_within_bounds = function (
    row,
    col,
    grid_width,
    grid_height
) {
    return (
        row >= 0 && row < grid_height &&
        col >= 0 && col < grid_width
    );
};

/**
 * Returns the cell object at a given board position.
 * @memberof ChainReaction
 * @function
 * @param {ChainReaction.Board} board The board to read
 * @param {number} row The row index
 * @param {number} col The column index
 * @returns {Object} Cell object {owner, atoms}
 */
ChainReaction.get_cell = function (board, row, col) {
    if (
        !Array.isArray(board) ||
        row < 0 || row >= board.length ||
        col < 0 || col >= board[0].length
    ) {
        throw new Error(
            "Cell (" + row + ", " + col + ") is out of bounds"
        );
    }
    return board[row][col];
};

/**
 * Returns a deep copy of the board so mutations to
 * the copy do not affect the original
 * @memberof ChainReaction
 * @function
 * @param {ChainReaction.Board} board The board to copy
 * @returns {ChainReaction.Board} A new independent copy
 */
ChainReaction.copy_board = function (board) {
    return R.times(function (row) {
        return R.times(function (col) {
            return {
                "atoms": board[row][col].atoms,
                "owner": board[row][col].owner
            };
        }, board[0].length);
    }, board.length);
};

/**
 * Checks whether a cell should explode
 * A cell explodes when its atom count reaches or
 * exceeds its maximum capacity for its position.
 * @memberof ChainReaction
 * @function
 * @param {number} row The row index of the cell
 * @param {number} col The column index of the cell
 * @param {ChainReaction.Board} board The board
 * @param {number} grid_width Width of the grid
 * @param {number} grid_height Height of the grid
 * @returns {boolean} True if the cell should explode
 */
ChainReaction.should_explode = function (
    row,
    col,
    board,
    grid_width,
    grid_height
) {
    const cell = board[row][col];
    const capacity = ChainReaction.get_max_capacity(
        row,
        col,
        grid_width,
        grid_height
    );
    return cell.atoms >= capacity;
};

/**
 * Applies one explosion to a board in place and removes
 * all atoms from the exploding cell then adds one atom
 * of the exploding player's colour to the adjacent cells.
 * Does not copy the board - the caller passes a pre-copied
 * board so that all explosions in one wave share a single
 * copy rather than each making their own.
 * @memberof ChainReaction
 * @function
 * @param {number} row Row of the exploding cell
 * @param {number} col Column of the exploding cell
 * @param {ChainReaction.Board} board Pre-copied board
 * @param {number} grid_width Width of the grid
 * @param {number} grid_height Height of the grid
 * @returns {ChainReaction.Board} The same board mutated
 */
ChainReaction.apply_one_explosion = function (
    row,
    col,
    board,
    grid_width,
    grid_height
) {
    const exploding_player = board[row][col].owner;

    // Clear the exploding cell
    board[row][col].atoms = 0;
    board[row][col].owner = 0;

    const neighbours = ChainReaction.get_adjacent_cells(
        row,
        col,
        grid_width,
        grid_height
    );

    // Place one atom of exploding colour to each adjacent cell
    R.forEach(function (neighbour) {
        const n_row = neighbour[0];
        const n_col = neighbour[1];
        board[n_row][n_col].owner = exploding_player;
        board[n_row][n_col].atoms += 1;
    }, neighbours);

    return board;
};

/**
 * Finds all cells that need to explode on a board and
 * returns their [row, col] coordinates.
 * @memberof ChainReaction
 * @function
 * @param {ChainReaction.Board} board The board to scan
 * @param {number} grid_width Width of the grid
 * @param {number} grid_height Height of the grid
 * @returns {Array<Array<number>>} Cells to explode
 */
ChainReaction.find_exploding_cells = function (
    board,
    grid_width,
    grid_height
) {
    // R.reduce threads an accumulator through every
    // [row, col] pair. When a cell needs to explode
    // append its coordinates - no mutation needed.
    const all_coords = R.xprod(
        R.range(0, grid_height),
        R.range(0, grid_width)
    );
    return R.reduce(function (acc, coords) {
        const row = coords[0];
        const col = coords[1];
        if (ChainReaction.should_explode(
            row,
            col,
            board,
            grid_width,
            grid_height
        )) {
            return R.append([row, col], acc);
        }
        return acc;
    }, [], all_coords);
};

/**
 * Resolves a full chain reaction step by step,
 * collecting every intermediate board state.
 * Each step explodes all currently overloaded cells
 * simultaneously, then checks for new ones.
 * Returns the list of intermediate boards so the UI
 * can display each step with a delay.
 * @memberof ChainReaction
 * @function
 * @param {ChainReaction.Board} board Starting board
 * @param {number} grid_width Width of the grid
 * @param {number} grid_height Height of the grid
 * @returns {ChainReaction.Board[]} All intermediate
 *     boards, not including the starting board.
 *     Empty array if no explosions occurred.
 */
ChainReaction.resolve_explosions = function (
    board,
    grid_width,
    grid_height
) {
    // Inner recursive function accumulates one step
    // per wave into steps_so_far, then calls itself
    // if more cells still need to explode.
    // A safety limit stops infinite loops on boards
    // where a chain cannot settle - in normal play
    // this limit is never reached.
    const max_steps = grid_width * grid_height;

    const resolve_step = function (
        current_board,
        steps_so_far
    ) {
        if (steps_so_far.length >= max_steps) {
            return steps_so_far;
        }

        const exploding_cells = (
            ChainReaction.find_exploding_cells(
                current_board,
                grid_width,
                grid_height
            )
        );

        if (exploding_cells.length === 0) {
            return steps_so_far;
        }

        // Copy once per wave - all explosions in this
        // wave then mutate that single copy via reduce.
        // This avoids copying the full board once per
        // exploding cell, which was the main cost.
        const wave_copy = ChainReaction.copy_board(
            current_board
        );
        const to_explode = R.map(function (cell) {
            const r = cell[0];
            const c = cell[1];
            return {
                "capacity": ChainReaction.get_max_capacity(
                    r,
                    c,
                    grid_width,
                    grid_height
                ),
                "col": c,
                "owner": wave_copy[r][c].owner,
                "row": r
            };
        }, exploding_cells);
        R.forEach(function (explosion) {
            wave_copy[explosion.row][explosion.col].atoms -= (
                explosion.capacity
            );
            if (wave_copy[explosion.row][explosion.col].atoms === 0) {
                wave_copy[explosion.row][explosion.col].owner = 0;
            }
        }, to_explode);
        const board_after_wave = R.reduce(
            function (acc, explosion) {
                R.forEach(
                    function (neighbour) {
                        acc[neighbour[0]][neighbour[1]].owner = (
                            explosion.owner
                        );
                        acc[neighbour[0]][neighbour[1]].atoms += 1;
                    },
                    ChainReaction.get_adjacent_cells(
                        explosion.row,
                        explosion.col,
                        grid_width,
                        grid_height
                    )
                );
                return acc;
            },
            wave_copy,
            to_explode
        );

        // R.append returns a new array - no mutation
        return resolve_step(
            board_after_wave,
            R.append(board_after_wave, steps_so_far)
        );
    };

    return resolve_step(board, []);
};

/**
 * Returns a list of all players currently on the board.
 * Used to determine if the game has ended.
 * @memberof ChainReaction
 * @function
 * @param {ChainReaction.Board} board The board to check
 * @returns {number[]} Unique player numbers with atoms
 */
ChainReaction.get_active_players = function (board) {
    if (!Array.isArray(board)) {
        throw new Error(
            "board must be a 2D array"
        );
    }
    return R.pipe(
        R.flatten,
        R.map(R.prop("owner")),
        R.filter(R.complement(R.equals(0))),
        R.uniq
    )(board);
};

/**
 * Checks whether the game has ended.
 * The game ends when only one player has atoms on the
 * board, but only after the initial phase where every
 * player has placed their first atom.
 * @memberof ChainReaction
 * @function
 * @param {ChainReaction.GameState} game_state The state
 * @returns {boolean} True if the game has ended
 */
ChainReaction.is_game_ended = function (game_state) {
    if (!game_state || typeof game_state !== "object") {
        throw new Error(
            "game_state must be a valid game state object"
        );
    }
    if (game_state.initial_phase) {
        return false;
    }
    const active_players = ChainReaction.get_active_players(
        game_state.board
    );
    return active_players.length === 1;
};

/**
 * Returns the winner of the game if there is one.
 * Returns 0 if the game is still ongoing.
 * It is possible for the game to keep going and not be won
 * @memberof ChainReaction
 * @function
 * @param {ChainReaction.GameState} game_state The state
 * @returns {number} Winning player number or 0 if none
 */
ChainReaction.get_winner = function (game_state) {
    if (!game_state || typeof game_state !== "object") {
        throw new Error(
            "game_state must be a valid game state object"
        );
    }
    if (!ChainReaction.is_game_ended(game_state)) {
        return 0;
    }
    return ChainReaction.get_active_players(
        game_state.board
    )[0];
};

/**
 * Places an atom for the current player at a position,
 * then collects every intermediate board state from
 * the resulting chain reaction into explosion_steps.
 * The final board in explosion_steps is the settled
 * board used for the next turn.
 * Returns an unchanged state if the move is invalid.
 * Invalid: out of bounds, placing on an opponent cell,
 * or game already ended.
 * @memberof ChainReaction
 * @function
 * @param {ChainReaction.GameState} game_state The state
 * @param {number} row The row to place the atom in
 * @param {number} col The column to place atom in
 * @returns {ChainReaction.GameState} Updated game state
 *     with explosion_steps populated, or unchanged
 *     state if the move was invalid
 */
ChainReaction.place_atom = function (game_state, row, col) {
    if (!game_state || typeof game_state !== "object") {
        throw new Error(
            "game_state must be a valid game state object"
        );
    }
    if (!ChainReaction.is_within_bounds(
        row,
        col,
        game_state.grid_width,
        game_state.grid_height
    )) {
        return game_state;
    }

    if (game_state.game_ended) {
        return game_state;
    }

    const current_player = ChainReaction.get_current_player(game_state);
    const target_cell = game_state.board[row][col];

    // During initial phase only empty cells are valid
    if (game_state.initial_phase) {
        if (target_cell.owner !== 0) {
            return game_state;
        }
    } else {
        // After initial phase only own cells are valid
        if (target_cell.owner !== current_player) {
            return game_state;
        }
    }

    // Place atom on a fresh copy of the board
    const board_with_atom = ChainReaction.copy_board(game_state.board);
    board_with_atom[row][col].owner = current_player;
    board_with_atom[row][col].atoms += 1;

    // Collect all intermediate explosion boards so the
    // UI can step through them one at a time
    const explosion_steps = ChainReaction.resolve_explosions(
        board_with_atom,
        game_state.grid_width,
        game_state.grid_height
    );

    // The settled board is the last step, or the board
    // with the atom added if no explosions occurred
    const settled_board = (
        explosion_steps.length > 0
        ? explosion_steps[explosion_steps.length - 1]
        : board_with_atom
    );

    const new_turns_played = game_state.turns_played + 1;

    // Initial phase ends once every player has placed
    const new_initial_phase = (
        new_turns_played < game_state.num_players
    );

    // Remove eliminated players from the turn order,
    // then rotate so the next player is at the front.
    // During initial phase keep the full list - no one
    // can be eliminated yet and the board only shows
    // the players who have placed so far.
    // R.tail moves past the current player;
    // R.append puts them at the back for next cycle.
    const active_players = ChainReaction.get_active_players(settled_board);
    const after_elimination = (
        new_initial_phase
        ? game_state.turn_order
        : R.filter(
            function (p) {
                return R.includes(p, active_players);
            },
            game_state.turn_order
        )
    );
    const new_turn_order = R.append(
        after_elimination[0],
        R.tail(after_elimination)
    );

    // Build a provisional state to pass to is_game_ended,
    // which needs initial_phase and board to be final.
    // We compute game_ended and winner up front so the
    // returned object can be built once cleanly rather
    // than patching a partial object with Object.assign.
    const provisional_state = {
        "board": settled_board,
        "initial_phase": new_initial_phase,
        "num_players": game_state.num_players
    };

    const game_now_ended = ChainReaction.is_game_ended(
        provisional_state
    );

    const winner = (
        game_now_ended
        ? ChainReaction.get_active_players(settled_board)[0]
        : 0
    );

    return {
        "board": settled_board,
        "explosion_steps": explosion_steps,
        "game_ended": game_now_ended,
        "grid_height": game_state.grid_height,
        "grid_width": game_state.grid_width,
        "initial_phase": new_initial_phase,
        "num_players": game_state.num_players,
        "turn_order": new_turn_order,
        "turns_played": new_turns_played,
        "winner": winner
    };
};

export default Object.freeze(ChainReaction);