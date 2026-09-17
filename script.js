const board = document.getElementById("board");
const turnText = document.getElementById("turn");
const aiA = document.getElementById("aiA");
const aiB = document.getElementById("aiB");

const analysisCells = [
  ...document.querySelectorAll(".analysis-cell")
];

const thinkTime =
  document.getElementById("thinkTime");

const solverStatus =
  document.getElementById("solverStatus");

const rows = 7;
const cols = 9;
const CONNECT = 5;

const CENTER_ORDER = [
  4, 3, 5, 2, 6, 1, 7, 0, 8
];

const WIN_SCORE = 1000000;

let game;
let heights;
let currentPlayer;

let history = [];
let redoStack = [];

let gameOver = false;
let aiTimer = null;

let AI_TIME_LIMIT = 700;

let deadline = 0;
let timedOut = false;
let nodes = 0;

let table = new Map();


// ========================================
// PRECOMPUTED CONNECT-5 LINES
// ========================================

const WINDOWS = [];

function buildWindows() {
  WINDOWS.length = 0;

  // Horizontal
  for (let r = 0; r < rows; r++) {
    for (
      let c = 0;
      c <= cols - CONNECT;
      c++
    ) {
      const line = [];

      for (
        let i = 0;
        i < CONNECT;
        i++
      ) {
        line.push([
          r,
          c + i
        ]);
      }

      WINDOWS.push(line);
    }
  }

  // Vertical
  for (
    let r = 0;
    r <= rows - CONNECT;
    r++
  ) {
    for (let c = 0; c < cols; c++) {
      const line = [];

      for (
        let i = 0;
        i < CONNECT;
        i++
      ) {
        line.push([
          r + i,
          c
        ]);
      }

      WINDOWS.push(line);
    }
  }

  // Diagonal \
  for (
    let r = 0;
    r <= rows - CONNECT;
    r++
  ) {
    for (
      let c = 0;
      c <= cols - CONNECT;
      c++
    ) {
      const line = [];

      for (
        let i = 0;
        i < CONNECT;
        i++
      ) {
        line.push([
          r + i,
          c + i
        ]);
      }

      WINDOWS.push(line);
    }
  }

  // Diagonal /
  for (
    let r = 0;
    r <= rows - CONNECT;
    r++
  ) {
    for (
      let c = CONNECT - 1;
      c < cols;
      c++
    ) {
      const line = [];

      for (
        let i = 0;
        i < CONNECT;
        i++
      ) {
        line.push([
          r + i,
          c - i
        ]);
      }

      WINDOWS.push(line);
    }
  }
}

buildWindows();


// ========================================
// GAME
// ========================================

function emptyGame() {
  return Array.from(
    { length: rows },
    () => Array(cols).fill(null)
  );
}

function otherPlayer(player) {
  return player === "A"
    ? "B"
    : "A";
}

function newGame() {
  clearTimeout(aiTimer);

  game = emptyGame();

  heights =
    Array(cols).fill(rows - 1);

  currentPlayer = "A";

  history = [];
  redoStack = [];

  gameOver = false;

  board.innerHTML = "";

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell =
        document.createElement("div");

      cell.className = "cell";

      cell.dataset.row = r;
      cell.dataset.col = c;

      cell.onclick = () => {
        if (
          !gameOver &&
          !isAI()
        ) {
          playMove(c);
        }
      };

      board.appendChild(cell);
    }
  }

  clearAnalysis();

  updateTurn();

  updateSolverStatus(
    "Ready"
  );
}

function isAI() {
  if (currentPlayer === "A") {
    return aiA.checked;
  }

  return aiB.checked;
}

function legalMoves() {
  const result = [];

  for (const col of CENTER_ORDER) {
    if (heights[col] >= 0) {
      result.push(col);
    }
  }

  return result;
}

function makeMove(
  col,
  player
) {
  const row =
    heights[col];

  if (row < 0) {
    return -1;
  }

  game[row][col] =
    player;

  heights[col]--;

  return row;
}

function unmakeMove(
  col,
  row
) {
  game[row][col] =
    null;

  heights[col]++;
}

