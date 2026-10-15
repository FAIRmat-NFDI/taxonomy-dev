import type { EdgeRelation, GraphNodeKind } from '@/api';
import { entityColors, fairmatColors, nomadColors, nomadGuiTints } from '@/theme';

/**
 * One visual per OWL 2 construct: every node kind has its own shape + colour, every link kind
 * its own colour + line style + arrow. All restrictions share one colour (line style tells
 * some / only / value / cardinality apart). Colours come from the official palettes.
 */
export type NodeShape =
  | 'ellipse'
  | 'diamond'
  | 'round-diamond'
  | 'tag'
  | 'round-triangle'
  | 'hexagon'
  | 'round-hexagon'
  | 'round-rectangle'
  | 'barrel'
  | 'round-octagon'
  | 'vee';

export interface NodeStyle {
  label: string;
  color: string;
  shape: NodeShape;
  /** Fill opacity (lighter = anonymous). */
  opacity?: number;
}

export interface EdgeStyle {
  label: string;
  color: string;
  line: 'solid' | 'dashed' | 'dotted';
  arrow: 'triangle' | 'vee' | 'square' | 'circle' | 'tee' | 'none';
  /** Hollow arrow head (UML-style generalisation). */
  hollow?: boolean;
  /** Arrow at both ends (symmetric relations). */
  both?: boolean;
  width?: number;
}

const RESTRICTION = fairmatColors.areaF;

export const NODE_STYLES: Record<GraphNodeKind, NodeStyle> = {
  class: { label: 'Class', color: entityColors.class, shape: 'ellipse' },
  objectProperty: { label: 'Object property', color: nomadColors.primary, shape: 'diamond' },
  datatypeProperty: { label: 'Data property', color: nomadColors.oasis, shape: 'round-diamond' },
  annotationProperty: { label: 'Annotation property', color: nomadColors.camels, shape: 'tag' },
  individual: { label: 'Individual', color: fairmatColors.areaE, shape: 'round-triangle' },
  datatype: { label: 'Datatype', color: fairmatColors.areaC, shape: 'hexagon' },
  restriction: { label: 'Restriction', color: RESTRICTION, shape: 'round-rectangle' },
  booleanExpression: { label: 'Class expression (and / or / not)', color: '#78909C', shape: 'barrel' },
  enumeration: { label: 'Enumeration (one of)', color: '#90A4AE', shape: 'round-octagon' },
  dataRange: { label: 'Data range', color: nomadGuiTints.oasisLight, shape: 'round-hexagon' },
  inverseProperty: { label: 'Inverse property', color: nomadGuiTints.primaryLight, shape: 'vee' },
  anonymousIndividual: { label: 'Anonymous individual', color: fairmatColors.areaE, shape: 'round-triangle', opacity: 0.4 },
  expression: { label: 'Other expression', color: '#BDBDBD', shape: 'round-rectangle' },
};

export const EDGE_STYLES: Record<EdgeRelation, EdgeStyle> = {
  subClassOf: { label: 'Sub class of', color: '#424242', line: 'solid', arrow: 'triangle', hollow: true, width: 1.6 },
  subPropertyOf: { label: 'Sub property of', color: '#9E9E9E', line: 'solid', arrow: 'triangle', hollow: true },
  type: { label: 'Instance of', color: fairmatColors.areaE, line: 'solid', arrow: 'vee' },
  equivalent: { label: 'Equivalent to', color: fairmatColors.areaB, line: 'solid', arrow: 'none', width: 2.4 },
  disjoint: { label: 'Disjoint with', color: fairmatColors.areaG, line: 'dashed', arrow: 'tee', both: true },
  inverse: { label: 'Inverse of', color: fairmatColors.areaC, line: 'solid', arrow: 'triangle', both: true },
  sameAs: { label: 'Same individual', color: nomadGuiTints.oasisLight, line: 'dashed', arrow: 'none' },
  differentFrom: { label: 'Different individuals', color: fairmatColors.areaG, line: 'dotted', arrow: 'tee', both: true },
  domain: { label: 'Domain', color: nomadGuiTints.oasisDark, line: 'solid', arrow: 'circle' },
  range: { label: 'Range', color: nomadColors.oasis, line: 'solid', arrow: 'triangle' },
  some: { label: 'Restriction · some', color: RESTRICTION, line: 'solid', arrow: 'triangle' },
  only: { label: 'Restriction · only', color: RESTRICTION, line: 'dashed', arrow: 'triangle' },
  value: { label: 'Restriction · value', color: RESTRICTION, line: 'dotted', arrow: 'triangle' },
  cardinality: { label: 'Restriction · cardinality', color: RESTRICTION, line: 'solid', arrow: 'square' },
  assertion: { label: 'Property assertion', color: nomadColors.camels, line: 'solid', arrow: 'triangle' },
  annotation: { label: 'Annotation', color: '#BDBDBD', line: 'dotted', arrow: 'triangle' },
  operand: { label: 'Expression operand', color: '#B0BEC5', line: 'dotted', arrow: 'vee' },
  other: { label: 'Other', color: '#E0E0E0', line: 'solid', arrow: 'triangle' },
};
