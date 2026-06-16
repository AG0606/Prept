'use client';

/**
 * TetrisAnimation — A refined brutalist Tetris visual for the "Structural Learning" section.
 * 
 * Design decisions:
 * - 10×14 grid at 24px cells — classic Tetris proportions
 * - 5-row "foundation" at bottom with organic mountain shape (full → sparse)
 * - 3 actual Tetris piece shapes (T, L, I) built from individual cells
 * - Staggered fall timings create a rhythmic, living animation
 * - The accent T-piece is the "hero" — draws the eye
 * - Static blocks use var(--fg) for solidity; gaps suggest room to learn
 * - Subtle grid lines and coordinate markers for the blueprint aesthetic
 */

const CELL = 24;
const COLS = 10;
const ROWS = 14;

// Static foundation blocks — bottom 5 rows, from bottom (row 0) up
// Designed to look like a game in progress: full bottom, tapering up with strategic gaps
const FOUNDATION: { col: number; row: number }[] = [];

// Row 0 (very bottom): fully filled — about to clear
[0,1,2,3,4,5,6,7,8,9].forEach(c => FOUNDATION.push({ col: c, row: 0 }));

// Row 1: nearly full — gap at cols 4-5 waiting for a piece
[0,1,2,3,6,7,8,9].forEach(c => FOUNDATION.push({ col: c, row: 1 }));

// Row 2: partial — gaps suggest completed piece outlines
[0,1,4,5,6,7].forEach(c => FOUNDATION.push({ col: c, row: 2 }));

// Row 3: sparse — remnants of earlier placements
[2,3,7,8].forEach(c => FOUNDATION.push({ col: c, row: 3 }));

// Row 4: minimal — single block remnant
[7].forEach(c => FOUNDATION.push({ col: c, row: 4 }));

// Row 5: just a trace
[8].forEach(c => FOUNDATION.push({ col: c, row: 5 }));

interface PieceDef {
  id: string;
  // Cell offsets [col, row] from the piece container's origin
  cells: [number, number][];
  // Column position in the grid
  gridCol: number;
  // CSS color values
  bg: string;
  border: string;
}

const FALLING_PIECES: PieceDef[] = [
  {
    id: 't-piece',
    // T-shape: ███ + centered cell below
    //          ░█░
    cells: [[0, 0], [1, 0], [2, 0], [1, 1]],
    gridCol: 3,
    bg: 'var(--accent)',
    border: 'var(--accent)',
  },
  {
    id: 'l-piece',
    // L-shape: █░
    //          █░
    //          ██
    cells: [[0, 0], [0, 1], [0, 2], [1, 2]],
    gridCol: 8,
    bg: 'var(--fg)',
    border: 'var(--fg)',
  },
  {
    id: 's-piece',
    // S-shape: ░██
    //          ██░
    cells: [[1, 0], [2, 0], [0, 1], [1, 1]],
    gridCol: 0,
    bg: 'rgba(91, 91, 255, 0.35)',
    border: 'rgba(91, 91, 255, 0.55)',
  },
];

export function TetrisAnimation() {
  const gridW = COLS * CELL;
  const gridH = ROWS * CELL;

  return (
    <div className="relative inline-block select-none">
      {/* Blueprint label */}
      <div
        className="font-mono text-[10px] tracking-wider mb-2 uppercase"
        style={{ color: 'var(--fg-subtle, rgba(0,0,0,0.4))' }}
      >
        STRUCT_SIM_01
      </div>

      {/* Main grid */}
      <div
        className="relative overflow-hidden"
        style={{
          width: gridW,
          height: gridH,
          background: 'var(--bg, #FBFBF8)',
          border: '1px solid var(--fg, #000)',
        }}
      >
        {/* Internal grid lines */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: [
              'linear-gradient(rgba(0,0,0,0.05) 1px, transparent 1px)',
              'linear-gradient(90deg, rgba(0,0,0,0.05) 1px, transparent 1px)',
            ].join(', '),
            backgroundSize: `${CELL}px ${CELL}px`,
          }}
        />

        {/* Foundation blocks */}
        {FOUNDATION.map(({ col, row }) => (
          <div
            key={`f-${col}-${row}`}
            className="absolute"
            style={{
              width: CELL - 1,
              height: CELL - 1,
              left: col * CELL,
              bottom: row * CELL,
              background: 'var(--fg, #000)',
              borderRight: '1px solid var(--bg, #FBFBF8)',
              borderBottom: '1px solid var(--bg, #FBFBF8)',
            }}
          />
        ))}

        {/* Falling pieces */}
        {FALLING_PIECES.map((piece, pieceIdx) => (
          <div
            key={piece.id}
            className="absolute"
            style={{
              left: piece.gridCol * CELL,
              animationName: `tetrisFall${pieceIdx + 1}`,
              animationDuration: ['7s', '9s', '6s'][pieceIdx],
              animationDelay: ['0s', '2.5s', '5s'][pieceIdx],
              animationTimingFunction: 'linear',
              animationIterationCount: 'infinite',
              animationFillMode: 'both',
            }}
          >
            {piece.cells.map(([c, r], cellIdx) => (
              <div
                key={cellIdx}
                className="absolute"
                style={{
                  width: CELL - 1,
                  height: CELL - 1,
                  left: c * CELL,
                  top: r * CELL,
                  background: piece.bg,
                  border: `1px solid ${piece.border}`,
                }}
              />
            ))}
          </div>
        ))}

        {/* Crosshair corner markers */}
        <div className="absolute top-1 left-1 w-3 h-3 border-l border-t pointer-events-none" style={{ borderColor: 'var(--accent, #5B5BFF)' }} />
        <div className="absolute top-1 right-1 w-3 h-3 border-r border-t pointer-events-none" style={{ borderColor: 'var(--accent, #5B5BFF)' }} />
        <div className="absolute bottom-1 left-1 w-3 h-3 border-l border-b pointer-events-none" style={{ borderColor: 'var(--accent, #5B5BFF)' }} />
        <div className="absolute bottom-1 right-1 w-3 h-3 border-r border-b pointer-events-none" style={{ borderColor: 'var(--accent, #5B5BFF)' }} />
      </div>

      {/* Coordinate markers */}
      <div className="flex justify-between mt-1">
        <span className="font-mono text-[8px]" style={{ color: 'var(--fg-subtle, rgba(0,0,0,0.4))' }}>
          0x00
        </span>
        <span className="font-mono text-[8px]" style={{ color: 'var(--fg-subtle, rgba(0,0,0,0.4))' }}>
          COL_09
        </span>
      </div>
    </div>
  );
}
