import { PaneLayout } from '@/components/common/PaneLayout';
import { layout } from '@/theme';
import { GraphCanvasPanel, GraphDetailsPanel, GraphInfoPanel, GraphSidebarPanel } from './GraphPanels';

const { sidebar, canvas, details } = layout.graphColumns;

/**
 * /graph: sidebar | graph | two stacked blocks — same ratios, cards and behaviour as /doc (see PaneLayout).
 * Small screens: graph, then the two blocks; the sidebar moves to the nav drawer.
 */
export function GraphLayout() {
  return (
    <PaneLayout
      id="fairtaxonomy-graph-layout"
      columns={{ sidebar, main: canvas, aside: details }}
      sidebar={{ label: 'Graph sidebar', content: <GraphSidebarPanel /> }}
      main={{ label: 'Graph', content: <GraphCanvasPanel /> }}
      aside={{
        blocks: [
          { label: 'Graph details', content: (onCollapse) => <GraphDetailsPanel onCollapse={onCollapse} /> },
          { label: 'Issues', content: () => <GraphInfoPanel /> },
        ],
        expandLabel: 'Show panel',
      }}
    />
  );
}
