import { useMemo, useState } from 'react';
import { Alert, Box, Button, IconButton, Link, Snackbar, Stack, Tooltip, Typography, useMediaQuery, useTheme } from '@mui/material';
import type { CommentThread } from '@/api';
import { IssueAddIcon, PaneCollapseIcon } from '@/assets';
import { CreateIssueDialog, IssueCard, IssueCardSkeleton, issueReference, type IssueDraft } from '@/components/issues';
import { useCloseIssue, useCreateIssue, useIssueIndex, useIssuePermission } from '@/hooks/useIssues';
import { useOntology, useSelectedNode } from '@/hooks/useOntology';
import { PanelBody } from './PanelBody';
import { PanelHeader } from './PanelHeader';

interface CommentsPanelProps {
  /** Desktop: hide this pane (DocLayout shows a rail to bring it back). */
  onCollapse?: () => void;
}

/**
 * Column 3: GitHub issues for the selected node.
 * "Create issue" sits at the bottom of the pane on desktop and right under the header on small
 * screens; it opens the issue form with the node's reference (file lines) filled in.
 */
export function CommentsPanel({ onCollapse }: CommentsPanelProps) {
  const { status, model, source, text, access } = useOntology();
  const [selected] = useSelectedNode();
  const [dialogOpen, setDialogOpen] = useState(false);
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'), { noSsr: true });

  const reference = useMemo(() => (model && source ? issueReference(model, source, selected) : null), [model, source, selected]);
  const ready = status === 'ready' && !!reference && !!source;
  // Repository access allows commenting, and the sign-in can post (GitHub sign-ins for now).
  const permission = useIssuePermission();
  const canComment = !!access?.canComment && permission.canCreate;
  const hint =
    permission.reason === 'not-github'
      ? 'Creating issues currently needs a GitHub sign-in.'
      : 'Read-only. Sign in with GitHub to create issues.';
  const writeHint =
    permission.reason === 'not-github'
      ? 'Commenting and closing currently need a GitHub sign-in.'
      : 'Sign in with GitHub to comment or close issues.';

  const issues = useIssueIndex();
  const nodeIssues = (reference && issues.index.get(reference.nodeId)) ?? [];

  const createIssue = useCreateIssue();
  const closeIssue = useCloseIssue();
  const [notice, setNotice] = useState<{ severity: 'success' | 'error'; message: string; issue?: CommentThread } | null>(null);
  const onCreate = async (draft: IssueDraft) => {
    const issue = await createIssue.mutateAsync(draft);
    setNotice({ severity: 'success', message: `Issue #${issue.id} created`, issue });
  };
  const onCloseIssue = (issue: CommentThread) =>
    closeIssue.mutate(issue, {
      onSuccess: () => setNotice({ severity: 'success', message: `Issue #${issue.id} closed`, issue }),
      onError: (e) => setNotice({ severity: 'error', message: e.message }),
    });

  const createBar = (
    <Box sx={{ p: 2, ...(isDesktop ? { borderTop: 1 } : { borderBottom: 1 }), borderColor: 'divider' }}>
      <Tooltip title={!ready ? '' : canComment ? `New issue about “${reference?.label}”` : hint}>
        <span>
          <Button fullWidth variant="outlined" size="large" startIcon={<IssueAddIcon />} disabled={!ready || !canComment} onClick={() => setDialogOpen(true)}>
            Create issue
          </Button>
        </span>
      </Tooltip>
      {ready && !canComment && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1, textAlign: 'center' }}>
          {hint}
        </Typography>
      )}
    </Box>
  );

  const list = (
    <PanelBody>
      <Stack spacing={1.5} sx={{ pt: isDesktop ? 0 : 2 }}>
        {status === 'login-required' && <Alert severity="info">Sign in to see issues.</Alert>}
        {ready && issues.error && (
          <Alert
            severity="warning"
            action={
              <Button color="inherit" size="small" onClick={() => void issues.refetch()}>
                Retry
              </Button>
            }
          >
            {issues.error}
          </Alert>
        )}
        {ready && issues.loading && [0, 1].map((i) => <IssueCardSkeleton key={i} />)}
        {ready && !issues.loading && !issues.error && nodeIssues.length === 0 && (
          <Typography variant="body2" color="text.secondary">
            No open issues about <strong>{reference.label}</strong>.
          </Typography>
        )}
        {ready &&
          nodeIssues.map((issue) => (
            <IssueCard
              key={issue.id}
              issue={issue}
              canWrite={canComment}
              writeHint={writeHint}
              onCloseIssue={onCloseIssue}
              closing={closeIssue.isPending && closeIssue.variables?.id === issue.id}
            />
          ))}
      </Stack>
    </PanelBody>
  );

  return (
    <>
      <PanelHeader
        title={ready && nodeIssues.length > 0 ? `Issues (${nodeIssues.length})` : 'Issues'}
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
      {/* Desktop: list, then the bar at the bottom · small screens: bar first, under the header */}
      {isDesktop ? (
        <>
          {list}
          {createBar}
        </>
      ) : (
        <>
          {createBar}
          {list}
        </>
      )}
      {ready && (
        <CreateIssueDialog
          key={reference.nodeId}
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          reference={reference}
          source={source}
          text={text}
          onCreate={canComment ? onCreate : undefined}
        />
      )}
      <Snackbar
        open={!!notice}
        autoHideDuration={8000}
        onClose={(_, reason) => reason !== 'clickaway' && setNotice(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={notice?.severity ?? 'success'}
          variant="filled"
          onClose={() => setNotice(null)}
          action={
            notice?.issue && (
              <Button color="inherit" size="small" component={Link} href={notice.issue.url} target="_blank" rel="noopener noreferrer">
                View on GitHub
              </Button>
            )
          }
        >
          {notice?.message}
        </Alert>
      </Snackbar>
    </>
  );
}
