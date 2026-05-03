import { useEffect, useState } from "react";
import { trackGameLifecycle } from "../lib/analytics";

type SudokuValue = number | null;
type SudokuBoard = SudokuValue[][];
type Difficulty = "easy" | "medium" | "hard";
type GameMode = "sudoku" | "memory";

interface SudokuConfig {
  label: string;
  puzzle: SudokuBoard;
  solution: number[][];
}

const SUDOKU_CONFIGS: Record<Difficulty, SudokuConfig> = {
  easy: {
    label: "Easy",
    puzzle: [
      [5, 3, null, null, 7, null, null, null, null],
      [6, null, null, 1, 9, 5, null, null, null],
      [null, 9, 8, null, null, null, null, 6, null],
      [8, null, null, null, 6, null, null, null, 3],
      [4, null, null, 8, null, 3, null, null, 1],
      [7, null, null, null, 2, null, null, null, 6],
      [null, 6, null, null, null, null, 2, 8, null],
      [null, null, null, 4, 1, 9, null, null, 5],
      [null, null, null, null, 8, null, null, 7, 9],
    ],
    solution: [
      [5, 3, 4, 6, 7, 8, 9, 1, 2],
      [6, 7, 2, 1, 9, 5, 3, 4, 8],
      [1, 9, 8, 3, 4, 2, 5, 6, 7],
      [8, 5, 9, 7, 6, 1, 4, 2, 3],
      [4, 2, 6, 8, 5, 3, 7, 9, 1],
      [7, 1, 3, 9, 2, 4, 8, 5, 6],
      [9, 6, 1, 5, 3, 7, 2, 8, 4],
      [2, 8, 7, 4, 1, 9, 6, 3, 5],
      [3, 4, 5, 2, 8, 6, 1, 7, 9],
    ],
  },
  medium: {
    label: "Medium",
    puzzle: [
      [null, 2, null, 6, null, 8, null, null, null],
      [5, 8, null, null, null, 9, 7, null, null],
      [null, null, null, null, 4, null, null, null, null],
      [3, 7, null, null, null, null, 5, null, null],
      [6, null, null, null, null, null, null, null, 4],
      [null, null, 8, null, null, null, null, 1, 3],
      [null, null, null, null, 2, null, null, null, null],
      [null, null, 9, 8, null, null, null, 3, 6],
      [null, null, null, 3, null, 6, null, 9, null],
    ],
    solution: [
      [1, 2, 3, 6, 7, 8, 9, 4, 5],
      [5, 8, 4, 2, 3, 9, 7, 6, 1],
      [9, 6, 7, 1, 4, 5, 3, 2, 8],
      [3, 7, 2, 4, 6, 1, 5, 8, 9],
      [6, 9, 1, 5, 8, 3, 2, 7, 4],
      [4, 5, 8, 7, 9, 2, 6, 1, 3],
      [8, 3, 6, 9, 2, 4, 1, 5, 7],
      [2, 1, 9, 8, 5, 7, 4, 3, 6],
      [7, 4, 5, 3, 1, 6, 8, 9, 2],
    ],
  },
  hard: {
    label: "Hard",
    puzzle: [
      [null, null, null, null, null, null, 2, null, null],
      [null, 8, null, null, null, 7, null, 9, null],
      [6, null, 2, null, null, null, 5, null, null],
      [null, 7, null, null, 6, null, null, null, null],
      [null, null, null, 9, null, 1, null, null, null],
      [null, null, null, null, 2, null, null, 4, null],
      [null, null, 5, null, null, null, 6, null, 3],
      [null, 9, null, 4, null, null, null, 7, null],
      [null, null, 6, null, null, null, null, null, null],
    ],
    solution: [
      [9, 5, 7, 6, 1, 3, 2, 8, 4],
      [4, 8, 3, 2, 5, 7, 1, 9, 6],
      [6, 1, 2, 8, 4, 9, 5, 3, 7],
      [1, 7, 8, 3, 6, 4, 9, 5, 2],
      [5, 2, 4, 9, 7, 1, 3, 6, 8],
      [3, 6, 9, 5, 2, 8, 7, 4, 1],
      [8, 4, 5, 7, 9, 2, 6, 1, 3],
      [2, 9, 1, 4, 3, 6, 8, 7, 5],
      [7, 3, 6, 1, 8, 5, 4, 2, 9],
    ],
  },
};
const MEMORY_SYMBOLS = ["X", "L", "B", "SUN", "ORB", "TIDE"];

function buildMemoryDeck() {
  return [...MEMORY_SYMBOLS, ...MEMORY_SYMBOLS]
    .map((label, index) => ({ id: `${label}-${index}`, label }))
    .sort(() => Math.random() - 0.5);
}

function cloneBoard(board: SudokuBoard) {
  return board.map((row) => [...row]);
}

