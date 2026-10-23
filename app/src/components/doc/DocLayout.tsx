import type { ReactNode } from 'react';
import { PaneLayout } from '@/components/common/PaneLayout';
import { layout } from '@/theme';

interface DocLayoutProps {
  /** Column 1: ontology hierarchy. Desktop only; on smaller screens it lives in the nav drawer. */
  hierarchy: ReactNode;
  /** Column 2: selected node. */
  content: ReactNode;
  /** Column 3: issues / comments. Gets a collapse callback on desktop. Below the content on smaller screens. */
  comments: (onCollapse?: () => void) => ReactNode;
}

const { hierarchy, content, comments } = layout.docColumns;

/** /doc: hierarchy | entity | issues, 30 / 50 / 20 by default (see PaneLayout). */
export function DocLayout(props: DocLayoutProps) {
  return (
    <PaneLayout
      id="fairtaxonomy-doc-layout"
      columns={{ sidebar: hierarchy, main: content, aside: comments }}
      sidebar={{ label: 'Ontology hierarchy', content: props.hierarchy }}
      main={{ label: 'Entity', content: props.content }}
      aside={{ blocks: [{ label: 'Issues', content: props.comments }], expandLabel: 'Show issues', railTitle: 'Issues' }}
    />
  );
}