function playMove(col) {
  if (gameOver) {
    return;
  }

  if (heights[col] < 0) {
    return;
  }

  const player =
    currentPlayer;

  const row =
    makeMove(
      col,
      player
    );

  history.push({
    row,
    col,
    player
  });

  redoStack = [];

  drawCell(
    row,
    col,
    player
  );

  markLastMove(
    row,
    col
  );

  if (
    checkFive(
      row,
      col,
      player
    )
  ) {
    gameOver = true;

    turnText.textContent =
      `Player ${player} wins! 🎉`;

    clearAnalysis();

    return;
  }

  if (
    legalMoves().length === 0
  ) {
    gameOver = true;

    turnText.textContent =
      "Draw!";

    clearAnalysis();

    return;
  }

  currentPlayer =
    otherPlayer(player);

  updateTurn();

  if (isAI()) {
    scheduleAI();
  } else {
    scheduleAnalysis();
  }
}


// ========================================
// DRAW BOARD
// ========================================

function drawCell(
  row,
  col,
  player
) {
  const cell =
    board.querySelector(
      `[data-row="${row}"][data-col="${col}"]`
    );

  if (!cell) {
    return;
  }

  cell.className =
    player === "A"
      ? "cell player-a"
      : "cell player-b";
}

function markLastMove(
  row,
  col
) {
  board
    .querySelectorAll(
      ".last-move"
    )
    .forEach(cell => {
      cell.classList.remove(
        "last-move"
      );
    });

  const cell =
    board.querySelector(
      `[data-row="${row}"][data-col="${col}"]`
    );

  if (cell) {
    cell.classList.add(
      "last-move"
    );
  }
}

function refreshLastMove() {
  board
    .querySelectorAll(
      ".last-move"
    )
    .forEach(cell => {
      cell.classList.remove(
        "last-move"
      );
    });

  if (
    history.length === 0
  ) {
    return;
  }

  const move =
    history[
      history.length - 1
    ];

  markLastMove(
    move.row,
    move.col
  );
}

function updateTurn() {
  if (currentPlayer === "A") {
    turnText.textContent =
      "Turn: Player A 🔴";
  } else {
    turnText.textContent =
      "Turn: Player B 🟡";
  }
}


// ========================================
// CONNECT 5
// ========================================

function checkFive(
  row,
  col,
  player
) {
  const directions = [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1]
  ];

  for (
    const [dr, dc]
    of directions
  ) {
    let total = 1;

    total +=
      countDirection(
        row,
        col,
        dr,
        dc,
        player
      );

    total +=
      countDirection(
        row,
        col,
        -dr,
        -dc,
        player
      );

    if (total >= CONNECT) {
      return true;
    }
  }

  return false;
}

function countDirection(
  row,
  col,
  dr,
  dc,
  player
) {
  let total = 0;

  let r =
    row + dr;

  let c =
    col + dc;

  while (
    r >= 0 &&
    r < rows &&
    c >= 0 &&
    c < cols &&
    game[r][c] === player
  ) {
    total++;

    r += dr;
    c += dc;
  }

  return total;
}

function wouldWin(
  col,
  player
) {
  if (
    heights[col] < 0
  ) {
    return false;
  }

  const row =
    makeMove(
      col,
      player
    );

  const result =
    checkFive(
      row,
      col,
      player
    );

  unmakeMove(
    col,
    row
  );

  return result;
}

function winningMoves(player) {
  const result = [];

  for (
    const col
    of legalMoves()
  ) {
    if (
      wouldWin(
        col,
        player
      )
    ) {
      result.push(col);
    }
  }

  return result;
}


// ========================================
// TIME CONTROL
// ========================================

function outOfTime() {
  nodes++;

  // لا نفحص الساعة في كل عقدة.
  // هذا أسرع على الجوال.
  if (
    (nodes & 255) !== 0
  ) {
    return false;
  }

  if (
    performance.now() >=
    deadline
  ) {
    timedOut = true;

    return true;
  }

  return false;
}


// ========================================
// CACHE KEY
// ========================================

function boardKey(
  player,
  depth
) {
  let key =
    player +
    ":" +
    depth +
    ":";

  for (
    let c = 0;
    c < cols;
    c++
  ) {
    for (
      let r = rows - 1;
      r >= 0;
      r--
    ) {
      const value =
        game[r][c];

      if (value === null) {
        key += "0";
      }

      else if (
        value === "A"
      ) {
        key += "1";
      }

      else {
        key += "2";
      }
    }
  }

  return key;
}

function exactKey(player) {
  let key =
    player + ":";

  for (
    let c = 0;
    c < cols;
    c++
  ) {
    for (
      let r = rows - 1;
      r >= 0;
      r--
    ) {
      const value =
        game[r][c];

      if (value === null) {
        key += "0";
      }

      else if (
        value === "A"
      ) {
        key += "1";
      }

      else {
        key += "2";
      }
    }
  }

  return key;
}


