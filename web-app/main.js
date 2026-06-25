/*jslint browser */
import R from "./ramda.js";
import ChainReaction from "./ChainReaction.js";
window.ChainReaction = ChainReaction;

// Helper to avoid repeating getElementById everywhere.
const el = (id) => document.getElementById(id);

const player_select = el("player_select");
const grid_select = el("grid_select");
const game_area = el("game_area");
const sidebar_left = el("sidebar_left");
const sidebar_right = el("sidebar_right");
const game_board = el("game_board");
const player_list = el("player_list");
const result_dialog = el("result_dialog");

const rules_dialog = el("rules_dialog");
const rules_mini_grid_el = el("rules_mini_grid");
const rules_caption_el = el("rules_caption");

// Holds the current settled game state after each turn
let game_state = null;

// 2D array of cell div elements matching the board dimensions,
// has to be rebuilt when a new game starts
let cell_elements = [];

// Tracks players who have been eliminated so that their
// legend entry can be dimmed
let eliminated_players = [];

// True while an explosion chain is being animated,
// blocks the player from clicking during playback.
let is_animating = false;

// Setup choices held until the game is started.
let selected_num_players = null;

const PLAYER_NAMES = {
    "1": "Player 1",
    "2": "Player 2",
    "3": "Player 3",
    "4": "Player 4"
};

// Delay between each explosion wave in milliseconds.
const EXPLOSION_STEP_MS = 220;

// Emoji shown in the winner dialog.
const WIN_EMOJI = "💥";

// Screen transitions.

/**
 * Hide all sections and sidebars,
 * called before showing any particular screen.
 */
const hide_all_screens = function () {
    player_select.classList.remove("visible");
    grid_select.classList.remove("visible");
    game_area.classList.remove("visible");
    sidebar_left.classList.remove("visible");
    sidebar_right.classList.remove("visible");
};

/**
 * Show the player count selection screen.
 */
const show_player_select = function () {
    hide_all_screens();
    player_select.classList.add("visible");
};

/**
 * Show the grid size selection screen.
 */
const show_grid_select = function () {
    hide_all_screens();
    grid_select.classList.add("visible");
};

/**
 * Shows the game board and both sidebars.
 */
const show_game = function () {
    hide_all_screens();
    game_area.classList.add("visible");
    sidebar_left.classList.add("visible");
    sidebar_right.classList.add("visible");
};

//Step 1: player count selection

/**
 * Returns a click handler to set the player count
 * to the given number and moves to grid selection.
 * Using a function factory avoids three near-identical
 * functions that only differ in the number they set.
 * @param {number} num_players The player count to set
 * @returns {Function} Click handler for the button
 */
const make_player_select_handler = function (num_players) {
    return function () {
        selected_num_players = num_players;
        show_grid_select();
    };
};

el("btn_players_2").onclick = make_player_select_handler(2);
el("btn_players_3").onclick = make_player_select_handler(3);
el("btn_players_4").onclick = make_player_select_handler(4);

// Step 2: grid size selection

const select_grid_10 = function () {
    start_game(10);
};

const select_grid_15 = function () {
    start_game(15);
};

el("btn_grid_10").onclick = select_grid_10;
el("btn_grid_15").onclick = select_grid_15;

// Step 3: start game

/**
 * Creates a new game with the selected settings and
 * transitions to the game board screen.
 * @param {number} grid_size The chosen grid dimension
 */
const start_game = function (grid_size) {
    eliminated_players = [];
    is_animating = false;

    game_state = ChainReaction.create_game(
        selected_num_players,
        grid_size,
        grid_size
    );

    show_game();
    build_board();
    build_player_legend();
    update_turn_info();
    update_clickable_cells();
};

// Board construction.

/**
 * Creates one cell div with its click handler and keyboard access
 * @param {number} row The row index of the cell
 * @param {number} col The column index of the cell
 * @returns {HTMLElement} The created cell div
 */
