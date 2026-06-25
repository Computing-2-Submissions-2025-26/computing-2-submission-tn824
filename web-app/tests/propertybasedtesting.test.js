import ChainReaction from "../ChainReaction.js";
import R from "../ramda.js";

// Configuration for property-based tests.
const ENDED_GAME_ATTEMPTS = 10;
const GRID_SIZE = 5;
const MAX_MOVES = 50;
const NUM_PLAYERS = 2;
const NUM_TRIALS = 50;

/**
 * Returns a random integer in [min, max).
 * @param {number} min Lower bound, inclusive.
 * @param {number} max Upper bound, exclusive.
 * @returns {number} A random integer.
 */
const random_int = function (min, max) {
    return Math.floor(Math.random() * (max - min)) + min;
};

// All (row, col) pairs on the test grid, computed once.
const all_positions = R.xprod(
    R.range(0, GRID_SIZE),
    R.range(0, GRID_SIZE)
);

/**
 * Returns the critical mass of a cell. Corners have
 * capacity 2, edge cells 3, and interior cells 4.
 * @param {number} row Row index.
 * @param {number} col Column index.
 * @returns {number} Critical mass of the cell.
 */
const cell_capacity = function (row, col) {
    const on_top = row === 0;
    const on_bottom = row === GRID_SIZE - 1;
    const on_left = col === 0;
    const on_right = col === GRID_SIZE - 1;
    const is_corner = (
        (on_top || on_bottom) && (on_left || on_right)
    );
    if (is_corner) {
        return 2;
    }
    if (on_top || on_bottom || on_left || on_right) {
        return 3;
    }
    return 4;
};

/**
 * Counts the total atoms across all cells on the board.
 * @param {object} board The game board.
 * @returns {number} Total atom count.
 */
const count_all_atoms = function (board) {
    return R.reduce(
        function (total, pos) {
            return total + ChainReaction.get_cell(
                board,
                pos[0],
                pos[1]
            ).atoms;
        },
        0,
        all_positions
    );
};

/**
 * Returns the valid move positions for the current player.
 * During the initial phase each player claims an empty cell;
 * afterwards they place only on their own cells.
 * @param {object} state Current game state.
 * @returns {number[][]} Array of [row, col] positions.
 */
const find_valid_moves = function (state) {
    const in_initial = state.turns_played < NUM_PLAYERS;
    const current = ChainReaction.get_current_player(state);
    return R.filter(
        function (pos) {
            const cell = ChainReaction.get_cell(
                state.board,
                pos[0],
                pos[1]
            );
            if (in_initial) {
                return cell.owner === 0;
            }
            return cell.owner === current;
        },
        all_positions
    );
};

/**
 * Recursively builds a game state by making random valid
 * moves until max_moves is reached or the game ends.
 * @param {object} state Current game state.
 * @param {number} moves_made Number of moves made so far.
 * @param {number} max_moves Maximum moves to make.
 * @returns {{moves_made: number, state: object}}
 */
const make_game_step = function (state, moves_made, max_moves) {
    if (
        moves_made >= max_moves ||
        ChainReaction.is_game_ended(state)
    ) {
        return {moves_made, state};
    }
    const valid = find_valid_moves(state);
    if (valid.length === 0) {
        return {moves_made, state};
    }
    const move = valid[random_int(0, valid.length)];
    return make_game_step(
        ChainReaction.place_atom(state, move[0], move[1]),
        moves_made + 1,
        max_moves
    );
};

/**
 * Generates a random game state with up to max_moves valid
 * placements on a GRID_SIZE x GRID_SIZE board.
 * @param {number} max_moves Maximum number of moves to play.
 * @returns {{moves_made: number, state: object}}
 */
const make_random_game = function (max_moves) {
    return make_game_step(
        ChainReaction.create_game(NUM_PLAYERS, GRID_SIZE, GRID_SIZE),
        0,
        max_moves
    );
};

/**
 * Recursively retries until a game state that has actually
 * ended is produced. Throws if no ended state is found
 * within the allotted attempts, which itself indicates a
 * bug in is_game_ended.
 * @param {number} attempts_left Remaining attempts.
 * @returns {{moves_made: number, state: object}}
 */
const make_ended_game = function (attempts_left) {
    if (attempts_left <= 0) {
        throw new Error(
            "Could not generate an ended game after " +
            ENDED_GAME_ATTEMPTS + " attempts. " +
            "Is is_game_ended correctly implemented?"
        );
    }
    const result = make_random_game(
        random_int(NUM_PLAYERS + 1, MAX_MOVES + 1)
    );
    if (ChainReaction.is_game_ended(result.state)) {
        return result;
    }
    return make_ended_game(attempts_left - 1);
};

/**
 * Runs a property check over num_trials randomly generated
 * game states with 0 to MAX_MOVES placements each.
 * @param {number} num_trials Number of trials to run.
 * @param {function} property_fn The property to verify.
 */
const for_all = function (num_trials, property_fn) {
    R.forEach(
        function () {
            property_fn(
                make_random_game(random_int(0, MAX_MOVES + 1))
            );
        },
        R.range(0, num_trials)
    );
};

