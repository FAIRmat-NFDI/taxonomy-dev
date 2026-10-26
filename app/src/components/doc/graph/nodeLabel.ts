import type { GraphNodeKind } from '@/api';
import { NODE_STYLES, type NodeShape } from './graphStyle';

/**
 * Fitting a label inside a node shape. Each shape has a usable text box: a share of the node size
 * (narrow for triangles and diamonds), a vertical offset (a triangle's room is in its lower half) and
 * a number of lines. Labels that do not fit are shortened; a selected node grows until the full label fits.
 */
interface TextBox {
  /** Usable width as a share of the node size. */
  width: number;
  /** Vertical offset of the text, as a share of the node size (+ = down). */
  dy: number;
  /** Lines that fit at the normal size. */
  lines: number;
}

const BOX: Record<NodeShape, TextBox> = {
  ellipse: { width: 0.72, dy: 0, lines: 3 },
  'round-octagon': { width: 0.72, dy: 0, lines: 3 },
  hexagon: { width: 0.68, dy: 0, lines: 3 },
  'round-hexagon': { width: 0.68, dy: 0, lines: 3 },
  'round-rectangle': { width: 0.82, dy: 0, lines: 2 },
  barrel: { width: 0.78, dy: 0, lines: 2 },
  tag: { width: 0.62, dy: 0, lines: 2 },
  diamond: { width: 0.54, dy: 0, lines: 2 },
  'round-diamond': { width: 0.54, dy: 0, lines: 2 },
  'round-triangle': { width: 0.5, dy: 0.16, lines: 2 },
  vee: { width: 0.44, dy: -0.18, lines: 2 },
};

/** Node sizes (px): narrow shapes are drawn a little larger so their text box is usable. */
const BASE_SIZE = 38;
const NARROW_SIZE = 46;
const EXPRESSION_SIZE = 30;
const NARROW: ReadonlySet<NodeShape> = new Set(['diamond', 'round-diamond', 'round-triangle', 'vee']);
const EXPRESSION_KINDS: ReadonlySet<GraphNodeKind> = new Set(['restriction', 'booleanExpression', 'enumeration', 'dataRange', 'inverseProperty', 'expression']);

/** Font sizes (px) and the average width of one bold character, relative to the font size. */
export const LABEL_FONT = 7;
export const SELECTED_FONT = 10;
const CHAR_WIDTH = 0.6;
const LINE_HEIGHT = 1.15;

const boxOf = (kind: GraphNodeKind) => BOX[NODE_STYLES[kind].shape];

export function nodeSize(kind: GraphNodeKind): number {
  if (EXPRESSION_KINDS.has(kind)) return EXPRESSION_SIZE;
  return NARROW.has(NODE_STYLES[kind].shape) ? NARROW_SIZE : BASE_SIZE;
}

/** Text box (width, offset) for a node of this kind at size `size`. */
export function textBox(kind: GraphNodeKind, size: number) {
  const box = boxOf(kind);
  return { maxWidth: Math.floor(size * box.width), marginY: Math.round(size * box.dy) };
}

/** The label as it fits in the small node: whole if it fits, else shortened with "…". */
export function fittedLabel(kind: GraphNodeKind, label: string): string {
  const size = nodeSize(kind);
  const font = EXPRESSION_KINDS.has(kind) ? LABEL_FONT - 1 : LABEL_FONT;
  const perLine = Math.max(3, Math.floor((size * boxOf(kind).width) / (font * CHAR_WIDTH)));
  const capacity = perLine * boxOf(kind).lines;
  return label.length <= capacity ? label : `${label.slice(0, capacity - 1)}…`;
}

/** Size a selected node grows to so its whole label fits (wrapped) inside its shape. */
export function expandedSize(kind: GraphNodeKind, label: string): number {
  const box = boxOf(kind);
  const char = SELECTED_FONT * CHAR_WIDTH;
  const line = SELECTED_FONT * LINE_HEIGHT;
  // Text area ≈ (width·s) × (usable height ≈ width·s): solve for s, with a little slack.
  const s = Math.sqrt((label.length * char * line) / (box.width * box.width)) * 1.2;
  return Math.round(Math.min(170, Math.max(nodeSize(kind) + 12, s)));
}