const create_cell_div = function (row, col) {
    const cell_div = document.createElement("div");
    cell_div.className = "board_cell";
    cell_div.tabIndex = 0;
    cell_div.setAttribute("role", "gridcell");
    cell_div.setAttribute(
        "aria-label",
        "Row " + (row + 1) + " column " + (col + 1)
    );

    cell_div.onclick = function () {
        handle_cell_click(row, col);
    };

    cell_div.onkeydown = function (event) {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            handle_cell_click(row, col);
            cell_elements[row][col].focus();
        }
        if (event.key === "Tab") {
            event.preventDefault();
            cell_div.blur();
        }
        if (event.key === "ArrowUp") {
            event.preventDefault();
            if (row > 0) {
                cell_elements[row - 1][col].focus();
            }
        }
        if (event.key === "ArrowDown") {
            event.preventDefault();
            if (row < game_state.grid_height - 1) {
                cell_elements[row + 1][col].focus();
            }
        }
        if (event.key === "ArrowLeft") {
            event.preventDefault();
            if (col > 0) {
                cell_elements[row][col - 1].focus();
            }
        }
        if (event.key === "ArrowRight") {
            event.preventDefault();
            if (col < game_state.grid_width - 1) {
                cell_elements[row][col + 1].focus();
            }
        }
    };

    return cell_div;
};

/**
 * Builds the full grid of cell divs, appends them to
 * the game board element, and stores references in
 * cell_elements so redraw_board can update them.
 */
const build_board = function () {
    game_board.innerHTML = "";

    const width = game_state.grid_width;
    const height = game_state.grid_height;

    game_board.style.setProperty("--grid_cols", width);

    cell_elements = R.map(function (row) {
        return R.map(function (col) {
            const cell_div = create_cell_div(row, col);
            game_board.appendChild(cell_div);
            return cell_div;
        }, R.range(0, width));
    }, R.range(0, height));
};

/**
 * Builds the player colour legend in the right sidebar.
 * Shows a colour swatch and name for each player.
 */
const build_player_legend = function () {
    player_list.innerHTML = "";

    R.forEach(function (player_num) {
        const list_item = document.createElement("li");
        list_item.className = "player_legend_item";
        list_item.id = "legend_player_" + player_num;

        const swatch = document.createElement("div");
        swatch.className = (
            "legend_swatch player_" + player_num
        );

        const label = document.createElement("span");
        label.textContent = PLAYER_NAMES[player_num];

        list_item.appendChild(swatch);
        list_item.appendChild(label);
        player_list.appendChild(list_item);
    }, R.range(1, game_state.num_players + 1));
};

// Cell rendering

/**
 * Updates one cell div to reflect a given board cell.
 * Adds a coloured atom circle if the cell has an owner.
 * Optionally adds the exploding flash class.
 * @param {number} row The row index
 * @param {number} col The column index
 * @param {ChainReaction.Board} board The board to read
 * @param {boolean} is_exploding Flash this cell
 */
const render_cell = function (row, col, board, is_exploding) {
    const cell = ChainReaction.get_cell(board, row, col);
    const cell_div = cell_elements[row][col];

    cell_div.innerHTML = "";

    // Reset classes, keeping board_cell base class.
    cell_div.className = "board_cell";

    if (is_exploding) {
        cell_div.classList.add("exploding");
    }

    if (cell.owner !== 0) {
        const atom = document.createElement("div");
        atom.className = "atom player_" + cell.owner;
        atom.textContent = cell.atoms;
        cell_div.appendChild(atom);
    }
};

/**
 * Renders the full board from a given board state.
 * @param {ChainReaction.Board} board The board to draw
 * @param {Set<string>} exploding_keys Set of "row,col"
 *     strings for cells that should flash this frame
 */
const render_board = function (board, exploding_keys) {
    R.forEach(function (row) {
        R.forEach(function (col) {
            const key = row + "," + col;
            const is_exploding = (
                exploding_keys !== undefined &&
                exploding_keys.has(key)
            );
            render_cell(row, col, board, is_exploding);
        }, R.range(0, game_state.grid_width));
    }, R.range(0, game_state.grid_height));
};

// Clickable cell highlighting.

