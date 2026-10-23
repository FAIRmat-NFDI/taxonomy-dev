import { CommentsPanel, DocLayout, EntityPanel, HierarchyPanel } from '@/components/doc';

/**
 * /doc — hierarchy | entity | issues. The ontology itself is loaded once in AppLayout.
 * With no node selected the issues pane lists every open issue about the file (as on /graph).
 */
export default function DocPage() {
  return (
    <DocLayout
      hierarchy={<HierarchyPanel />}
      content={<EntityPanel />}
      comments={(onCollapse) => <CommentsPanel onCollapse={onCollapse} showAllWhenNoSelection />}
    />
  );
}