// ========================================
// POSITION EVALUATION
// ========================================

function isPlayable(
  row,
  col
) {
  return (
    heights[col] === row
  );
}

function evaluate(player) {
  const opponent =
    otherPlayer(player);

  let score = 0;

  for (
    const line
    of WINDOWS
  ) {
    let mine = 0;
    let enemy = 0;
    let playable = 0;

    for (
      const [r, c]
      of line
    ) {
      const value =
        game[r][c];

      if (
        value === player
      ) {
        mine++;
      }

      else if (
        value === opponent
      ) {
        enemy++;
      }

      else if (
        isPlayable(r, c)
      ) {
        playable++;
      }
    }

    // وجود اللونين يعني أن
    // الخط لا يمكن أن يصبح Connect 5
    // لأي واحد منهما.
    if (
      mine > 0 &&
      enemy > 0
    ) {
      continue;
    }

    if (enemy === 0) {
      if (mine === 4) {
        score +=
          playable > 0
            ? 30000
            : 5000;
      }

      else if (
        mine === 3
      ) {
        score +=
          1200 +
          playable * 900;
      }

      else if (
        mine === 2
      ) {
        score +=
          160 +
          playable * 80;
      }

      else if (
        mine === 1
      ) {
        score += 12;
      }
    }

    if (mine === 0) {
      if (enemy === 4) {
        score -=
          playable > 0
            ? 34000
            : 5500;
      }

      else if (
        enemy === 3
      ) {
        score -=
          1400 +
          playable * 1000;
      }

      else if (
        enemy === 2
      ) {
        score -=
          180 +
          playable * 90;
      }
    }
  }

  // قيمة إضافية للوسط.
  for (
    let r = 0;
    r < rows;
    r++
  ) {
    if (
      game[r][4] === player
    ) {
      score += 20;
    }

    if (
      game[r][4] === opponent
    ) {
      score -= 20;
    }
  }

  return score;
}


// ========================================
// MOVE ORDERING
// ========================================

function orderedMoves(player) {
  const opponent =
    otherPlayer(player);

  const moves =
    legalMoves();

  const scored =
    moves.map(col => {
      let score =
        (
          5 -
          Math.abs(
            4 - col
          )
        ) * 100;

      if (
        wouldWin(
          col,
          player
        )
      ) {
        score += 1000000;
      }

      if (
        wouldWin(
          col,
          opponent
        )
      ) {
        score += 500000;
      }

      const row =
        makeMove(
          col,
          player
        );

      const ownWins =
        winningMoves(
          player
        ).length;

      const enemyWins =
        winningMoves(
          opponent
        ).length;

      score +=
        ownWins * 20000;

      score -=
        enemyWins * 40000;

      unmakeMove(
        col,
        row
      );

      return {
        col,
        score
      };
    });

  scored.sort(
    (a, b) =>
      b.score - a.score
  );

  return scored.map(
    item => item.col
  );
}


// ========================================
// NEGAMAX + ALPHA BETA
// ========================================

function negamax(
  player,
  depth,
  alpha,
  beta,
  ply
) {
  if (outOfTime()) {
    return 0;
  }

  const moves =
    legalMoves();

  if (
    moves.length === 0
  ) {
    return 0;
  }

  // اللاعب الحالي يستطيع الفوز الآن.
  for (const col of moves) {
    if (
      wouldWin(
        col,
        player
      )
    ) {
      return (
        WIN_SCORE -
        ply
      );
    }
  }

  const opponent =
    otherPlayer(player);

  const enemyWins =
    winningMoves(
      opponent
    );

  // الخصم لديه مكانان مختلفان
  // للفوز بالحركة القادمة.
  if (
    enemyWins.length >= 2
  ) {
    return (
      -WIN_SCORE +
      ply
    );
  }

  if (depth <= 0) {
    return evaluate(
      player
    );
  }

  let candidates;

  if (
    enemyWins.length === 1
  ) {
    // الحركة إجبارية.
    candidates = [
      enemyWins[0]
    ];
  }

  else {
    candidates =
      orderedMoves(
        player
      );
  }

  const key =
    boardKey(
      player,
      depth
    );

  const cached =
    table.get(key);

  if (
    cached !== undefined
  ) {
    return cached;
  }

  let best =
    -Infinity;

  for (
    const col
    of candidates
  ) {
    if (outOfTime()) {
      return 0;
    }

    const row =
      makeMove(
        col,
        player
      );

    let score;

    if (
      checkFive(
        row,
        col,
        player
      )
    ) {
      score =
        WIN_SCORE -
        ply;
    }

    else {
      score =
        -negamax(
          opponent,
          depth - 1,
          -beta,
          -alpha,
          ply + 1
        );
    }

    unmakeMove(
      col,
      row
    );

    if (timedOut) {
      return 0;
    }

    if (
      score > best
    ) {
      best = score;
    }

    if (
      score > alpha
    ) {
      alpha = score;
    }

    if (
      alpha >= beta
    ) {
      break;
    }
  }

  if (!timedOut) {
    table.set(
      key,
      best
    );
  }

  return best;
}