/**
 * Updates the clickable class on every cell.
 * Only cells the current player can legally click
 * receive the pulsing clickable class. All others
 * have no hover effect (cursor: default in CSS).
 * During initial phase any empty cell is clickable.
 * After initial phase only the current player's own
 * cells are clickable. During explosions, no cells
 * are clickable.
 */
const update_clickable_cells = function () {
    // Only fetch current player when we actually need
    // it - not during animation when nothing is clickable.
    const current_player = (
        is_animating
        ? 0
        : ChainReaction.get_current_player(game_state)
    );

    R.forEach(function (row) {
        R.forEach(function (col) {
            const cell = ChainReaction.get_cell(
                game_state.board,
                row,
                col
            );
            const cell_div = cell_elements[row][col];

            const is_clickable = (
                !is_animating &&
                !game_state.game_ended &&
                (
                    game_state.initial_phase
                    ? cell.owner === 0
                    : cell.owner === current_player
                )
            );

            cell_div.classList.toggle("clickable", is_clickable);
        }, R.range(0, game_state.grid_width));
    }, R.range(0, game_state.grid_height));
};

// Turn info sidebar.

/**
 * Updates the left sidebar to show which player's turn
 * it is and what phase the game is currently in.
 */
const update_turn_info = function () {
    const current_player = ChainReaction.get_current_player(
        game_state
    );

    el("current_player_indicator").className = (
        "player_" + current_player
    );

    el("current_player_label").textContent = (
        PLAYER_NAMES[current_player] + "'s turn"
    );

    el("phase_info").textContent = (
        game_state.initial_phase
        ? "Place your first atom anywhere"
        : "Tap one of your cells to add an atom"
    );
};

// Eliminated player detection.

/**
 * Checks which players have been newly eliminated
 * (they had atoms before but have none now after the
 * initial phase) and dims their legend entry.
 * @param {ChainReaction.Board} board Board to check
 */
const update_eliminated_players = function (board) {
    if (game_state.initial_phase) {
        return;
    }

    const active = new Set(
        ChainReaction.get_active_players(board)
    );

    R.forEach(function (player_num) {
        if (
            !active.has(player_num) &&
            !eliminated_players.includes(player_num)
        ) {
            eliminated_players.push(player_num);
            const legend_item = el(
                "legend_player_" + player_num
            );
            if (legend_item) {
                legend_item.classList.add("eliminated");
            }
        }
    }, R.range(1, game_state.num_players + 1));
};

// Explosion step-by-step animation.

/**
 * Builds a Set of "row,col" keys for cells that
 * changed between two consecutive board states.
 * Used to flash cells that received atoms in a wave.
 * @param {ChainReaction.Board} prev Previous board
 * @param {ChainReaction.Board} next Next board
 * @param {number} width Grid width
 * @param {number} height Grid height
 * @returns {Set<string>} Changed cell keys
 */
const changed_cells = function (prev, next, width, height) {
    const keys = new Set();
    R.forEach(function (row) {
        R.forEach(function (col) {
            const p = prev[row][col];
            const n = next[row][col];
            if (
                p.atoms !== n.atoms ||
                p.owner !== n.owner
            ) {
                keys.add(row + "," + col);
            }
        }, R.range(0, width));
    }, R.range(0, height));
    return keys;
};

/**
 * Plays back the explosion steps one at a time with a
 * delay between each wave so the player can see the
 * chain reaction unfold. Calls on_done when finished.
 * Each step flashes the cells that just changed.
 * @param {ChainReaction.Board[]} steps Intermediate
 *     boards from ChainReaction.place_atom
 * @param {ChainReaction.Board} board_before_steps
 *     The board state before the first step, used
 *     to compute which cells changed in step 0
 * @param {Function} on_done Called when animation ends
 */
const play_explosion_steps = function (
    steps,
    board_before_steps,
    on_done
) {
    if (steps.length === 0) {
        on_done();
        return;
    }

    let step_index = 0;
    let prev_board = board_before_steps;

    const play_next = function () {
        if (step_index >= steps.length) {
            on_done();
            return;
        }

        const current_step = steps[step_index];
        const flashing = changed_cells(
            prev_board,
            current_step,
            game_state.grid_width,
            game_state.grid_height
        );

        render_board(current_step, flashing);
        prev_board = current_step;
        step_index += 1;

        setTimeout(play_next, EXPLOSION_STEP_MS);
    };

    play_next();
};

