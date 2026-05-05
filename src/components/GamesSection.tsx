import { Chess } from "chess.js";
import type { Square } from "chess.js";
import { useEffect, useMemo, useRef, useState } from "react";
import { trackGameLifecycle } from "../lib/analytics";

type SudokuValue = number | null;
type SudokuBoard = SudokuValue[][];
type Difficulty = "easy" | "medium" | "hard";
type GameMode = "chess" | "go" | "connect-four" | "sudoku" | "memory";
type GoStone = "black" | "white" | null;
type GoBoard = GoStone[][];
type ConnectDisc = "red" | "yellow" | null;
type ConnectBoard = ConnectDisc[][];
type GoTurn = "black" | "white";
type ConnectTurn = "red" | "yellow";

interface SudokuConfig {
  label: string;
  puzzle: SudokuBoard;
  solution: number[][];
}

interface GoState {
  board: GoBoard;
  turn: GoTurn;
  captures: Record<GoTurn, number>;
  passCount: number;
  previousSignature: string | null;
  gameOver: boolean;
  status: string;
}

interface ConnectFourState {
  board: ConnectBoard;
  turn: ConnectTurn;
  winner: ConnectTurn | "draw" | null;
  status: string;
}

const GAME_LABELS: Record<GameMode, string> = {
  chess: "Chess",
  go: "Go 9x9",
  "connect-four": "Connect Four",
  sudoku: "Sudoku",
  memory: "Memory",
};

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
const CHESS_FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
const CONNECT_ROWS = 6;
const CONNECT_COLUMNS = 7;
const GO_SIZE = 9;
const CHESS_GLYPHS: Record<string, string> = {
  wp: "♙",
  wn: "♘",
  wb: "♗",
  wr: "♖",
  wq: "♕",
  wk: "♔",
  bp: "♟",
  bn: "♞",
  bb: "♝",
  br: "♜",
  bq: "♛",
  bk: "♚",
};

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
    collectSudokuGroupConflicts(
      board[rowIndex].map((value, columnIndex) => ({ rowIndex, columnIndex, value })),
      conflicts,
    );
  }

  for (let columnIndex = 0; columnIndex < 9; columnIndex += 1) {
    collectSudokuGroupConflicts(
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

      collectSudokuGroupConflicts(cells, conflicts);
    }
  }

  return conflicts;
}

