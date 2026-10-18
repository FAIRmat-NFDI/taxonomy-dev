import type { ReactNode } from 'react';
import { Link } from '@mui/material';
import { useSelectedNode } from '@/hooks/useOntology';

/** Inline link that selects a node of the ontology (`?node=`). */
export function NodeLink({ id, children }: { id: string; children: ReactNode }) {
  const [, select] = useSelectedNode();
  return (
    <Link component="button" type="button" variant="inherit" underline="hover" onClick={() => select(id)} sx={{ verticalAlign: 'baseline', textAlign: 'left' }}>
      {children}
    </Link>
  );
}
