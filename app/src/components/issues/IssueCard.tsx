import { useId, useState } from 'react';
import { Alert, Avatar, Box, Button, Chip, Collapse, IconButton, Link, Paper, Skeleton, Stack, Tooltip, Typography } from '@mui/material';
import type { CommentThread, IssueComment } from '@/api';
import { ExpandMoreIcon, IssueClosedIcon } from '@/assets';
import { useAddComment, useIssueComments } from '@/hooks/useIssues';
import { relativeTime } from '@/lib/relativeTime';
import { stripReference } from './issueIndex';
import { MarkdownEditor, MarkdownPreview } from './MarkdownEditor';

/** Long descriptions / comments scroll inside their box instead of stretching the pane. */
const TEXT_BOX_MAX_HEIGHT = 240;

interface IssueCardProps {
  issue: CommentThread;
  /** The signed-in user can comment and close (GitHub sign-in for now). */
  canWrite: boolean;
  /** Why not, shown when `canWrite` is false. */
  writeHint: string;
  onCloseIssue: (issue: CommentThread) => void;
  /** This issue is being closed. */
  closing?: boolean;
  /** The node the issue is about — shown when the list mixes nodes; clicking selects it. */
  about?: { label: string; onSelect: () => void };
}

const countText = (n: number) => `${n} ${n === 1 ? 'comment' : 'comments'}`;

/** Avatar (16 px) · GitHub id · relative time. */
function AuthorLine({ login, avatarUrl, profileUrl, createdAt }: { login: string; avatarUrl?: string; profileUrl?: string; createdAt: string }) {
  return (
    <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center', minWidth: 0, flexGrow: 1 }}>
      <Avatar src={avatarUrl} alt="" sx={{ width: 16, height: 16 }} />
      <Link href={profileUrl} target="_blank" rel="noopener noreferrer" variant="caption" color="text.primary" underline="hover" noWrap sx={{ fontWeight: 600, minWidth: 0 }}>
        {login}
      </Link>
      <Tooltip title={new Date(createdAt).toLocaleString()}>
        <Typography variant="caption" color="text.secondary" component="time" dateTime={createdAt} noWrap sx={{ flexShrink: 0 }}>
          {relativeTime(createdAt)}
        </Typography>
      </Tooltip>
    </Stack>
  );
}

/** Read-only Markdown in an outlined box with its own scroll. */
function TextBox({ text, empty }: { text: string; empty?: string }) {
  return (
    <Paper variant="outlined" sx={{ p: 1.5, bgcolor: 'background.default', maxHeight: TEXT_BOX_MAX_HEIGHT, overflowY: 'auto' }}>
      <MarkdownPreview text={text} empty={empty} />
    </Paper>
  );
}

function CommentItem({ comment }: { comment: IssueComment }) {
  return (
    <Stack spacing={0.75} component="li">
      <AuthorLine login={comment.author} avatarUrl={comment.authorAvatarUrl} profileUrl={comment.authorUrl} createdAt={comment.createdAt} />
      <TextBox text={comment.body} />
    </Stack>
  );
}

/** Expanded part: the comment timeline and a minimal "Add a comment" box with Close issue / Comment. */
function IssueThread({ issue, canWrite, writeHint, onCloseIssue, closing }: IssueCardProps) {
  const { comments, loading, error, refetch } = useIssueComments(issue, true);
  const addComment = useAddComment(issue);
  const [draft, setDraft] = useState('');

  const submit = async () => {
    if (!draft.trim()) return;
    try {
      await addComment.mutateAsync(draft.trim());
      setDraft('');
    } catch {
      /* shown below */
    }
  };

  return (
    <Stack spacing={1.5} sx={{ pt: 1.5 }}>
      <Typography variant="caption" color="text.secondary">
        {countText(issue.comments)}
      </Typography>
      {loading && <Skeleton variant="rounded" height={56} />}
      {error && (
        <Alert severity="warning" action={<Button color="inherit" size="small" onClick={() => void refetch()}>Retry</Button>}>
          {error}
        </Alert>
      )}
      {comments.length > 0 && (
        <Stack component="ul" spacing={1.5} sx={{ listStyle: 'none', m: 0, p: 0 }}>
          {comments.map((c) => (
            <CommentItem key={c.id} comment={c} />
          ))}
        </Stack>
      )}

      {canWrite ? (
        <Stack spacing={1}>
          <Typography variant="subtitle2" component="h4">
            Add a comment
          </Typography>
          <MarkdownEditor value={draft} onChange={setDraft} minRows={3} label="Comment" placeholder="Use Markdown to format your comment" />
          {addComment.error && (
            <Alert severity="error" onClose={() => addComment.reset()}>
              {addComment.error.message}
            </Alert>
          )}
          <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end', flexWrap: 'wrap', rowGap: 1 }}>
            <Button
              variant="outlined"
              color="inherit"
              startIcon={<IssueClosedIcon sx={{ color: 'fairmat.areaE' }} />}
              onClick={() => onCloseIssue(issue)}
              loading={closing}
              disabled={addComment.isPending}
            >
              Close issue
            </Button>
            <Button variant="contained" onClick={() => void submit()} loading={addComment.isPending} disabled={!draft.trim() || closing}>
              Comment
            </Button>
          </Stack>
        </Stack>
      ) : (
        <Typography variant="caption" color="text.secondary">
          {writeHint}
        </Typography>
      )}
    </Stack>
  );
}