function getConflictKeys(board: SudokuBoard) {
  const conflicts = new Set<string>();

  for (let rowIndex = 0; rowIndex < 9; rowIndex += 1) {
    collectGroupConflicts(
      board[rowIndex].map((value, columnIndex) => ({ rowIndex, columnIndex, value })),
      conflicts,
    );
  }

  for (let columnIndex = 0; columnIndex < 9; columnIndex += 1) {
    collectGroupConflicts(
      board.map((row, rowIndex) => ({ rowIndex, columnIndex, value: row[columnIndex] })),
      conflicts,
    );
  }

  for (let boxRow = 0; boxRow < 3; boxRow += 1) {
    for (let boxColumn = 0; boxColumn < 3; boxColumn += 1) {
      const cells = [];

      for (let rowOffset = 0; rowOffset < 3; rowOffset += 1) {
        for (let columnOffset = 0; columnOffset < 3; columnOffset += 1) {
          const rowIndex = boxRow * 3 + rowOffset;
          const columnIndex = boxColumn * 3 + columnOffset;
          cells.push({ rowIndex, columnIndex, value: board[rowIndex][columnIndex] });
        }
      }

      collectGroupConflicts(cells, conflicts);
    }
  }

  return conflicts;
}

function collectGroupConflicts(
  cells: Array<{ rowIndex: number; columnIndex: number; value: SudokuValue }>,
  conflicts: Set<string>,
) {
  const positions = new Map<number, string[]>();

  cells.forEach(({ rowIndex, columnIndex, value }) => {
    if (!value) {
      return;
    }

    const key = `${rowIndex}-${columnIndex}`;
    const bucket = positions.get(value) ?? [];
    bucket.push(key);
    positions.set(value, bucket);
  });

  positions.forEach((keys) => {
    if (keys.length > 1) {
      keys.forEach((key) => conflicts.add(key));
    }
  });
}

function getProgress(board: SudokuBoard, difficulty: Difficulty, conflicts: Set<string>) {
  const config = SUDOKU_CONFIGS[difficulty];
  const totalEmptyCells = config.puzzle.flat().filter((value) => value === null).length;
  let correctEntries = 0;

  board.forEach((row, rowIndex) => {
    row.forEach((value, columnIndex) => {
      if (config.puzzle[rowIndex][columnIndex] !== null) {
        return;
      }

      if (
        value !== null &&
        !conflicts.has(`${rowIndex}-${columnIndex}`) &&
        value === config.solution[rowIndex][columnIndex]
      ) {
        correctEntries += 1;
      }
    });
  });

  return { correctEntries, totalEmptyCells };
}

