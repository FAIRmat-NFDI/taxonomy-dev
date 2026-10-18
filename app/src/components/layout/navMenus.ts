/** Static dropdown menus in the AppBar. Pure data — edit here, not in components. */
export interface NavMenuItem {
  label: string;
  href: string;
}

export interface NavMenu {
  label: string;
  items: NavMenuItem[];
}

export const navMenus: NavMenu[] = [
  {
    label: 'NOMAD Metainfo',
    items: [
      { label: 'Metainfo browser', href: 'https://nomad-lab.eu/prod/v1/gui/analyze/metainfo' },
      { label: 'NOMAD documentation', href: 'https://nomad-lab.eu/prod/v1/docs/' },
    ],
  },
  {
    label: 'About',
    items: [
      { label: 'FAIRmat', href: 'https://www.fairmat-nfdi.eu/fairmat' },
      { label: 'NOMAD', href: 'https://nomad-lab.eu' },
    ],
  },
];
