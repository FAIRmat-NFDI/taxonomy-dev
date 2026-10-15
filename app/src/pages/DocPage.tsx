import { CommentsPanel, DocLayout, EntityPanel, HierarchyPanel } from '@/components/doc';

/** /doc — hierarchy | entity | issues. The ontology itself is loaded once in AppLayout. */
export default function DocPage() {
  return (
    <DocLayout
      hierarchy={<HierarchyPanel />}
      content={<EntityPanel />}
      comments={(onCollapse) => <CommentsPanel onCollapse={onCollapse} />}
    />
  );
}