/**
 * Runs a property check over num_trials game states that
 * are guaranteed to have ended. Every trial is active.
 * @param {number} num_trials Number of trials to run.
 * @param {function} property_fn The property to verify.
 */
const for_all_ended = function (num_trials, property_fn) {
    R.forEach(
        function () {
            property_fn(make_ended_game(ENDED_GAME_ATTEMPTS));
        },
        R.range(0, num_trials)
    );
};

describe("Atom conservation", function () {
    it(
        `Given a game with k successful placements,
When the total atoms on the board are counted,
Then the count should equal k.`,
        function () {
            for_all(NUM_TRIALS, function (result) {
                const {moves_made, state} = result;
                const total = count_all_atoms(state.board);
                if (total !== moves_made) {
                    throw new Error(
                        "Expected " + moves_made +
                        " total atoms after " + moves_made +
                        " placements, but found " + total
                    );
                }
            });
        }
    );
});

describe("Cell capacity invariant", function () {
    it(
        `Given any settled game state,
When each cell is inspected,
Then no cell should have atoms >= its critical mass.`,
        function () {
            for_all(NUM_TRIALS, function (result) {
                R.forEach(
                    function (pos) {
                        const cell = ChainReaction.get_cell(
                            result.state.board,
                            pos[0],
                            pos[1]
                        );
                        const capacity = cell_capacity(
                            pos[0],
                            pos[1]
                        );
                        if (cell.atoms >= capacity) {
                            throw new Error(
                                "Cell (" + pos[0] + "," +
                                pos[1] + ") has " + cell.atoms +
                                " atoms, capacity is " + capacity
                            );
                        }
                    },
                    all_positions
                );
            });
        }
    );
});

describe("Cell ownership validity", function () {
    it(
        `Given any game state,
When each cell's owner is inspected,
Then the owner should be 0 or a valid player number.`,
        function () {
            for_all(NUM_TRIALS, function (result) {
                R.forEach(
                    function (pos) {
                        const cell = ChainReaction.get_cell(
                            result.state.board,
                            pos[0],
                            pos[1]
                        );
                        const valid_owner = (
                            cell.owner === 0 || (
                                cell.owner >= 1 &&
                                cell.owner <= NUM_PLAYERS
                            )
                        );
                        if (!valid_owner) {
                            throw new Error(
                                "Cell (" + pos[0] + "," +
                                pos[1] + ") has invalid owner: " +
                                cell.owner
                            );
                        }
                    },
                    all_positions
                );
            });
        }
    );


    it(
        `Given any game state,
When a cell has no owner,
Then it must have 0 atoms, and vice versa.`,
        function () {
            for_all(NUM_TRIALS, function (result) {
                R.forEach(
                    function (pos) {
                        const cell = ChainReaction.get_cell(
                            result.state.board,
                            pos[0],
                            pos[1]
                        );
                        const consistent = (
                            cell.owner === 0
                            ? cell.atoms === 0
                            : cell.atoms !== 0
                        );
                        if (!consistent) {
                            throw new Error(
                                "Cell (" + pos[0] + "," +
                                pos[1] + ") has owner=" +
                                cell.owner + " but atoms=" +
                                cell.atoms
                            );
                        }
                    },
                    all_positions
                );
            });
        }
    );
});

describe("Valid placement advances turn", function () {
    it(
        `Given a game in progress,
When the current player makes a valid placement,
Then turns_played should increase by exactly 1.`,
        function () {
            for_all(NUM_TRIALS, function (result) {
                const {state} = result;
                if (ChainReaction.is_game_ended(state)) {
                    return;
                }
                const valid = find_valid_moves(state);
                if (valid.length === 0) {
                    return;
                }
                const move = valid[random_int(0, valid.length)];
                const before = state.turns_played;
                const next = ChainReaction.place_atom(
                    state,
                    move[0],
                    move[1]
                );
                if (next.turns_played !== before + 1) {
                    throw new Error(
                        "turns_played should go from " + before +
                        " to " + (before + 1) +
                        ", got " + next.turns_played
                    );
                }
            });
        }
    );
});

describe("Ended game is absorbing", function () {
    it(
        `Given a game that has ended,
When a player attempts to place an atom anywhere,
Then turns_played should not change.`,
        function () {
            for_all_ended(NUM_TRIALS, function (result) {
                const before = result.state.turns_played;
                const r = random_int(0, GRID_SIZE);
                const c = random_int(0, GRID_SIZE);
                const new_state = ChainReaction.place_atom(
                    result.state,
                    r,
                    c
                );
                if (new_state.turns_played !== before) {
                    throw new Error(
                        "Placing on an ended game must not " +
                        "change turns_played (was " + before + ")"
                    );
                }
            });
        }
    );
});

describe("Winner validity", function () {
    it(
        `Given a game that has ended,
When the winner is retrieved,
Then it should be a valid player number.`,
        function () {
            for_all_ended(NUM_TRIALS, function (result) {
                const winner = ChainReaction.get_winner(
                    result.state
                );
                if (winner < 1 || winner > NUM_PLAYERS) {
                    throw new Error(
                        "get_winner returned " + winner +
                        " on an ended game, expected 1 to " +
                        NUM_PLAYERS
                    );
                }
            });
        }
    );
});