// ========================================
// AI SEARCH
// ========================================

function searchBestMove(
  player,
  timeLimit
) {
  deadline =
    performance.now() +
    timeLimit;

  nodes = 0;
  timedOut = false;

  table.clear();

  let moves =
    orderedMoves(
      player
    );

  if (
    moves.length === 0
  ) {
    return {
      move: null,
      score: 0,
      depth: 0
    };
  }

  let bestMove =
    moves[0];

  let bestScore =
    -Infinity;

  let completedDepth = 0;

  // فوز مباشر.
  for (
    const col
    of moves
  ) {
    if (
      wouldWin(
        col,
        player
      )
    ) {
      return {
        move: col,
        score: WIN_SCORE,
        depth: 1
      };
    }
  }

  const opponent =
    otherPlayer(player);

  const enemyWins =
    winningMoves(
      opponent
    );

  // صد الخطر المباشر.
  if (
    enemyWins.length === 1
  ) {
    bestMove =
      enemyWins[0];
  }

  for (
    let depth = 1;
    depth <= 20;
    depth++
  ) {
    if (
      performance.now() >=
      deadline
    ) {
      break;
    }

    timedOut = false;

    let localBest =
      bestMove;

    let localScore =
      -Infinity;

    let alpha =
      -Infinity;

    const beta =
      Infinity;

    const rootMoves =
      orderedMoves(
        player
      );

    for (
      const col
      of rootMoves
    ) {
      if (
        performance.now() >=
        deadline
      ) {
        timedOut = true;
        break;
      }

      const row =
        makeMove(
          col,
          player
        );

      let score;

      if (
        checkFive(
          row,
          col,
          player
        )
      ) {
        score =
          WIN_SCORE;
      }

      else {
        score =
          -negamax(
            opponent,
            depth - 1,
            -beta,
            -alpha,
            1
          );
      }

      unmakeMove(
        col,
        row
      );

      if (timedOut) {
        break;
      }

      if (
        score >
        localScore
      ) {
        localScore =
          score;

        localBest =
          col;
      }

      if (
        score > alpha
      ) {
        alpha = score;
      }
    }

    if (timedOut) {
      break;
    }

    bestMove =
      localBest;

    bestScore =
      localScore;

    completedDepth =
      depth;

    if (
      Math.abs(
        bestScore
      ) >=
      WIN_SCORE - 100
    ) {
      break;
    }
  }

  return {
    move: bestMove,
    score: bestScore,
    depth: completedDepth
  };
}


// ========================================
// EXACT SOLVER
// ========================================

