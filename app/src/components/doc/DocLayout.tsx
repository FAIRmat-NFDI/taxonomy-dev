import { useState, type ReactNode } from 'react';
import { Box, IconButton, Paper, Stack, Tooltip, useMediaQuery, useTheme } from '@mui/material';
import { styled } from '@mui/material/styles';
import { Group, Panel, Separator, useDefaultLayout, usePanelCallbackRef, type LayoutStorage } from 'react-resizable-panels';
import { PaneExpandIcon } from '@/assets';
import { layout } from '@/theme';

interface DocLayoutProps {
  /** Column 1: ontology hierarchy. Desktop only; on smaller screens it lives in the nav drawer. */
  hierarchy: ReactNode;
  /** Column 2: selected node. */
  content: ReactNode;
  /** Column 3: issues / comments. Gets a collapse callback on desktop. Below the content on smaller screens. */
  comments: (onCollapse?: () => void) => ReactNode;
}

const { hierarchy: h, content: c, comments: m } = layout.docColumns;
const { gap, radius, elevation } = layout.docPane;
const total = h + c + m;
const percent = (part: number) => `${Math.round((part / total) * 100)}%`;
const COLLAPSED_PX = 56;

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

/** Drag handle between panes: the gap itself; a primary-coloured line shows on hover, drag and focus. */
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

/** A pane card: header stays, body scrolls (see PanelBody). Column 1 is a flush sidebar; the others are open at the bottom. */
function Pane({ label, component, sidebar = false, children }: { label: string; component: 'nav' | 'article' | 'aside'; sidebar?: boolean; children: ReactNode }) {
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
        overflow: 'hidden',
        borderRadius: sidebar ? 0 : { xs: radius, md: `${radius * 4}px ${radius * 4}px 0 0` },
      }}
    >
      {children}
    </Paper>
  );
}

/**
 * /doc three-pane layout.
 *  - md+ : flush hierarchy sidebar | content card | comments card, 30 / 50 / 20 by default.
 *          Widths are draggable (react-resizable-panels; keyboard accessible) and remembered;
 *          the comments pane collapses to a rail.
 *  - <md : content, then comments, as stacked cards; the hierarchy moves to the nav drawer.
 */
export function DocLayout({ hierarchy, content, comments }: DocLayoutProps) {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'), { noSsr: true });
  const [commentsPanel, setCommentsPanel] = usePanelCallbackRef();
  const [commentsCollapsed, setCommentsCollapsed] = useState(false);
  const collapseComments = () => commentsPanel?.collapse();
  const expandComments = () => commentsPanel?.expand();
  const saved = useDefaultLayout({ id: 'fairtaxonomy-doc-layout', storage: layoutStorage, panelIds: ['hierarchy', 'content', 'comments'] });

  if (!isDesktop) {
    return (
      <Stack spacing={gap.xs} sx={{ p: gap.xs }}>
        <Pane component="article" label="Entity">
          {content}
        </Pane>
        <Pane component="aside" label="Issues">
          {comments()}
        </Pane>
      </Stack>
    );
  }

  return (
    <Group orientation="horizontal" defaultLayout={saved.defaultLayout} onLayoutChanged={saved.onLayoutChanged} style={{ height: '100%' }}>
      <Panel id="hierarchy" defaultSize={percent(h)} minSize="15%">
        <Pane component="nav" label="Ontology hierarchy" sidebar>
          {hierarchy}
        </Pane>
      </Panel>
      <ResizeHandle />
      <Panel id="content" defaultSize={percent(c)} minSize="25%">
        <Box sx={{ height: '100%', pt: gap.md }}>
          <Pane component="article" label="Entity">
            {content}
          </Pane>
        </Box>
      </Panel>
      <ResizeHandle />
      <Panel
        id="comments"
        panelRef={setCommentsPanel}
        defaultSize={percent(m)}
        minSize="12%"
        collapsible
        collapsedSize={`${COLLAPSED_PX}px`}
        onResize={() => setCommentsCollapsed(commentsPanel?.isCollapsed() ?? false)}
      >
        <Box sx={{ height: '100%', pt: gap.md, pr: gap.md }}>
          {commentsCollapsed ? (
            <Paper variant="elevation" elevation={elevation} sx={{ height: '100%', p: 0.5, borderRadius: `${radius * 4}px ${radius * 4}px 0 0` }}>
              <Tooltip title="Show issues" placement="left">
                <IconButton aria-label="Show issues" onClick={expandComments}>
                  <PaneExpandIcon />
                </IconButton>
              </Tooltip>
            </Paper>
          ) : (
            <Pane component="aside" label="Issues">
              {comments(collapseComments)}
            </Pane>
          )}
        </Box>
      </Panel>
    </Group>
  );
}
