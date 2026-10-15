import { GraphViewIcon } from '@/assets';
import { EmptyState, PageContainer } from '@/components/common';

export default function GraphPage() {
  return (
    <PageContainer title="Graph View">
      <EmptyState
        icon={<GraphViewIcon />}
        title="Graphical view"
        description="Interactive class/property graph — planned after Tree View and commenting."
      />
    </PageContainer>
  );
}
