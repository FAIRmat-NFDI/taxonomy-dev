import { createElement, type ComponentType, type SVGProps } from 'react';
import { SvgIcon, type SvgIconProps } from '@mui/material';

type SvgComponent = ComponentType<SVGProps<SVGSVGElement>>;

/**
 * Wraps an SVG asset (imported with `?react`) in MUI's SvgIcon, so asset icons
 * behave exactly like @mui/icons-material: `fontSize`, `color`, `sx`, theme sizing.
 */
export function createAssetIcon(svg: SvgComponent, displayName: string): ComponentType<SvgIconProps> {
  const AssetIcon = (props: SvgIconProps) => createElement(SvgIcon, { component: svg, inheritViewBox: true, ...props });
  AssetIcon.displayName = displayName;
  return AssetIcon;
}