function exactSolve(
  player,
  memo
) {
  if (
    performance.now() >=
    deadline
  ) {
    return {
      type: "UNKNOWN",
      distance: null
    };
  }

  const moves =
    legalMoves();

  if (
    moves.length === 0
  ) {
    return {
      type: "DRAW",
      distance: 0
    };
  }

  // فوز مباشر.
  for (
    const col
    of moves
  ) {
    if (
      wouldWin(
        col,
        player
      )
    ) {
      return {
        type: "WIN",
        distance: 1
      };
    }
  }

  const key =
    exactKey(player);

  const cached =
    memo.get(key);

  if (cached) {
    return cached;
  }

  const opponent =
    otherPlayer(player);

  let shortestWin =
    Infinity;

  let longestLoss =
    -1;

  let hasDraw =
    false;

  let hasUnknown =
    false;

  const ordered =
    orderedMoves(
      player
    );

  for (
    const col
    of ordered
  ) {
    if (
      performance.now() >=
      deadline
    ) {
      hasUnknown = true;
      break;
    }

    const row =
      makeMove(
        col,
        player
      );

    let child;

    if (
      checkFive(
        row,
        col,
        player
      )
    ) {
      child = {
        type: "LOSS",
        distance: 0
      };
    }

    else {
      child =
        exactSolve(
          opponent,
          memo
        );
    }

    unmakeMove(
      col,
      row
    );

    if (
      child.type ===
      "UNKNOWN"
    ) {
      hasUnknown = true;
      continue;
    }

    // إذا الخصم خاسر بعد حركتنا
    // فنحن نستطيع إجبار الفوز.
    if (
      child.type ===
      "LOSS"
    ) {
      shortestWin =
        Math.min(
          shortestWin,
          child.distance + 1
        );
    }

    else if (
      child.type ===
      "DRAW"
    ) {
      hasDraw = true;
    }

    else if (
      child.type ===
      "WIN"
    ) {
      longestLoss =
        Math.max(
          longestLoss,
          child.distance + 1
        );
    }
  }

  let result;

  if (
    shortestWin !==
    Infinity
  ) {
    result = {
      type: "WIN",
      distance:
        shortestWin
    };
  }

  else if (
    hasUnknown
  ) {
    result = {
      type: "UNKNOWN",
      distance: null
    };
  }

  else if (
    hasDraw
  ) {
    result = {
      type: "DRAW",
      distance: 0
    };
  }

  else {
    result = {
      type: "LOSS",
      distance:
        longestLoss < 0
          ? 0
          : longestLoss
    };
  }

  if (
    result.type !==
    "UNKNOWN"
  ) {
    memo.set(
      key,
      result
    );
  }

  return result;
}


// ========================================
// W / D / L COLUMN ANALYSIS
// ========================================

function clearAnalysis() {
  analysisCells.forEach(
    (cell, col) => {
      if (
        heights &&
        heights[col] < 0
      ) {
        cell.textContent =
          "×";

        cell.className =
          "analysis-cell closed";
      }

      else {
        cell.textContent =
          "?";

        cell.className =
          "analysis-cell unknown";
      }
    }
  );
}

function showResult(
  col,
  result
) {
  const cell =
    analysisCells[col];

  if (!cell) {
    return;
  }

  cell.className =
    "analysis-cell";

  if (
    result.type === "WIN"
  ) {
    cell.textContent =
      `W ${result.distance}`;

    cell.classList.add(
      "win"
    );
  }

  else if (
    result.type === "DRAW"
  ) {
    cell.textContent =
      "D";

    cell.classList.add(
      "draw"
    );
  }

  else if (
    result.type === "LOSS"
  ) {
    cell.textContent =
      `L ${result.distance}`;

    cell.classList.add(
      "loss"
    );
  }

  else {
    cell.textContent =
      "?";

    cell.classList.add(
      "unknown"
    );
  }
}

function scheduleAnalysis() {
  setTimeout(
    analyzePosition,
    20
  );
}

function analyzePosition() {
  if (gameOver) {
    return;
  }

  const player =
    currentPlayer;

  clearAnalysis();

  const empties =
    heights.reduce(
      (total, h) =>
        total + h + 1,
      0
    );

  // في بداية المباراة لا نحاول
  // قتل الجوال بحل 63 خانة كاملة.
  //
  // كلما اقتربنا من النهاية نعطي
  // الـExact Solver وقتًا أطول.
  let analysisTime;

  if (empties <= 14) {
    analysisTime =
      Math.max(
        AI_TIME_LIMIT,
        3000
      );
  }

  else if (
    empties <= 20
  ) {
    analysisTime =
      Math.max(
        AI_TIME_LIMIT,
        1800
      );
  }

  else {
    analysisTime =
      Math.min(
        AI_TIME_LIMIT,
        500
      );
  }

  deadline =
    performance.now() +
    analysisTime;

  const memo =
    new Map();

  const moves =
    legalMoves();

  for (
    const col
    of moves
  ) {
    if (
      performance.now() >=
      deadline
    ) {
      break;
    }

    const row =
      makeMove(
        col,
        player
      );

    let result;

    if (
      checkFive(
        row,
        col,
        player
      )
    ) {
      result = {
        type: "WIN",
        distance: 1
      };
    }

    else {
      const child =
        exactSolve(
          otherPlayer(player),
          memo
        );

      if (
        child.type ===
        "WIN"
      ) {
        result = {
          type: "LOSS",
          distance:
            child.distance + 1
        };
      }

      else if (
        child.type ===
        "LOSS"
      ) {
        result = {
          type: "WIN",
          distance:
            child.distance + 1
        };
      }

      else if (
        child.type ===
        "DRAW"
      ) {
        result = {
          type: "DRAW",
          distance: 0
        };
      }

      else {
        result = {
          type: "UNKNOWN",
          distance: null
        };
      }
    }

    unmakeMove(
      col,
      row
    );

    showResult(
      col,
      result
    );
  }

  updateSolverStatus(
    `Position analysis · ${empties} empty cells`
  );
}