// Move handling.

/**
 * Handles a click on a board cell.
 * Validates the click, applies the move, plays back
 * any explosion animation, then updates the UI.
 * Blocked while an animation is in progress.
 * @param {number} row The row index clicked
 * @param {number} col The column index clicked
 */
const handle_cell_click = function (row, col) {
    if (is_animating || game_state.game_ended) {
        return;
    }

    const turns_before = game_state.turns_played;
    const board_before = game_state.board;

    game_state = ChainReaction.place_atom(game_state, row, col);

    // turns_played only changes on a valid move.
    if (game_state.turns_played === turns_before) {
        return;
    }

    const steps = game_state.explosion_steps;

    if (steps.length === 0) {
        // No chain reaction - update immediately.
        render_board(game_state.board, undefined);
        update_eliminated_players(game_state.board);
        update_turn_info();
        update_clickable_cells();
        if (game_state.game_ended) {
            show_result();
        }
        return;
    }

    // Lock interaction during animation.
    is_animating = true;
    update_clickable_cells();

    play_explosion_steps(steps, board_before, function () {
        // Animation finished - settle on final state.
        is_animating = false;
        render_board(game_state.board, undefined);
        update_eliminated_players(game_state.board);
        update_turn_info();
        update_clickable_cells();

        if (game_state.game_ended) {
            show_result();
        }
    });
};

// Result dialog.

/**
 * Shows the result dialog when the game has ended.
 * Displays a burst emoji, the winning player name,
 * and colours the text in the winner's colour.
 */
const show_result = function () {
    const winner = game_state.winner;
    el("result_explosion").textContent = WIN_EMOJI;
    el("result_winner").textContent = (
        PLAYER_NAMES[winner] + " wins!"
    );
    // Use player colour class for the winner text.
    el("result_winner").className = "player_" + winner;
    result_dialog.showModal();
};

// Resets the game.

/**
 * Returns the game to the player selection screen.
 * Resets all state and clears the board.
 */
const reset_to_setup = function () {
    game_state = null;
    cell_elements = [];
    eliminated_players = [];
    is_animating = false;
    selected_num_players = null;
    game_board.innerHTML = "";
    player_list.innerHTML = "";
    show_player_select();
};

/**
 * Closes the result dialog and returns to setup.
 */
const play_again = function () {
    result_dialog.close();
    reset_to_setup();
};

el("btn_reset_game").onclick = reset_to_setup;
el("btn_play_again").onclick = play_again;

// Rules dialog animation.

