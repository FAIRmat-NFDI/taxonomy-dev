export const paths = {
  doc: '/doc',
  graph: '/graph',
} as const;

/** Page panels that move into the nav drawer on small screens (see components/layout/sidebarPanels). */
export type SidebarPanel = 'hierarchy';

/**
 * Per-route header data, read by the AppBar via `useMatches()`.
 * `title` = big heading; `switchTo` = the view the swap button jumps to;
 * `sidebar` = panel shown at the top of the mobile nav drawer.
 */
export interface RouteHandle {
  title: string;
  switchTo?: { label: string; to: string };
  sidebar?: SidebarPanel;
}

export const routeHandles = {
  doc: { title: 'FAIRTaxonomy', switchTo: { label: 'Graph', to: paths.graph }, sidebar: 'hierarchy' },
  graph: { title: 'FAIRTaxonomy', switchTo: { label: 'Doc', to: paths.doc } },
} satisfies Record<string, RouteHandle>;
