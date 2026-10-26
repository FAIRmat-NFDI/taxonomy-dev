import { describe, expect, it } from 'vitest';
import { expandedSize, fittedLabel, nodeSize, textBox } from './nodeLabel';

describe('labels inside nodes', () => {
  it('shortens long labels more in narrow shapes', () => {
    const long = 'hasComponentQuantityKind';
    const inClass = fittedLabel('class', long);
    const inProperty = fittedLabel('objectProperty', long);
    const inIndividual = fittedLabel('individual', long);
    expect(inClass.endsWith('…')).toBe(true);
    expect(inProperty.length).toBeLessThan(inClass.length);
    expect(inIndividual.length).toBeLessThanOrEqual(inProperty.length);
    expect(fittedLabel('class', 'Vector')).toBe('Vector');
  });

  it('gives triangles a lower text box and larger nodes', () => {
    expect(nodeSize('individual')).toBeGreaterThan(nodeSize('class'));
    expect(textBox('individual', 46).marginY).toBeGreaterThan(0);
    expect(textBox('individual', 46).maxWidth).toBeLessThan(textBox('class', 46).maxWidth);
  });

  it('grows a selected node more for long labels and narrow shapes', () => {
    expect(expandedSize('class', 'ThermalExpansionCoefficient')).toBeGreaterThan(expandedSize('class', 'Time'));
    expect(expandedSize('individual', 'ThermalExpansionCoefficient')).toBeGreaterThan(expandedSize('class', 'ThermalExpansionCoefficient'));
  });
});
