import R from "./ramda.js";

/*jslint browser */
import ChainReaction from "./ChainReaction.js";

let state = ChainReaction.new_game();

const render = function () {
    const board_el = document.getElementById("game_board");
    board_el.innerHTML = "";
    state.board.forEach(function (row, row_index) {
        const row_el = document.createElement("div");
        row.forEach(function (cell, col_index) {
            const cell_el = document.createElement("button");
            cell_el.textContent = (
                cell.atoms > 0
                ? String(cell.atoms)
                : "."
            );
            cell_el.onclick = function () {
                const next = ChainReaction.ply(row_index, col_index, state);
                if (next !== undefined) {
                    state = next;
                    document.getElementById(
                        "current_player"
                    ).textContent = String(state.current_player);
                    render();
                }
            };
            row_el.append(cell_el);
        });
        board_el.append(row_el);
    });
};

render();