function collectSudokuGroupConflicts(
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

function getSudokuProgress(board: SudokuBoard, difficulty: Difficulty, conflicts: Set<string>) {
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

function createGoBoard() {
  return Array.from({ length: GO_SIZE }, () =>
    Array.from({ length: GO_SIZE }, () => null as GoStone),
  );
}

function cloneGoBoard(board: GoBoard) {
  return board.map((row) => [...row]);
}

function goStoneLabel(stone: GoTurn) {
  return stone === "black" ? "Black" : "White";
}

function getGoSignature(board: GoBoard) {
  return board.map((row) => row.map((cell) => (cell ? cell[0] : "_")).join("")).join("|");
}

function getGoNeighbors(row: number, column: number) {
  return [
    [row - 1, column],
    [row + 1, column],
    [row, column - 1],
    [row, column + 1],
  ].filter(
    ([nextRow, nextColumn]) =>
      nextRow >= 0 && nextRow < GO_SIZE && nextColumn >= 0 && nextColumn < GO_SIZE,
  ) as Array<[number, number]>;
}

function getGoGroup(board: GoBoard, row: number, column: number) {
  const stone = board[row][column];
  const cells: Array<[number, number]> = [];
  const liberties = new Set<string>();

  if (!stone) {
    return { cells, liberties };
  }

  const queue: Array<[number, number]> = [[row, column]];
  const visited = new Set<string>();

  while (queue.length) {
    const [currentRow, currentColumn] = queue.pop() as [number, number];
    const key = `${currentRow}-${currentColumn}`;

    if (visited.has(key)) {
      continue;
    }

    visited.add(key);
    cells.push([currentRow, currentColumn]);

    for (const [nextRow, nextColumn] of getGoNeighbors(currentRow, currentColumn)) {
      const nextStone = board[nextRow][nextColumn];
      if (!nextStone) {
        liberties.add(`${nextRow}-${nextColumn}`);
        continue;
      }

      if (nextStone === stone && !visited.has(`${nextRow}-${nextColumn}`)) {
        queue.push([nextRow, nextColumn]);
      }
    }
  }

  return { cells, liberties };
}

function removeGoGroup(board: GoBoard, cells: Array<[number, number]>) {
  cells.forEach(([row, column]) => {
    board[row][column] = null;
  });
}

function countGoStones(board: GoBoard, stone: Exclude<GoStone, null>) {
  return board.flat().filter((value) => value === stone).length;
}

function createInitialGoState(): GoState {
  return {
    board: createGoBoard(),
    turn: "black",
    captures: { black: 0, white: 0 },
    passCount: 0,
    previousSignature: null,
    gameOver: false,
    status: "Black to play",
  };
}

function placeGoStone(state: GoState, row: number, column: number) {
  if (state.gameOver) {
    return state;
  }

  if (state.board[row][column]) {
    return { ...state, status: "Choose an empty intersection." };
  }

  const nextBoard = cloneGoBoard(state.board);
  nextBoard[row][column] = state.turn;

  const opponent: GoTurn = state.turn === "black" ? "white" : "black";
  let captured = 0;

  for (const [nextRow, nextColumn] of getGoNeighbors(row, column)) {
    if (nextBoard[nextRow][nextColumn] !== opponent) {
      continue;
    }

    const group = getGoGroup(nextBoard, nextRow, nextColumn);
    if (group.liberties.size === 0) {
      captured += group.cells.length;
      removeGoGroup(nextBoard, group.cells);
    }
  }

  const ownGroup = getGoGroup(nextBoard, row, column);
  if (ownGroup.liberties.size === 0) {
    return { ...state, status: "That move has no liberties." };
  }

  const nextSignature = getGoSignature(nextBoard);
  if (state.previousSignature && nextSignature === state.previousSignature) {
    return { ...state, status: "Simple ko: choose another point." };
  }

  return {
    board: nextBoard,
    turn: opponent,
    captures: {
      ...state.captures,
      [state.turn]: state.captures[state.turn] + captured,
    },
    passCount: 0,
    previousSignature: getGoSignature(state.board),
    gameOver: false,
    status: `${goStoneLabel(opponent)} to play`,
  };
}

function passGoTurn(state: GoState) {
  if (state.gameOver) {
    return state;
  }

  const opponent: GoTurn = state.turn === "black" ? "white" : "black";
  const nextPassCount = state.passCount + 1;

  if (nextPassCount >= 2) {
    const blackScore = countGoStones(state.board, "black") + state.captures.black;
    const whiteScore = countGoStones(state.board, "white") + state.captures.white;
    const winner =
      blackScore === whiteScore
        ? "Level finish"
        : blackScore > whiteScore
          ? `Black wins ${blackScore}-${whiteScore}`
          : `White wins ${whiteScore}-${blackScore}`;

    return {
      ...state,
      passCount: nextPassCount,
      gameOver: true,
      status: `Both players passed. ${winner}.`,
    };
  }

  return {
    ...state,
    turn: opponent,
    passCount: nextPassCount,
    previousSignature: getGoSignature(state.board),
    status: `${goStoneLabel(opponent)} to play`,
  };
}

function createConnectBoard() {
  return Array.from({ length: CONNECT_ROWS }, () =>
    Array.from({ length: CONNECT_COLUMNS }, () => null as ConnectDisc),
  );
}

function createInitialConnectState(): ConnectFourState {
  return {
    board: createConnectBoard(),
    turn: "red",
    winner: null,
    status: "Red to move",
  };
}

function hasConnectWinner(board: ConnectBoard, row: number, column: number, disc: ConnectTurn) {
  const directions = [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1],
  ];

  for (const [rowStep, columnStep] of directions) {
    let streak = 1;

    for (const direction of [-1, 1]) {
      let nextRow = row + rowStep * direction;
      let nextColumn = column + columnStep * direction;

      while (
        nextRow >= 0 &&
        nextRow < CONNECT_ROWS &&
        nextColumn >= 0 &&
        nextColumn < CONNECT_COLUMNS &&
        board[nextRow][nextColumn] === disc
      ) {
        streak += 1;
        nextRow += rowStep * direction;
        nextColumn += columnStep * direction;
      }
    }

    if (streak >= 4) {
      return true;
    }
  }

  return false;
}

function dropConnectDisc(state: ConnectFourState, column: number): ConnectFourState {
  if (state.winner) {
    return state;
  }

  const row = [...state.board].reverse().findIndex((line) => !line[column]);
  if (row === -1) {
    return { ...state, status: "That column is full." };
  }

  const nextRow = CONNECT_ROWS - 1 - row;
  const nextBoard = state.board.map((line) => [...line]);
  nextBoard[nextRow][column] = state.turn;

  if (hasConnectWinner(nextBoard, nextRow, column, state.turn)) {
    return {
      board: nextBoard,
      turn: state.turn,
      winner: state.turn,
      status: `${state.turn === "red" ? "Red" : "Yellow"} wins.`,
    };
  }

  if (nextBoard.every((line) => line.every(Boolean))) {
    return {
      board: nextBoard,
      turn: state.turn,
      winner: "draw" as const,
      status: "Draw.",
    };
  }

  const nextTurn: ConnectTurn = state.turn === "red" ? "yellow" : "red";
  return {
    board: nextBoard,
    turn: nextTurn,
    winner: null,
    status: `${nextTurn === "red" ? "Red" : "Yellow"} to move`,
  };
}

function getChessStatus(game: Chess) {
  if (game.isCheckmate()) {
    return `Checkmate. ${game.turn() === "w" ? "Black" : "White"} wins.`;
  }

  if (game.isDraw()) {
    return "Draw.";
  }

  if (game.inCheck()) {
    return `${game.turn() === "w" ? "White" : "Black"} is in check.`;
  }

  return `${game.turn() === "w" ? "White" : "Black"} to move.`;
}

function renderChessPiece(piece: { color: "w" | "b"; type: string } | null) {
  if (!piece) {
    return "";
  }

  return CHESS_GLYPHS[`${piece.color}${piece.type}`] ?? "";
}

export default function GamesSection() {
  const [activeGame, setActiveGame] = useState<GameMode>("chess");

  const [chessGame, setChessGame] = useState(() => new Chess());
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);

  const [goState, setGoState] = useState<GoState>(() => createInitialGoState());
  const [connectState, setConnectState] = useState<ConnectFourState>(() => createInitialConnectState());

  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const [board, setBoard] = useState<SudokuBoard>(() => cloneBoard(SUDOKU_CONFIGS.easy.puzzle));
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const [memoryDeck, setMemoryDeck] = useState(() => buildMemoryDeck());
  const [flippedCards, setFlippedCards] = useState<number[]>([]);
  const [matchedLabels, setMatchedLabels] = useState<string[]>([]);

  const chessCompletionRef = useRef<string | null>(null);
  const goCompletionRef = useRef<string | null>(null);
  const connectCompletionRef = useRef<string | null>(null);

  const conflicts = getConflictKeys(board);
  const { correctEntries, totalEmptyCells } = getSudokuProgress(board, difficulty, conflicts);
  const isSolved = correctEntries === totalEmptyCells && conflicts.size === 0;
  const memorySolved = matchedLabels.length === MEMORY_SYMBOLS.length;

  const chessMoves = useMemo(() => {
    if (!selectedSquare) {
      return new Set<string>();
    }

    return new Set(
      chessGame
        .moves({ square: selectedSquare, verbose: true })
        .map((move) => move.to),
    );
  }, [chessGame, selectedSquare]);

  useEffect(() => {
    trackGameLifecycle("game_start", activeGame);
  }, [activeGame]);

  useEffect(() => {
    if (activeGame !== "sudoku" || isSolved) {
      return;
    }

    const interval = window.setInterval(() => {
      setElapsedSeconds((current) => current + 1);
    }, 1000);

    return () => window.clearInterval(interval);
  }, [activeGame, isSolved]);

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

  useEffect(() => {
    const signature = chessGame.fen();
    if (!chessGame.isGameOver() || chessCompletionRef.current === signature) {
      return;
    }

    chessCompletionRef.current = signature;
    trackGameLifecycle("game_complete", "chess");
  }, [chessGame]);

  useEffect(() => {
    const signature = `${goState.gameOver}-${goState.status}`;
    if (!goState.gameOver || goCompletionRef.current === signature) {
      return;
    }

    goCompletionRef.current = signature;
    trackGameLifecycle("game_complete", "go");
  }, [goState]);

  useEffect(() => {
    const signature = `${connectState.winner}-${connectState.status}`;
    if (!connectState.winner || connectCompletionRef.current === signature) {
      return;
    }

    connectCompletionRef.current = signature;
    trackGameLifecycle("game_complete", "connect-four");
  }, [connectState]);

  function handleChessSquare(square: Square) {
    const piece = chessGame.get(square);

    if (selectedSquare) {
      const nextGame = new Chess(chessGame.fen());
      const result = nextGame.move({
        from: selectedSquare,
        to: square,
        promotion: "q",
      });

      if (result) {
        setChessGame(nextGame);
        setSelectedSquare(null);
        return;
      }
    }

    if (piece && piece.color === chessGame.turn()) {
      setSelectedSquare(square);
      return;
    }

    setSelectedSquare(null);
  }

  function resetChess() {
    chessCompletionRef.current = null;
    setChessGame(new Chess());
    setSelectedSquare(null);
  }

  function loadDifficulty(nextDifficulty: Difficulty) {
    setDifficulty(nextDifficulty);
    setBoard(cloneBoard(SUDOKU_CONFIGS[nextDifficulty].puzzle));
    setElapsedSeconds(0);
  }

  function handleSudokuChange(rowIndex: number, columnIndex: number, nextValue: string) {
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

    if (flippedCards.includes(index) || matchedLabels.includes(card.label) || flippedCards.length >= 2) {
      return;
    }

    setFlippedCards((current) => [...current, index]);
  }

  const sudokuStatus = isSolved
    ? "Solved clean."
    : conflicts.size > 0
      ? "There is a duplicate in a row, column, or 3x3 box."
      : "";

  return (
    <section id="games" className="section-block">
      <div className="games-header">
        <p className="section-eyebrow">Games</p>
        <div className="top-list-tags" aria-label="Game choices">
          {(Object.keys(GAME_LABELS) as GameMode[]).map((mode) => (
            <button
              className={`games-mode-button ${activeGame === mode ? "is-active" : ""}`}
              key={mode}
              onClick={() => setActiveGame(mode)}
              type="button"
            >
              {GAME_LABELS[mode]}
            </button>
          ))}
        </div>
      </div>

      <div className="games-grid games-grid-wide">
        {activeGame === "chess" ? (
          <article className="card game-card longform-game-card">
            <div className="longform-game-header">
              <div>
                <p className="section-eyebrow">Chess</p>
                <h2>Full board, legal moves</h2>
              </div>
              <button className="ghost-button sudoku-reset-button" onClick={resetChess} type="button">
                Reset
              </button>
            </div>
            <div className="board-shell">
              <div className="chess-board" aria-label="Playable chess board">
                {chessGame.board().flatMap((row, rowIndex) =>
                  row.map((piece, columnIndex) => {
                    const square = `${CHESS_FILES[columnIndex]}${8 - rowIndex}` as Square;
                    const isDark = (rowIndex + columnIndex) % 2 === 1;
                    const isSelected = selectedSquare === square;
                    const isTarget = chessMoves.has(square);

                    return (
                      <button
                        aria-label={`Chess square ${square}`}
                        className={`chess-square ${isDark ? "is-dark" : "is-light"} ${isSelected ? "is-selected" : ""} ${isTarget ? "is-target" : ""}`}
                        key={square}
                        onClick={() => handleChessSquare(square)}
                        type="button"
                      >
                        <span>{renderChessPiece(piece)}</span>
                      </button>
                    );
                  }),
                )}
              </div>
              <aside className="board-side-panel">
                <div className="metric-grid">
                  <div className="metric-pill">
                    <span>Status</span>
                    <strong>{getChessStatus(chessGame)}</strong>
                  </div>
                  <div className="metric-pill">
                    <span>Selection</span>
                    <strong>{selectedSquare ?? "None"}</strong>
                  </div>
                </div>
                <p className="muted">Click a piece, then a destination square. Promotions auto-queen.</p>
              </aside>
            </div>
          </article>
        ) : null}

        {activeGame === "go" ? (
          <article className="card game-card longform-game-card">
            <div className="longform-game-header">
              <div>
                <p className="section-eyebrow">Go 9x9</p>
                <h2>Fast board, capture rules</h2>
              </div>
              <div className="event-related-list">
                <button className="ghost-button" onClick={() => setGoState(passGoTurn)} type="button">
                  Pass
                </button>
                <button
                  className="ghost-button sudoku-reset-button"
                  onClick={() => {
                    goCompletionRef.current = null;
                    setGoState(createInitialGoState());
                  }}
                  type="button"
                >
                  Reset
                </button>
              </div>
            </div>
            <div className="board-shell">
              <div className="go-board" aria-label="Playable Go board">
                {goState.board.flatMap((row, rowIndex) =>
                  row.map((stone, columnIndex) => (
                    <button
                      aria-label={`Go point ${rowIndex + 1}-${columnIndex + 1}`}
                      className="go-point"
                      key={`${rowIndex}-${columnIndex}`}
                      onClick={() => setGoState((current) => placeGoStone(current, rowIndex, columnIndex))}
                      type="button"
                    >
                      {stone ? <span className={`go-stone go-stone-${stone}`} /> : null}
                    </button>
                  )),
                )}
              </div>
              <aside className="board-side-panel">
                <div className="metric-grid">
                  <div className="metric-pill">
                    <span>Turn</span>
                    <strong>{goStoneLabel(goState.turn)}</strong>
                  </div>
                  <div className="metric-pill">
                    <span>Captures</span>
                    <strong>{goState.captures.black}B / {goState.captures.white}W</strong>
                  </div>
                </div>
                <p className="muted">{goState.status}</p>
              </aside>
            </div>
          </article>
        ) : null}

        {activeGame === "connect-four" ? (
          <article className="card game-card longform-game-card">
            <div className="longform-game-header">
              <div>
                <p className="section-eyebrow">Connect Four</p>
                <h2>Drop and build four in a row</h2>
              </div>
              <button
                className="ghost-button sudoku-reset-button"
                onClick={() => {
                  connectCompletionRef.current = null;
                  setConnectState(createInitialConnectState());
                }}
                type="button"
              >
                Reset
              </button>
            </div>
            <div className="board-shell">
              <div className="connect-four-shell">
                <div className="connect-drop-row">
                  {Array.from({ length: CONNECT_COLUMNS }, (_, columnIndex) => (
                    <button
                      className="connect-drop-button"
                      key={`drop-${columnIndex}`}
                      onClick={() => setConnectState((current) => dropConnectDisc(current, columnIndex))}
                      type="button"
                    >
                      Drop
                    </button>
                  ))}
                </div>
                <div className="connect-board" aria-label="Playable Connect Four board">
                  {connectState.board.flatMap((row, rowIndex) =>
                    row.map((disc, columnIndex) => (
                      <button
                        aria-label={`Connect Four cell ${rowIndex + 1}-${columnIndex + 1}`}
                        className="connect-cell"
                        key={`${rowIndex}-${columnIndex}`}
                        onClick={() => setConnectState((current) => dropConnectDisc(current, columnIndex))}
                        type="button"
                      >
                        <span className={`connect-disc ${disc ? `connect-disc-${disc}` : ""}`} />
                      </button>
                    )),
                  )}
                </div>
              </div>
              <aside className="board-side-panel">
                <div className="metric-grid">
                  <div className="metric-pill">
                    <span>Status</span>
                    <strong>{connectState.status}</strong>
                  </div>
                  <div className="metric-pill">
                    <span>Turn</span>
                    <strong>{connectState.turn === "red" ? "Red" : "Yellow"}</strong>
                  </div>
                </div>
              </aside>
            </div>
          </article>
        ) : null}

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
                Reset
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
                      className={`sudoku-cell ${isGiven ? "is-filled" : "is-editable"} ${isConflict ? "is-conflict" : ""}`}
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
                          onChange={(event) => handleSudokuChange(rowIndex, columnIndex, event.target.value)}
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
              {sudokuStatus ? <p className="sudoku-status">{sudokuStatus}</p> : null}
              <p className="sudoku-timer-readout">{formatElapsed(elapsedSeconds)}</p>
            </div>
          </article>
        ) : null}

        {activeGame === "memory" ? (
          <article className="card game-card memory-card">
            <div className="memory-toolbar">
              <div>
                <p className="memory-kicker">Memory Match</p>
                <h3>Pair the XLB signals</h3>
              </div>
              <button className="ghost-button sudoku-reset-button" onClick={resetMemory} type="button">
                Reset
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
                {memorySolved
                  ? "All pairs matched."
                  : `${matchedLabels.length} of ${MEMORY_SYMBOLS.length} pairs matched.`}
              </p>
            </div>
          </article>
        ) : null}
      </div>
    </section>
  );
}
