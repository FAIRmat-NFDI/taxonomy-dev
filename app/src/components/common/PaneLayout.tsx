import { useState, type ReactNode } from 'react';
import { Box, IconButton, Paper, Stack, Tooltip, useMediaQuery, useTheme } from '@mui/material';
import { styled } from '@mui/material/styles';
import { Group, Panel, Separator, useDefaultLayout, usePanelCallbackRef, type LayoutStorage } from 'react-resizable-panels';
import { PaneExpandIcon } from '@/assets';
import { layout } from '@/theme';

/** One block of the right column (several are stacked with a gap). */
export interface AsideBlock {
  /** Accessible name of the block. */
  label: string;
  /** Gets a collapse callback on desktop (only the first block — put the button in its header). */
  content: (onCollapse?: () => void) => ReactNode;
}

interface PaneLayoutProps {
  /** Remembers the column widths under this key. */
  id: string;
  /** Column ratios (fr), e.g. 3 / 5 / 2. */
  columns: { sidebar: number; main: number; aside: number };
  /** Column 1: flush sidebar. Desktop only; on smaller screens it lives in the nav drawer. */
  sidebar: { label: string; content: ReactNode };
  /** Column 2. */
  main: { label: string; content: ReactNode };
  /** Column 3: one or more blocks, stacked. Collapsible to a rail on desktop; below the main pane on smaller screens. */
  aside: { blocks: AsideBlock[]; expandLabel: string };
}

const { gap, radius, elevation } = layout.docPane;
const COLLAPSED_PX = 56;
const PANEL_IDS = ['sidebar', 'main', 'aside'];

/** Saved pane widths; storage can be unavailable (private mode), so failures are ignored. */
const layoutStorage: LayoutStorage = {
  getItem: (k) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  setItem: (k, v) => {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* ignore */
    }
  },
};

/** Drag handle between columns: the gap itself; a primary-coloured line shows on hover, drag and focus. */
const ResizeHandle = styled(Separator)(({ theme }) => ({
  width: theme.spacing(gap.md),
  position: 'relative',
  outline: 'none',
  '&::after': {
    content: '""',
    position: 'absolute',
    insetBlock: 0,
    left: '50%',
    width: 2,
    transform: 'translateX(-50%)',
    transition: theme.transitions.create('background-color'),
  },
  '&[data-separator="hover"]::after, &[data-separator="active"]::after, &[data-separator="focus"]::after': {
    backgroundColor: (theme.vars ?? theme).palette.primary.main,
  },
}));

/** Drag handle between stacked blocks of the aside: the same, turned horizontal. */
const StackResizeHandle = styled(Separator)(({ theme }) => ({
  height: theme.spacing(gap.md),
  position: 'relative',
  outline: 'none',
  '&::after': {
    content: '""',
    position: 'absolute',
    insetInline: 0,
    top: '50%',
    height: 2,
    transform: 'translateY(-50%)',
    transition: theme.transitions.create('background-color'),
  },
  '&[data-separator="hover"]::after, &[data-separator="active"]::after, &[data-separator="focus"]::after': {
    backgroundColor: (theme.vars ?? theme).palette.primary.main,
  },
}));

type PaneShape = 'sidebar' | 'card' | 'bottom';

/**
 * A pane card: header stays, body scrolls (see PanelBody).
 * `sidebar` = flush (no radius); `bottom` = open at the bottom edge of the page; `card` = rounded all round.
 */
export function Pane({ label, component, shape = 'bottom', children }: { label: string; component: 'nav' | 'article' | 'aside' | 'section'; shape?: PaneShape; children: ReactNode }) {
  const corners = { sidebar: 0, card: `${radius * 4}px`, bottom: `${radius * 4}px ${radius * 4}px 0 0` }[shape];
  return (
    <Paper
      component={component}
      aria-label={label}
      variant="elevation"
      elevation={elevation}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minWidth: 0,
        minHeight: 0,
        overflow: 'hidden',
        borderRadius: shape === 'sidebar' ? 0 : { xs: radius, md: corners },
      }}
    >
      {children}
    </Paper>
  );
}

