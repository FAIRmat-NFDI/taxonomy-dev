# Assets

All icons and images used by the UI live here. Components import from `@/assets` only.

## Icons (`icons/*.svg`) — monochrome, theme-coloured

To replace an icon, overwrite its file and keep the file name. To add one, drop the `.svg` here and
register it in `icons/index.ts` with `createAssetIcon`.

Each icon renders through MUI `SvgIcon`, so `fontSize`, `color` and `sx` work as with `@mui/icons-material`.
SVG requirements:

- Set a `viewBox` (24×24 recommended), with no fixed `width`/`height`.
- Use `fill="currentColor"` (or `stroke="currentColor"`) and no hard-coded colours, so the icon follows the theme.

| File | Used for |
| --- | --- |
| `branch.svg` | Branch switcher |
| `dropdown.svg` | Menu and dropdown affordance |
| `check.svg` | Selected item |
| `menu.svg` | Mobile navigation (hamburger) |
| `external-link.svg` | Links leaving the app |
| `logout.svg` | Sign out |
| `tree-view.svg` | Tree / doc view |
| `graph-view.svg` | Graph view |
| `github.svg` | "Sign in with GitHub" provider button |
| `email.svg` | Email sign-in submit button |
| `close.svg` | Dialog close button |
| `institution.svg` | University / institution login buttons |

The current files are placeholders derived from Material Icons (Apache-2.0).

## Images (`images/*`) — multi-colour artwork

These render as `<img>` and are not recoloured. Register them in `images/index.ts`.

| File | Used for |
| --- | --- |
| `logo.svg` | AppBar logo |

The FAIRmat Visual Style Guidelines apply to logos:

- Use only official logo files from authorized sources (§3.3). The current `logo.svg` is a placeholder.
- The logo must be at least 36px tall on screen (§2.3), with clear space around it (§2.4). Both are enforced through `logoRules` in `theme/tokens/layout.ts`.
- Never recolor, squeeze, rotate, animate or make the logo transparent (§2.8, §3.3).