function formatElapsed(seconds: number) {
  const minutes = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const remainingSeconds = (seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remainingSeconds}`;
}

export default function GamesSection() {
  const [activeGame, setActiveGame] = useState<GameMode>("sudoku");
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const [board, setBoard] = useState<SudokuBoard>(() => cloneBoard(SUDOKU_CONFIGS.easy.puzzle));
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [memoryDeck, setMemoryDeck] = useState(() => buildMemoryDeck());
  const [flippedCards, setFlippedCards] = useState<number[]>([]);
  const [matchedLabels, setMatchedLabels] = useState<string[]>([]);

  const conflicts = getConflictKeys(board);
  const { correctEntries, totalEmptyCells } = getProgress(board, difficulty, conflicts);
  const isSolved = correctEntries === totalEmptyCells && conflicts.size === 0;
  const memorySolved = matchedLabels.length === MEMORY_SYMBOLS.length;

  useEffect(() => {
    trackGameLifecycle("game_start", activeGame);
  }, [activeGame]);

  useEffect(() => {
    if (activeGame !== "sudoku") {
      return;
    }

    if (isSolved) {
      return;
    }

    const interval = window.setInterval(() => {
      setElapsedSeconds((current) => current + 1);
    }, 1000);

    return () => window.clearInterval(interval);
  }, [activeGame, difficulty, isSolved]);

  useEffect(() => {
    if (flippedCards.length !== 2) {
      return;
    }

    const [firstIndex, secondIndex] = flippedCards;
    const firstCard = memoryDeck[firstIndex];
    const secondCard = memoryDeck[secondIndex];

    if (firstCard.label === secondCard.label) {
      setMatchedLabels((current) =>
        current.includes(firstCard.label) ? current : [...current, firstCard.label],
      );
      const timeout = window.setTimeout(() => setFlippedCards([]), 420);
      return () => window.clearTimeout(timeout);
    }

    const timeout = window.setTimeout(() => setFlippedCards([]), 820);
    return () => window.clearTimeout(timeout);
  }, [flippedCards, memoryDeck]);

  useEffect(() => {
    if (isSolved) {
      trackGameLifecycle("game_complete", "sudoku", correctEntries);
    }
  }, [correctEntries, isSolved]);

  useEffect(() => {
    if (memorySolved) {
      trackGameLifecycle("game_complete", "memory", matchedLabels.length);
    }
  }, [matchedLabels.length, memorySolved]);

  function loadDifficulty(nextDifficulty: Difficulty) {
    setDifficulty(nextDifficulty);
    setBoard(cloneBoard(SUDOKU_CONFIGS[nextDifficulty].puzzle));
    setElapsedSeconds(0);
  }

  function handleChange(rowIndex: number, columnIndex: number, nextValue: string) {
    if (SUDOKU_CONFIGS[difficulty].puzzle[rowIndex][columnIndex] !== null) {
      return;
    }

    const digit = nextValue.replace(/[^1-9]/g, "").slice(-1);

    setBoard((current) =>
      current.map((row, currentRowIndex) =>
        row.map((value, currentColumnIndex) => {
          if (currentRowIndex !== rowIndex || currentColumnIndex !== columnIndex) {
            return value;
          }

          return digit ? Number(digit) : null;
        }),
      ),
    );
  }

  function resetBoard() {
    setBoard(cloneBoard(SUDOKU_CONFIGS[difficulty].puzzle));
    setElapsedSeconds(0);
  }

  function resetMemory() {
    setMemoryDeck(buildMemoryDeck());
    setFlippedCards([]);
    setMatchedLabels([]);
  }

  function handleMemoryCardClick(index: number) {
    const card = memoryDeck[index];

    if (
      flippedCards.includes(index) ||
      matchedLabels.includes(card.label) ||
      flippedCards.length >= 2
    ) {
      return;
    }

    setFlippedCards((current) => [...current, index]);
  }

  const status = isSolved
    ? "Solved clean. Nice."
    : conflicts.size > 0
      ? "There is a duplicate in a row, column, or 3x3 box."
      : "";

  return (
    <section id="games" className="section-block">
      <div className="games-header">
        <p className="section-eyebrow">Games</p>
        <div className="top-list-tags" aria-label="Game choices">
          {(["sudoku", "memory"] as GameMode[]).map((mode) => (
            <button
              className={`games-mode-button ${activeGame === mode ? "is-active" : ""}`}
              key={mode}
              onClick={() => setActiveGame(mode)}
              type="button"
            >
              {mode === "sudoku" ? "Sudoku" : "Memory"}
            </button>
          ))}
        </div>
      </div>
      <div className="games-grid">
        {activeGame === "sudoku" ? (
          <article className="card game-card sudoku-card">
            <div className="sudoku-toolbar">
              <div className="sudoku-difficulty-pills" aria-label="Sudoku difficulty">
                {(["easy", "medium", "hard"] as Difficulty[]).map((option) => (
                  <button
                    className={`sudoku-pill ${difficulty === option ? "is-active" : ""}`}
                    key={option}
                    onClick={() => loadDifficulty(option)}
                    type="button"
                  >
                    {SUDOKU_CONFIGS[option].label}
                  </button>
                ))}
              </div>
              <button className="ghost-button sudoku-reset-button" onClick={resetBoard} type="button">
                Start/Reset
              </button>
            </div>
            <div className="sudoku-board" aria-label="Playable Sudoku board">
              {board.flatMap((row, rowIndex) =>
                row.map((value, columnIndex) => {
                  const key = `${rowIndex}-${columnIndex}`;
                  const isGiven = SUDOKU_CONFIGS[difficulty].puzzle[rowIndex][columnIndex] !== null;
                  const isConflict = conflicts.has(key);

                  return (
                    <label
                      className={`sudoku-cell ${
                        isGiven ? "is-filled" : "is-editable"
                      } ${isConflict ? "is-conflict" : ""}`}
                      key={key}
                    >
                      <span className="sr-only">
                        Row {rowIndex + 1} column {columnIndex + 1}
                      </span>
                      {isGiven ? (
                        <span>{value}</span>
                      ) : (
                        <input
                          aria-label={`Sudoku row ${rowIndex + 1} column ${columnIndex + 1}`}
                          inputMode="numeric"
                          maxLength={1}
                          onChange={(event) =>
                            handleChange(rowIndex, columnIndex, event.target.value)
                          }
                          pattern="[1-9]"
                          type="text"
                          value={value ?? ""}
                        />
                      )}
                    </label>
                  );
                }),
              )}
            </div>
            <div className="sudoku-footer">
              {status ? <p className="sudoku-status">{status}</p> : null}
              <p className="sudoku-timer-readout">{formatElapsed(elapsedSeconds)}</p>
            </div>
          </article>
        ) : (
          <article className="card game-card memory-card">
            <div className="memory-toolbar">
              <div>
                <p className="memory-kicker">Memory Match</p>
                <h3>Pair the XLB signals</h3>
              </div>
              <button className="ghost-button sudoku-reset-button" onClick={resetMemory} type="button">
                Start/Reset
              </button>
            </div>
            <div className="memory-grid" aria-label="Playable memory matching board">
              {memoryDeck.map((card, index) => {
                const isRevealed = flippedCards.includes(index) || matchedLabels.includes(card.label);

                return (
                  <button
                    className={`memory-tile ${isRevealed ? "is-revealed" : ""}`}
                    key={card.id}
                    onClick={() => handleMemoryCardClick(index)}
                    type="button"
                  >
                    <span>{isRevealed ? card.label : "XLB"}</span>
                  </button>
                );
              })}
            </div>
            <div className="sudoku-footer">
              <p className="sudoku-status">
                {memorySolved ? "All pairs matched." : `${matchedLabels.length} of ${MEMORY_SYMBOLS.length} pairs matched.`}
              </p>
            </div>
          </article>
        )}
      </div>
    </section>
  );
}
