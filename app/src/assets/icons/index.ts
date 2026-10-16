/**
 * Icon registry — the ONLY place components get icons from.
 * Each icon is named by ROLE (what it means in the UI), not by shape, so a
 * designer can replace any .svg file here without touching components.
 */
import BranchSvg from './branch.svg?react';
import CheckSvg from './check.svg?react';
import ChevronDownSvg from './chevron-down.svg?react';
import ChevronLeftSvg from './chevron-left.svg?react';
import ChevronRightSvg from './chevron-right.svg?react';
import CloseSvg from './close.svg?react';
import CopySvg from './copy.svg?react';
import DropdownSvg from './dropdown.svg?react';
import EmailSvg from './email.svg?react';
import ExternalLinkSvg from './external-link.svg?react';
import FitViewSvg from './fit-view.svg?react';
import FolderSvg from './folder.svg?react';
import FormulaSvg from './formula.svg?react';
import FullscreenSvg from './fullscreen.svg?react';
import GitHubSvg from './github.svg?react';
import GraphViewSvg from './graph-view.svg?react';
import InstitutionSvg from './institution.svg?react';
import LogoutSvg from './logout.svg?react';
import MenuSvg from './menu.svg?react';
import SearchSvg from './search.svg?react';
import SourceViewSvg from './source-view.svg?react';
import TreeLeafSvg from './tree-leaf.svg?react';
import TreeViewSvg from './tree-view.svg?react';
import ZoomInSvg from './zoom-in.svg?react';
import ZoomOutSvg from './zoom-out.svg?react';
import FormatHeadingSvg from './format-heading.svg?react';
import FormatBoldSvg from './format-bold.svg?react';
import FormatItalicSvg from './format-italic.svg?react';
import FormatQuoteSvg from './format-quote.svg?react';
import FormatLinkSvg from './format-link.svg?react';
import FormatBulletedSvg from './format-bulleted.svg?react';
import FormatNumberedSvg from './format-numbered.svg?react';
import FormatTasksSvg from './format-tasks.svg?react';
import IssueAddSvg from './issue-add.svg?react';
import IssueClosedSvg from './issue-closed.svg?react';
import { createAssetIcon } from './createAssetIcon';

export const BranchIcon = createAssetIcon(BranchSvg, 'BranchIcon');
export const CheckIcon = createAssetIcon(CheckSvg, 'CheckIcon');
export const CloseIcon = createAssetIcon(CloseSvg, 'CloseIcon');
export const CopyIcon = createAssetIcon(CopySvg, 'CopyIcon');
export const DropdownIcon = createAssetIcon(DropdownSvg, 'DropdownIcon');
export const EmailIcon = createAssetIcon(EmailSvg, 'EmailIcon');
export const ExternalLinkIcon = createAssetIcon(ExternalLinkSvg, 'ExternalLinkIcon');
/** Fit a graph / canvas to its view. */
export const FitViewIcon = createAssetIcon(FitViewSvg, 'FitViewIcon');
/** Toggle formal (Description Logic) notation. */
export const FormulaIcon = createAssetIcon(FormulaSvg, 'FormulaIcon');
export const FolderIcon = createAssetIcon(FolderSvg, 'FolderIcon');
/** Open a view in a large dialog. */
export const FullscreenIcon = createAssetIcon(FullscreenSvg, 'FullscreenIcon');
export const GitHubIcon = createAssetIcon(GitHubSvg, 'GitHubIcon');
export const GraphViewIcon = createAssetIcon(GraphViewSvg, 'GraphViewIcon');
export const InstitutionIcon = createAssetIcon(InstitutionSvg, 'InstitutionIcon');
export const LogoutIcon = createAssetIcon(LogoutSvg, 'LogoutIcon');
export const MenuIcon = createAssetIcon(MenuSvg, 'MenuIcon');
/** Hide a side pane. */
export const PaneCollapseIcon = createAssetIcon(ChevronRightSvg, 'PaneCollapseIcon');
/** Show a hidden side pane. */
export const PaneExpandIcon = createAssetIcon(ChevronLeftSvg, 'PaneExpandIcon');
export const SearchIcon = createAssetIcon(SearchSvg, 'SearchIcon');
/** Toggle the Turtle source of an entity. */
export const SourceViewIcon = createAssetIcon(SourceViewSvg, 'SourceViewIcon');
/** Tree node: expanded / collapsed. */
export const TreeExpandedIcon = createAssetIcon(ChevronDownSvg, 'TreeExpandedIcon');
export const TreeCollapsedIcon = createAssetIcon(ChevronRightSvg, 'TreeCollapsedIcon');
/** Tree node without children. */
export const TreeLeafIcon = createAssetIcon(TreeLeafSvg, 'TreeLeafIcon');
export const TreeViewIcon = createAssetIcon(TreeViewSvg, 'TreeViewIcon');
export const ZoomInIcon = createAssetIcon(ZoomInSvg, 'ZoomInIcon');
export const ZoomOutIcon = createAssetIcon(ZoomOutSvg, 'ZoomOutIcon');
/** Markdown editor toolbar. */
export const FormatHeadingIcon = createAssetIcon(FormatHeadingSvg, 'FormatHeadingIcon');
export const FormatBoldIcon = createAssetIcon(FormatBoldSvg, 'FormatBoldIcon');
export const FormatItalicIcon = createAssetIcon(FormatItalicSvg, 'FormatItalicIcon');
export const FormatQuoteIcon = createAssetIcon(FormatQuoteSvg, 'FormatQuoteIcon');
export const FormatLinkIcon = createAssetIcon(FormatLinkSvg, 'FormatLinkIcon');
export const FormatBulletedIcon = createAssetIcon(FormatBulletedSvg, 'FormatBulletedIcon');
export const FormatNumberedIcon = createAssetIcon(FormatNumberedSvg, 'FormatNumberedIcon');
export const FormatTasksIcon = createAssetIcon(FormatTasksSvg, 'FormatTasksIcon');
/** Create a new issue. */
export const IssueAddIcon = createAssetIcon(IssueAddSvg, 'IssueAddIcon');
/** Close an issue (closed state). */
export const IssueClosedIcon = createAssetIcon(IssueClosedSvg, 'IssueClosedIcon');
/** Show / hide more (rotated 180° when open). */
export const ExpandMoreIcon = createAssetIcon(ChevronDownSvg, 'ExpandMoreIcon');
