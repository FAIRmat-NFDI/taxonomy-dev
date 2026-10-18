import './fonts';
import { createAppTheme } from './createAppTheme';

/** Default application theme. */
export const theme = createAppTheme();

export { createAppTheme, type AppThemeOptions } from './createAppTheme';
export * from './tokens';
