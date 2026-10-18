export const layout = {
  appBarHeight: 64,
  sidebarWidth: 320,
  /** /doc columns on md+, as fr ratios: hierarchy 30% · content 50% · comments 20%. */
  docColumns: { hierarchy: 3, content: 5, comments: 2 },
  /** /graph columns on md+, same ratios: sidebar 30% · canvas 50% · details 20%. */
  graphColumns: { sidebar: 3, canvas: 5, details: 2 },
  /** /doc and /graph panes: gap/padding (spacing units), corner radius (× shape.borderRadius 4 = 8px), shadow. */
  docPane: { gap: { xs: 1.5, md: 2 }, radius: 2, elevation: 2 },
} as const;

/** Logo rules — guideline §2.3 / §2.4. */
export const logoRules = {
  /** Online minimum height (§2.3). */
  minHeightPx: 36,
  /** Preferred AppBar height on desktop. */
  appBarHeightPx: 64,
  /** Clear space around the logo, in theme spacing units (≈ the "F" height at 64px, §2.4). */
  clearSpace: 1.5,
} as const;