/**
 * One GitHub issue about the selected node: author (GitHub id + tiny avatar), title, the description
 * in a read-only text box, comment count and "Close issue". Expanding it shows the comments and a
 * minimal comment box — like the GitHub issue page, without its extras.
 */
export function IssueCard(props: IssueCardProps) {
  const { issue, canWrite, writeHint, onCloseIssue, closing } = props;
  const [expanded, setExpanded] = useState(false);
  const threadId = useId();

  return (
    <Paper component="article" sx={{ borderRadius: 2, p: 1.5 }} aria-labelledby={`issue-${issue.id}-title`}>
      <Stack spacing={1}>
        <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', minWidth: 0 }}>
          <AuthorLine login={issue.author} avatarUrl={issue.authorAvatarUrl} profileUrl={issue.authorUrl} createdAt={issue.createdAt} />
          <Link href={issue.url} target="_blank" rel="noopener noreferrer" variant="caption" color="text.secondary" underline="hover">
            #{issue.id}
          </Link>
          <Tooltip title={expanded ? 'Hide comments' : 'Show comments'}>
            <IconButton
              size="small"
              aria-label={expanded ? `Hide comments of issue #${issue.id}` : `Show comments of issue #${issue.id}`}
              aria-expanded={expanded}
              aria-controls={threadId}
              onClick={() => setExpanded((e) => !e)}
            >
              <ExpandMoreIcon fontSize="small" sx={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: (t) => t.transitions.create('transform') }} />
            </IconButton>
          </Tooltip>
        </Stack>

        <Link
          id={`issue-${issue.id}-title`}
          href={issue.url}
          target="_blank"
          rel="noopener noreferrer"
          variant="subtitle2"
          color="text.primary"
          underline="hover"
          sx={{ overflowWrap: 'anywhere' }}
        >
          {issue.title}
        </Link>

        {props.about && (
          <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center', minWidth: 0 }}>
            <Typography variant="caption" color="text.secondary">
              About
            </Typography>
            <Chip label={props.about.label} size="small" variant="outlined" color="primary" onClick={props.about.onSelect} sx={{ minWidth: 0 }} />
          </Stack>
        )}

        <TextBox text={stripReference(issue.body)} empty="No description provided." />

        <Collapse in={!expanded} unmountOnExit>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <Link component="button" variant="caption" color="text.secondary" underline="hover" onClick={() => setExpanded(true)} sx={{ flexGrow: 1, textAlign: 'left' }}>
              {countText(issue.comments)}
            </Link>
            <Tooltip title={canWrite ? 'Close issue' : writeHint}>
              <span>
                <IconButton
                  aria-label={`Close issue #${issue.id}`}
                  size="small"
                  onClick={() => onCloseIssue(issue)}
                  disabled={!canWrite || closing}
                  sx={{ color: 'fairmat.areaE' }}
                >
                  <IssueClosedIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          </Stack>
        </Collapse>

        <Collapse in={expanded} unmountOnExit>
          <Box id={threadId}>
            <IssueThread {...props} />
          </Box>
        </Collapse>
      </Stack>
    </Paper>
  );
}

/** Placeholder while issues load. */
export function IssueCardSkeleton() {
  return (
    <Paper sx={{ borderRadius: 2, p: 1.5 }}>
      <Stack spacing={1}>
        <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
          <Skeleton variant="circular" width={16} height={16} />
          <Skeleton variant="text" width="40%" />
        </Stack>
        <Skeleton variant="text" width="80%" />
        <Box>
          <Skeleton variant="rounded" height={56} />
        </Box>
      </Stack>
    </Paper>
  );
}
