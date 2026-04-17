// A single cell position on the grid
export type Position = {
  x: number;
  y: number;
};

// A single snake segment
export type Segment = Position;

// The complete snake body (array of segments, index 0 = head)
export type Snake = Segment[];
