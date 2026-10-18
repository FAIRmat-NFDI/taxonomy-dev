import type { Components, Theme } from '@mui/material/styles';
import { MuiAppBar } from './appBar';
import { MuiButton } from './button';
import { MuiPaper, MuiTableRow, MuiTooltip } from './surfaces';
import { MuiTypography } from './typography';

/** One file per component family; register new overrides here. */
export const components: Components<Theme> = {
  MuiAppBar,
  MuiButton,
  MuiPaper,
  MuiTableRow,
  MuiTooltip,
  MuiTypography,
};
