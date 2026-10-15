import type { ReactNode } from 'react';
import { HierarchyPanel } from '@/components/doc';
import type { SidebarPanel } from '@/routes/paths';

/** Route handle `sidebar` key → what the mobile nav drawer shows above the menu links. */
export const sidebarPanels: Record<SidebarPanel, ReactNode> = {
  hierarchy: <HierarchyPanel />,
};
