import { forwardRef, useEffect, useState } from 'react';
import { Box, Chip, Typography } from '@mui/material';
import { RichTreeView } from '@mui/x-tree-view/RichTreeView';
import { TreeItem, treeItemClasses, type TreeItemProps } from '@mui/x-tree-view/TreeItem';
import { useRichTreeViewApiRef, useTreeItemModel } from '@mui/x-tree-view/hooks';
import { FolderIcon, TreeCollapsedIcon, TreeExpandedIcon, TreeLeafIcon } from '@/assets';
import { entityColors } from '@/theme';
import type { Overview, OverviewFilter, OverviewItem, OverviewKind } from './overview';

/** Icon colour per kind (official palettes only, see theme/tokens/semantic). */
const KIND_COLOR: Partial<Record<OverviewKind, string>> = {
  class: entityColors.class,
  objectProperty: entityColors.objectProperty,
  datatypeProperty: entityColors.datatypeProperty,
  annotationProperty: entityColors.annotationProperty,
  individual: entityColors.individual,
  datatype: entityColors.datatypeProperty,
};

function OverviewLabel({ item }: { item: OverviewItem }) {
  const Icon = item.children?.length || item.kind === 'group' ? FolderIcon : TreeLeafIcon;
  const external = item.flags?.includes('external');
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
      <Icon fontSize="small" sx={{ color: KIND_COLOR[item.kind] ?? 'text.secondary', flexShrink: 0 }} />
      <Typography
        variant="body2"
        noWrap
        title={item.label}
        color={external ? 'text.secondary' : 'text.primary'}
        sx={{
          flexGrow: 1,
          minWidth: 0,
          fontStyle: external ? 'italic' : undefined,
          textDecoration: item.flags?.includes('deprecated') ? 'line-through' : undefined,
        }}
      >
        {item.label}
      </Typography>
      {item.flags?.includes('cycle') && <Chip label="cycle" size="small" color="warning" variant="outlined" />}
      {item.count !== undefined && (
        <Typography variant="caption" color="text.secondary">
          {item.count}
        </Typography>
      )}
    </Box>
  );
}

/** TreeItem with icon, flags and counts (reads its row from the tree's item model). */
const OverviewTreeItem = forwardRef<HTMLLIElement, TreeItemProps>(function OverviewTreeItem(props, ref) {
  const item = useTreeItemModel<OverviewItem>(props.itemId);
  return <TreeItem {...props} ref={ref} label={item ? <OverviewLabel item={item} /> : props.label} />;
});

interface OverviewTreeProps {
  overview: Overview;
  /** Search result (see filterOverview); null = show everything. */
  filtered?: OverviewFilter | null;
  /** Selected node id (from the URL). */
  selected: string | null;
  onSelect: (target: string) => void;
}

/**
 * MUI X RichTreeView over the overview items. Chevrons expand; clicking a node selects it,
 * clicking a group's label toggles it. With a search text, only matches (and their paths) show. A selection coming from the URL reveals its first occurrence.
 * Remount (key) when the model changes.
 */
export function OverviewTree({ overview, filtered = null, selected, onSelect }: OverviewTreeProps) {
  const [expanded, setExpanded] = useState<string[]>(overview.defaultExpanded);

  // While searching, the tree shows the matches with their paths opened; the normal
  // expansion state is kept and comes back when the search is cleared.
  const [searchExpanded, setSearchExpanded] = useState<string[]>([]);
  const [lastFilter, setLastFilter] = useState(filtered);
  if (filtered !== lastFilter) {
    setLastFilter(filtered);
    setSearchExpanded(filtered?.expanded ?? []);
  }
  const shownExpanded = filtered ? searchExpanded : expanded;
  const setShownExpanded = filtered ? setSearchExpanded : setExpanded;
  const [revealed, setRevealed] = useState<string | null>(null);
  const located = selected ? overview.locate.get(selected) : undefined;

  // Reveal a newly selected node once (adjusting state during render, no effect needed).
  if (selected !== revealed) {
    setRevealed(selected);
    if (located) setExpanded((current) => [...new Set([...current, ...located.ancestors])]);
  }

  // Scroll the selected item into view (e.g. after a deep link or a jump from another panel).
  const apiRef = useRichTreeViewApiRef<OverviewItem>();
  const selectedItemId = located?.itemId;
  useEffect(() => {
    if (!selectedItemId) return;
    const frame = requestAnimationFrame(() => apiRef.current?.getItemDOMElement?.(selectedItemId)?.scrollIntoView({ block: 'nearest' }));
    return () => cancelAnimationFrame(frame);
  }, [apiRef, selectedItemId]);

  const isGroup = (id: string) => !overview.targetOf.has(id);

  return (
    <RichTreeView<OverviewItem, false>
      apiRef={apiRef}
      aria-label="Ontology overview"
      items={filtered?.items ?? overview.items}
      expandedItems={shownExpanded}
      onExpandedItemsChange={(_, ids) => setShownExpanded(ids)}
      selectedItems={located?.itemId ?? null}
      onSelectedItemsChange={(event, id) => {
        // A click on the chevron only expands / collapses; it never selects.
        if ((event?.target as HTMLElement | undefined)?.closest?.(`.${treeItemClasses.iconContainer}`)) return;
        const target = id ? overview.targetOf.get(id) : undefined;
        if (target) onSelect(target);
      }}
      onItemClick={(event, id) => {
        // The chevron toggles by itself (expansionTrigger); only clicks on a group's label toggle here.
        const onChevron = (event.target as HTMLElement).closest(`.${treeItemClasses.iconContainer}`);
        if (isGroup(id) && !onChevron) setShownExpanded((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]));
      }}
      isItemSelectionDisabled={(item) => !item.target}
      expansionTrigger="iconContainer"
      itemChildrenIndentation={12}
      slots={{ item: OverviewTreeItem, expandIcon: TreeCollapsedIcon, collapseIcon: TreeExpandedIcon }}
    />
  );
}
