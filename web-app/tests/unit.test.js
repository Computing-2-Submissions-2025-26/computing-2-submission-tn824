import ChainReaction from "../ChainReaction.js";
import R from "../ramda.js";

// Helper functions

/**
 * Places atoms on a new game board, alternating between
 * players. Returns the new game state and is used
 * to set up specific board positions for testing.
 * @param {number} num_players Number of players
 * @param {number} grid_size Size of the grid
 * @param {Array<Array<number>>} moves [row, col] pairs
 * @returns {ChainReaction.GameState} Resulting state
 */
const setup_game = function (num_players, grid_size, moves) {
    return R.reduce(
        function (state, move) {
            return ChainReaction.place_atom(
                state,
                move[0],
                move[1]
            );
        },
        ChainReaction.create_game(
            num_players,
            grid_size,
            grid_size
        ),
        moves
    );
};


// Placing atoms
describe("Placing atoms", function () {
    it(
        `Given a game in the initial phase,
When a player tries to place on an opponent's cell,
Then the game state should be unchanged.`,
        function () {
            const state = setup_game(
                2,
                10,
                [[3, 3]]
            );
            const turns_before = state.turns_played;
            // Player 2 tries to place on player 1's cell
            const new_state = ChainReaction.place_atom(
                state,
                3,
                3
            );
            if (new_state.turns_played !== turns_before) {
                throw new Error(
                    "Placing on an opponent's cell " +
                    "during the initial phase should " +
                    "not advance the turn"
                );
            }
        }
    );

    it(
        `Given a game in the initial phase,
When a player places an atom on an empty cell,
Then that cell should contain 1 atom owned by
that player.`,
        function () {
            const state = setup_game(2, 10, [[3, 3]]);
            const cell = ChainReaction.get_cell(
                state.board,
                3,
                3
            );
            if (cell.owner !== 1 || cell.atoms !== 1) {
                throw new Error(
                    "Cell (3,3) should have 1 atom " +
                    "owned by player 1 after placement"
                );
            }
        }
    );

    it(
        `Given a game after the initial phase,
When a player tries to place on an opponent's cell,
Then the game state should be unchanged.`,
        function () {
            const state = setup_game(
                2,
                10,
                [[3, 3], [5, 5]]
            );
            const turns_before = state.turns_played;
            // Player 1 tries to place on player 2's cell
            const new_state = ChainReaction.place_atom(
                state,
                5,
                5
            );
            if (new_state.turns_played !== turns_before) {
                throw new Error(
                    "Placing on an opponent's cell " +
                    "should not advance the turn"
                );
            }
        }
    );

    it(
        `Given a game after the initial phase,
When a player tries to place on an empty cell,
Then the game state should be unchanged.`,
        function () {
            const state = setup_game(
                2,
                10,
                [[3, 3], [5, 5]]
            );
            const turns_before = state.turns_played;
            // Player 1 tries to place on an empty cell
            const new_state = ChainReaction.place_atom(
                state,
                0,
                0
            );
            if (new_state.turns_played !== turns_before) {
                throw new Error(
                    "Placing on an empty cell after " +
                    "the initial phase should not " +
                    "advance the turn"
                );
            }
        }
    );

    it(
        `Given any game state,
When a player tries to place outside the grid,
Then the game state should be unchanged.`,
        function () {
            const state = ChainReaction.create_game(
                2,
                10,
                10
            );
            const new_state = ChainReaction.place_atom(
                state,
                15,
                15
            );
            if (new_state.turns_played !== 0) {
                throw new Error(
                    "Placing at (15,15) on a 10x10 " +
                    "grid should not change the state"
                );
            }
        }
    );
});

// Explosions

