import { Link } from '@mui/material';
import type { LineSpan, LoadedSource } from '@/api';
import { config } from '@/config';

/** "View on GitHub" link for a line range, pinned to the loaded commit when known. */
export function LineLink({ source, span }: { source: LoadedSource; span: LineSpan }) {
  const ref = source.commit ?? source.branch;
  const lines = span.start === span.end ? `L${span.start}` : `L${span.start}-L${span.end}`;
  const href = `${config.githubWebUrl}/${source.owner}/${source.repo}/blob/${ref}/${source.path}#${lines}`;
  return (
    <Link href={href} target="_blank" rel="noreferrer">
      {span.start === span.end ? `line ${span.start}` : `lines ${span.start}–${span.end}`}
    </Link>
  );
}
