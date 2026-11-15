import { ALL_SQUARES, squareToXY, xyToSquare } from './geometry';

describe('board geometry', () => {
  it('maps squares to pixels for white orientation', () => {
    expect(squareToXY('a8', 'w', 10)).toEqual({ x: 0, y: 0 });
    expect(squareToXY('h1', 'w', 10)).toEqual({ x: 70, y: 70 });
    expect(squareToXY('e4', 'w', 10)).toEqual({ x: 40, y: 40 });
  });

  it('flips for black orientation', () => {
    expect(squareToXY('h1', 'b', 10)).toEqual({ x: 0, y: 0 });
    expect(squareToXY('a8', 'b', 10)).toEqual({ x: 70, y: 70 });
  });

  it('round-trips every square in both orientations', () => {
    for (const o of ['w', 'b'] as const) {
      for (const sq of ALL_SQUARES) {
        const { x, y } = squareToXY(sq, o, 45);
        expect(xyToSquare(x + 22, y + 22, o, 45)).toBe(sq);
      }
    }
  });

  it('returns null outside the board', () => {
    expect(xyToSquare(-1, 10, 'w', 10)).toBeNull();
    expect(xyToSquare(10, 80, 'w', 10)).toBeNull();
    expect(xyToSquare(5, 5, 'w', 0)).toBeNull();
  });

  it('lists 64 unique squares', () => {
    expect(new Set(ALL_SQUARES).size).toBe(64);
    expect(ALL_SQUARES[0]).toBe('a8');
    expect(ALL_SQUARES[63]).toBe('h1');
  });
});