/**
 * Three-column page layout shared by /doc and /graph.
 *  - md+ : flush sidebar | main card | aside card(s), resizable (react-resizable-panels; keyboard accessible),
 *          widths remembered per page; the aside collapses to a rail. Stacked aside blocks resize vertically.
 *  - <md : main, then each aside block, as stacked cards; the sidebar moves to the nav drawer.
 */
export function PaneLayout({ id, columns, sidebar, main, aside }: PaneLayoutProps) {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'), { noSsr: true });
  const [asidePanel, setAsidePanel] = usePanelCallbackRef();
  const [asideCollapsed, setAsideCollapsed] = useState(false);
  const collapseAside = () => asidePanel?.collapse();
  const expandAside = () => asidePanel?.expand();
  const saved = useDefaultLayout({ id, storage: layoutStorage, panelIds: PANEL_IDS });
  const blockIds = aside.blocks.map((_, i) => `block-${i}`);
  const savedBlocks = useDefaultLayout({ id: `${id}-aside`, storage: layoutStorage, panelIds: blockIds });

  const total = columns.sidebar + columns.main + columns.aside;
  const percent = (part: number) => `${Math.round((part / total) * 100)}%`;
  const blocks = aside.blocks;

  if (!isDesktop) {
    return (
      <Stack spacing={gap.xs} sx={{ p: gap.xs }}>
        <Pane component="article" label={main.label}>
          {main.content}
        </Pane>
        {blocks.map((block) => (
          <Pane key={block.label} component="aside" label={block.label}>
            {block.content()}
          </Pane>
        ))}
      </Stack>
    );
  }

  return (
    <Group orientation="horizontal" defaultLayout={saved.defaultLayout} onLayoutChanged={saved.onLayoutChanged} style={{ height: '100%' }}>
      <Panel id="sidebar" defaultSize={percent(columns.sidebar)} minSize="15%">
        <Pane component="nav" label={sidebar.label} shape="sidebar">
          {sidebar.content}
        </Pane>
      </Panel>
      <ResizeHandle />
      <Panel id="main" defaultSize={percent(columns.main)} minSize="25%">
        <Box sx={{ height: '100%', pt: gap.md }}>
          <Pane component="article" label={main.label}>
            {main.content}
          </Pane>
        </Box>
      </Panel>
      <ResizeHandle />
      <Panel
        id="aside"
        panelRef={setAsidePanel}
        defaultSize={percent(columns.aside)}
        minSize="12%"
        collapsible
        collapsedSize={`${COLLAPSED_PX}px`}
        onResize={() => setAsideCollapsed(asidePanel?.isCollapsed() ?? false)}
      >
        <Box sx={{ height: '100%', pt: gap.md, pr: gap.md }}>
          {asideCollapsed ? (
            <Paper variant="elevation" elevation={elevation} sx={{ height: '100%', p: 0.5, borderRadius: `${radius * 4}px ${radius * 4}px 0 0` }}>
              <Tooltip title={aside.expandLabel} placement="left">
                <IconButton aria-label={aside.expandLabel} onClick={expandAside}>
                  <PaneExpandIcon />
                </IconButton>
              </Tooltip>
            </Paper>
          ) : (
            // Stacked blocks share the height; the gaps between them are drag handles (heights remembered).
            <Group orientation="vertical" defaultLayout={savedBlocks.defaultLayout} onLayoutChanged={savedBlocks.onLayoutChanged} style={{ height: '100%' }}>
              {blocks.flatMap((block, i) => [
                ...(i > 0 ? [<StackResizeHandle key={`handle-${i}`} />] : []),
                <Panel key={block.label} id={blockIds[i]} defaultSize={`${Math.round(100 / blocks.length)}%`} minSize="15%">
                  <Pane component="aside" label={block.label} shape={i === blocks.length - 1 ? 'bottom' : 'card'}>
                    {block.content(i === 0 ? collapseAside : undefined)}
                  </Pane>
                </Panel>,
              ])}
            </Group>
          )}
        </Box>
      </Panel>
    </Group>
  );
}