describe("Explosions", function () {
    it(
        `Given a corner cell that reaches capacity,
When the explosion occurs,
Then the corner cell should be empty afterwards.`,
        function () {
            // Corner (0,0) has capacity 2
            // p1 places twice at corner to explode
            // Trigger the explosion with p1's 2nd corner
            const exploded = setup_game(2, 10, [
                [0, 0],
                [5, 5],
                [0, 0],
                [5, 6],
                [0, 0] // p1 places again - now explodes
            ]);
            const corner = ChainReaction.get_cell(
                exploded.board,
                0,
                0
            );
            if (corner.atoms >= 2) {
                throw new Error(
                    "Corner cell (0,0) should have " +
                    "exploded and cleared its atoms"
                );
            }
        }
    );

    it(
        `Given a cell that explodes,
When an adjacent empty cell receives the explosion,
Then that adjacent cell should gain 1 atom of the
exploding player's colour.`,
        function () {
            const state = setup_game(2, 10, [
                [0, 0],
                [5, 5],
                [0, 0],
                [5, 6],
                [0, 0] // corner (0,0) explodes
            ]);
            // (0,0) explodes into (0,1) and (1,0)
            const right = ChainReaction.get_cell(
                state.board,
                0,
                1
            );
            const below = ChainReaction.get_cell(
                state.board,
                1,
                0
            );
            const adjacent_got_atom = (
                right.atoms >= 1 || below.atoms >= 1
            );
            if (!adjacent_got_atom) {
                throw new Error(
                    "Adjacent cells to (0,0) should " +
                    "have received atoms from explosion"
                );
            }
        }
    );

    it(
        `Given a cell that explodes into an opponent cell,
When the explosion occurs,
Then the opponent cell should become the exploding
player's colour.`,
        function () {
            // p2 places at (0,1), p1 explodes from (0,0)
            const state = setup_game(2, 10, [
                [0, 0], // p1 corner
                [0, 1], // p2 next to corner
                [0, 0], // p1 corner again
                [5, 5], // p2 elsewhere
                [0, 0]  // p1 corner explodes into (0,1)
            ]);
            const converted = ChainReaction.get_cell(
                state.board,
                0,
                1
            );
            // (0,1) should now belong to player 1
            if (converted.owner === 2) {
                throw new Error(
                    "Cell (0,1) should have been " +
                    "converted to player 1's colour " +
                    "after the explosion from (0,0)"
                );
            }
        }
    );
});

// Win condition

describe("Win condition", function () {
    it(
        `Given a new game,
When no moves have been made,
Then the game should not be ended.`,
        function () {
            const state = ChainReaction.create_game(
                2,
                10,
                10
            );
            if (ChainReaction.is_game_ended(state)) {
                throw new Error(
                    "A new game should not be ended"
                );
            }
        }
    );

    it(
        `Given a game still in the initial phase,
When only one player has atoms on the board,
Then the game should not be ended.`,
        function () {
            const state = setup_game(
                2,
                10,
                [[3, 3]]
            );
            if (ChainReaction.is_game_ended(state)) {
                throw new Error(
                    "The game should not end during " +
                    "the initial placement phase even " +
                    "if only one player has atoms"
                );
            }
        }
    );

    it(
        `Given a game where one player controls all cells,
When the game state is checked,
Then the game should be ended and that player is the winner.`,
        function () {
            // P1 places at corner (0,0), P2 places adjacent at (0,1).
            // P1 adds to (0,0) reaching its capacity of 2, exploding
            // into (0,1) and converting P2's only cell. P1 wins.
            const state = setup_game(2, 10, [
                [0, 0],
                [0, 1],
                [0, 0]
            ]);
            if (!ChainReaction.is_game_ended(state)) {
                throw new Error(
                    "Game should be ended when one player " +
                    "has eliminated all opponent atoms, " +
                    "got winner: " +
                    ChainReaction.get_winner(state)
                );
            }
            if (ChainReaction.get_winner(state) !== 1) {
                throw new Error(
                    "Player 1 should be the winner after " +
                    "eliminating all of player 2's atoms, " +
                    "got: " + ChainReaction.get_winner(state)
                );
            }
        }
    );
});