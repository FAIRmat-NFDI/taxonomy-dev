import { useState } from 'react';
import {
  Alert,
  Avatar,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import type { CommentAnchor, LoadedSource } from '@/api';
import { CloseIcon } from '@/assets';
import { selectCurrentUser, useAppSelector } from '@/store';
import type { IssueReference } from './issueReference';
import { IssueReferenceCard } from './IssueReferenceCard';
import { MarkdownEditor } from './MarkdownEditor';

export interface IssueDraft {
  title: string;
  /** Markdown; starts with the reference line. */
  body: string;
  anchor: CommentAnchor;
}

interface CreateIssueDialogProps {
  open: boolean;
  onClose: () => void;
  reference: IssueReference;
  source: LoadedSource;
  text: string | null;
  /** Posts the issue (rejects with a readable message). Not provided → Create stays disabled. */
  onCreate?: (draft: IssueDraft) => Promise<void>;
}

/**
 * GitHub-style "Create new issue" form in a dialog: title, Markdown description (Write / Preview),
 * Cancel / Create. The only custom part: the description starts with a reference to
 * the selected node and its file lines, and the anchor goes with the issue.
 * The draft survives closing the dialog (until the selected node changes — the dialog is keyed by it).
 */
export function CreateIssueDialog({ open, onClose, reference, source, text, onCreate }: CreateIssueDialogProps) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'), { noSsr: true });
  const user = useAppSelector(selectCurrentUser);

  const initialBody = `${reference.markdown}\n\n`;
  const [title, setTitle] = useState('');
  const [body, setBody] = useState(initialBody);
  const [touched, setTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const titleMissing = !title.trim();

  const submit = async () => {
    setTouched(true);
    if (titleMissing || !onCreate) return;
    setSubmitting(true);
    setError(null);
    try {
      await onCreate({ title: title.trim(), body, anchor: reference.anchor });
      setTitle('');
      setBody(initialBody);
      setTouched(false);
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={submitting ? undefined : onClose} fullWidth maxWidth="md" fullScreen={fullScreen} aria-labelledby="create-issue-title">
      <DialogTitle id="create-issue-title" component="div" sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Avatar src={user?.avatarUrl} alt={user?.login} sx={{ width: 32, height: 32 }} />
        <Typography variant="h6" component="h2" sx={{ flexGrow: 1 }}>
          Create new issue
        </Typography>
        <IconButton aria-label="Close" onClick={onClose} disabled={submitting}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        <Stack spacing={3}>
          <IssueReferenceCard reference={reference} source={source} text={text} />

          <Stack spacing={1}>
            <Typography variant="subtitle2" component="label" htmlFor="issue-title">
              Add a title *
            </Typography>
            <TextField
              id="issue-title"
              autoFocus
              fullWidth
              required
              placeholder="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => setTouched(true)}
              error={touched && titleMissing}
              helperText={touched && titleMissing ? 'A title is required.' : undefined}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void submit();
              }}
            />
          </Stack>

          <Stack spacing={1}>
            <Typography variant="subtitle2" component="h3">
              Add a description
            </Typography>
            <MarkdownEditor value={body} onChange={setBody} />
          </Stack>

        </Stack>
      </DialogContent>

      {/* Outside the scrolling content, so it is always in view next to the buttons */}
      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mx: 3, mt: 2 }}>
          {error}
        </Alert>
      )}

      <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
        <Button onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        <Tooltip title={onCreate ? '' : 'Sign in with GitHub to create issues.'}>
          <span>
            <Button variant="contained" onClick={() => void submit()} loading={submitting} disabled={!onCreate || titleMissing}>
              Create
            </Button>
          </span>
        </Tooltip>
      </DialogActions>
    </Dialog>
  );
}
