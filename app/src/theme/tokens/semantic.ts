import { fairmatColors, nomadColors } from './colors';

/**
 * OWL entity-kind colours for Tree and Graph views — chosen only from the
 * official palettes (no ad-hoc colours). Classes use yellow, as in WebProtege.
 */
export const entityColors = {
  class: fairmatColors.areaA,
  objectProperty: nomadColors.primary,
  datatypeProperty: nomadColors.oasis,
  annotationProperty: nomadColors.camels,
  individual: fairmatColors.areaE,
} as const;