// ========================================
// AI
// ========================================

function scheduleAI() {
  clearTimeout(aiTimer);

  turnText.textContent =
    `Player ${currentPlayer} is thinking... 🧠`;

  aiTimer =
    setTimeout(
      aiMove,
      60
    );
}

function aiMove() {
  if (
    gameOver ||
    !isAI()
  ) {
    return;
  }

  const player =
    currentPlayer;

  const opponent =
    otherPlayer(player);

  // 1. Win immediately
  const wins =
    winningMoves(
      player
    );

  if (
    wins.length > 0
  ) {
    playMove(
      wins[0]
    );

    return;
  }

  // 2. Block immediate loss
  const enemyWins =
    winningMoves(
      opponent
    );

  if (
    enemyWins.length > 0
  ) {
    playMove(
      enemyWins[0]
    );

    return;
  }

  updateSolverStatus(
    "Searching..."
  );

  const result =
    searchBestMove(
      player,
      AI_TIME_LIMIT
    );

  updateSolverStatus(
    `Depth ${result.depth} · ${nodes.toLocaleString()} nodes`
  );

  if (
    result.move !== null
  ) {
    playMove(
      result.move
    );
  }
}


// ========================================
// THINKING TIME
// ========================================

function updateSolverStatus(text) {
  if (
    solverStatus
  ) {
    solverStatus.textContent =
      text;
  }
}

if (thinkTime) {
  thinkTime.onchange = () => {
    AI_TIME_LIMIT =
      Number(
        thinkTime.value
      );

    updateSolverStatus(
      `Thinking time: ${AI_TIME_LIMIT} ms`
    );

    if (
      !gameOver &&
      !isAI()
    ) {
      scheduleAnalysis();
    }
  };
}


// ========================================
// STOP AI
// ========================================

function stopAI() {
  clearTimeout(aiTimer);

  aiA.checked = false;
  aiB.checked = false;
}


// ========================================
// UNDO
// ========================================

document.getElementById(
  "undo"
).onclick = () => {
  if (
    history.length === 0
  ) {
    return;
  }

  stopAI();

  gameOver = false;

  const move =
    history.pop();

  game[
    move.row
  ][
    move.col
  ] = null;

  heights[
    move.col
  ]++;

  redoStack.push(
    move
  );

  const cell =
    board.querySelector(
      `[data-row="${move.row}"][data-col="${move.col}"]`
    );

  if (cell) {
    cell.className =
      "cell";
  }

  currentPlayer =
    move.player;

  refreshLastMove();
  updateTurn();

  scheduleAnalysis();
};


// ========================================
// REDO
// ========================================

document.getElementById(
  "redo"
).onclick = () => {
  if (
    redoStack.length === 0
  ) {
    return;
  }

  stopAI();

  const move =
    redoStack.pop();

  game[
    move.row
  ][
    move.col
  ] =
    move.player;

  heights[
    move.col
  ]--;

  history.push(
    move
  );

  drawCell(
    move.row,
    move.col,
    move.player
  );

  markLastMove(
    move.row,
    move.col
  );

  if (
    checkFive(
      move.row,
      move.col,
      move.player
    )
  ) {
    gameOver = true;

    turnText.textContent =
      `Player ${move.player} wins! 🎉`;

    clearAnalysis();

    return;
  }

  gameOver = false;

  currentPlayer =
    otherPlayer(
      move.player
    );

  updateTurn();

  scheduleAnalysis();
};


// ========================================
// RESTART
// ========================================

document.getElementById(
  "restart"
).onclick = () => {
  stopAI();

  newGame();

  scheduleAnalysis();
};


// ========================================
// AI CHECKBOXES
// ========================================

aiA.onchange = () => {
  if (
    !gameOver &&
    currentPlayer === "A" &&
    aiA.checked
  ) {
    scheduleAI();
  }
};

aiB.onchange = () => {
  if (
    !gameOver &&
    currentPlayer === "B" &&
    aiB.checked
  ) {
    scheduleAI();
  }
};


// ========================================
// START
// ========================================

newGame();

scheduleAnalysis();
