import { Alert, IconButton, Paper, Skeleton, Stack, Tooltip } from '@mui/material';
import { PaneCollapseIcon } from '@/assets';
import { useOntology } from '@/hooks/useOntology';
import { PanelBody } from './PanelBody';
import { PanelHeader } from './PanelHeader';

interface CommentsPanelProps {
  /** Desktop: hide this pane (DocLayout shows a rail to bring it back). */
  onCollapse?: () => void;
}

/** Column 3: GitHub issues / comments for the selected entity. */
export function CommentsPanel({ onCollapse }: CommentsPanelProps) {
  const { access } = useOntology();
  const readOnly = !!access && !access.canComment;

  return (
    <>
      <PanelHeader
        title="Issues"
        actions={
          onCollapse && (
            <Tooltip title="Hide issues">
              <IconButton aria-label="Hide issues" onClick={onCollapse} sx={{ display: { xs: 'none', md: 'inline-flex' } }}>
                <PaneCollapseIcon />
              </IconButton>
            </Tooltip>
          )
        }
      />
      <PanelBody>
        <Stack spacing={2} aria-busy>
          {readOnly && <Alert severity="info">Read-only. Sign in to comment.</Alert>}
          {[3, 5].map((lines) => (
            <Paper key={lines} sx={{ p: 2, borderRadius: 2 }}>
              <Skeleton width="30%" sx={{ mb: 1 }} />
              {Array.from({ length: lines }, (_, i) => (
                <Skeleton key={i} width={i === lines - 1 ? '60%' : '100%'} />
              ))}
            </Paper>
          ))}
        </Stack>
      </PanelBody>
    </>
  );
}