const rules_frames = [
    {
        caption: "Player 1 has 1 atom in the corner" +
        " (max. 2). Player 2 has 2 atoms on the" +
        " edge next door (max. 3).",
        critical: [],
        grid: [
            [
                {a: 1, p: 1},
                {a: 2, p: 2},
                {a: 0, p: 0},
                {a: 0, p: 0}
            ],
            [
                {a: 0, p: 0},
                {a: 0, p: 0},
                {a: 0, p: 0},
                {a: 0, p: 0}
            ],
            [
                {a: 0, p: 0},
                {a: 0, p: 0},
                {a: 0, p: 0},
                {a: 0, p: 0}
            ],
            [
                {a: 0, p: 0},
                {a: 0, p: 0},
                {a: 0, p: 0},
                {a: 0, p: 0}
            ]
        ],
        ms: 3000,
        new_cell: null
    },
    {
        caption: "Player 1 places an atom in their cell" +
        " and it has reached maximum capacity",
        critical: [{c: 0, r: 0}],
        grid: [
            [
                {a: 2, p: 1},
                {a: 2, p: 2},
                {a: 0, p: 0},
                {a: 0, p: 0}
            ],
            [
                {a: 0, p: 0},
                {a: 0, p: 0},
                {a: 0, p: 0},
                {a: 0, p: 0}
            ],
            [
                {a: 0, p: 0},
                {a: 0, p: 0},
                {a: 0, p: 0},
                {a: 0, p: 0}
            ],
            [
                {a: 0, p: 0},
                {a: 0, p: 0},
                {a: 0, p: 0},
                {a: 0, p: 0}
            ]
        ],
        ms: 1800,
        new_cell: {c: 0, r: 0}
    },
    {
        caption: "BOOM! The corner cell explodes!",
        critical: [{c: 1, r: 0}],
        grid: [
            [
                {a: 0, p: 0},
                {a: 3, p: 1},
                {a: 0, p: 0},
                {a: 0, p: 0}
            ],
            [
                {a: 1, p: 1},
                {a: 0, p: 0},
                {a: 0, p: 0},
                {a: 0, p: 0}
            ],
            [
                {a: 0, p: 0},
                {a: 0, p: 0},
                {a: 0, p: 0},
                {a: 0, p: 0}
            ],
            [
                {a: 0, p: 0},
                {a: 0, p: 0},
                {a: 0, p: 0},
                {a: 0, p: 0}
            ]
        ],
        ms: 1800,
        new_cell: null
    },
    {
        caption: "CHAIN REACTION!",
        critical: [],
        grid: [
            [
                {a: 1, p: 1},
                {a: 0, p: 0},
                {a: 1, p: 1},
                {a: 0, p: 0}
            ],
            [
                {a: 1, p: 1},
                {a: 1, p: 1},
                {a: 0, p: 0},
                {a: 0, p: 0}
            ],
            [
                {a: 0, p: 0},
                {a: 0, p: 0},
                {a: 0, p: 0},
                {a: 0, p: 0}
            ],
            [
                {a: 0, p: 0},
                {a: 0, p: 0},
                {a: 0, p: 0},
                {a: 0, p: 0}
            ]
        ],
        ms: 3000,
        new_cell: null
    }
];

const rules_cell_els = R.map(function (row_index) {
    return R.map(function (col_index) {
        const cell = document.createElement("div");
        cell.className = "mini_cell";
        cell.setAttribute("data-row", row_index);
        cell.setAttribute("data-col", col_index);
        rules_mini_grid_el.appendChild(cell);
        return cell;
    }, R.range(0, 4));
}, R.range(0, 4));

const render_rules_frame = function (frame_index) {
    const frame = rules_frames[frame_index];
    R.forEach(function (row_index) {
        R.forEach(function (col_index) {
            const cell_el = (
                rules_cell_els[row_index][col_index]
            );
            const cell_data = (
                frame.grid[row_index][col_index]
            );
            cell_el.className = "mini_cell";
            cell_el.innerHTML = "";
            const is_new = (
                frame.new_cell !== null &&
                frame.new_cell.r === row_index &&
                frame.new_cell.c === col_index
            );
            if (is_new) {
                cell_el.classList.add("rules_pop");
            }
            const is_critical = R.any(
                function (k) {
                    return (
                        k.r === row_index &&
                        k.c === col_index
                    );
                },
                frame.critical
            );
            if (is_critical) {
                cell_el.classList.add("rules_critical");
            }
            if (cell_data.p > 0 && cell_data.a > 0) {
                const atom_el = document.createElement("div");
                atom_el.className = (
                    "mini_atom player_" + cell_data.p
                );
                atom_el.textContent = String(cell_data.a);
                cell_el.appendChild(atom_el);
            }
        }, R.range(0, 4));
    }, R.range(0, 4));
    rules_caption_el.textContent = frame.caption;
};

let rules_frame_index = 0;
let rules_timeout_id = null;
let rules_animating = false;

const rules_step = function () {
    if (!rules_animating) {
        return;
    }
    render_rules_frame(rules_frame_index);
    const frame_ms = rules_frames[rules_frame_index].ms;
    rules_frame_index = (
        rules_frame_index + 1
    ) % rules_frames.length;
    rules_timeout_id = setTimeout(rules_step, frame_ms);
};

el("btn_rules_close").onclick = function () {
    rules_animating = false;
    if (rules_timeout_id !== null) {
        clearTimeout(rules_timeout_id);
    }
    rules_dialog.close();
    show_player_select();
};

// Initial page state - show rules first.
rules_animating = true;
rules_dialog.showModal();
rules_step();