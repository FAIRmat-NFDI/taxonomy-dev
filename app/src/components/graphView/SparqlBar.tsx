import { CircularProgress, IconButton, InputBase, Paper, Tooltip, Typography } from '@mui/material';
import { CloseIcon, RunIcon } from '@/assets';
import { monoFontFamily } from '@/theme';

export const SAMPLE_QUERY = 'SELECT ?c WHERE { ?c a owl:Class }';

interface SparqlBarProps {
  /** The query text (controlled, so the same query shows in the pane and in full screen). */
  query: string;
  onQueryChange: (query: string) => void;
  onRun: (query: string) => void;
  /** Clears the query and the result (the graph shows everything again). */
  onClear: () => void;
  running: boolean;
  /** A result is shown (the clear button stays available). */
  active: boolean;
  disabled?: boolean;
}

/**
 * Compact SPARQL line under the graph: `SPARQL` prompt, the query (grows to a few lines), clear and run.
 * ⌘/Ctrl + Enter runs; the ontology's prefixes are available without declaring them.
 */
export function SparqlBar({ query, onQueryChange, onRun, onClear, running, active, disabled = false }: SparqlBarProps) {
  const run = () => {
    if (query.trim() && !running) onRun(query);
  };

  return (
    <Paper variant="outlined" sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, pl: 1.5, pr: 0.5, py: 0.5, borderRadius: 2 }}>
      <Typography variant="body2" color="primary" sx={{ fontFamily: monoFontFamily, py: 1, flexShrink: 0 }}>
        SPARQL $
      </Typography>
      <InputBase
        multiline
        maxRows={6}
        fullWidth
        placeholder={SAMPLE_QUERY}
        value={query}
        disabled={disabled}
        onChange={(e) => onQueryChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            run();
          }
        }}
        inputProps={{ spellCheck: false, 'aria-label': 'SPARQL query' }}
        sx={{ fontFamily: monoFontFamily, fontSize: '0.8125rem', py: 0.75 }}
      />
      {(query || active) && (
        <Tooltip title="Clear">
          <IconButton
            aria-label="Clear SPARQL"
            onClick={() => {
              onQueryChange('');
              onClear();
            }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}
      <Tooltip title="Run (⌘/Ctrl + Enter) · SELECT, CONSTRUCT, DESCRIBE or ASK · the ontology's prefixes are predefined">
        <span>
          <IconButton aria-label="Run SPARQL" color="primary" onClick={run} disabled={disabled || running || !query.trim()}>
            {running ? <CircularProgress size={20} /> : <RunIcon />}
          </IconButton>
        </span>
      </Tooltip>
    </Paper>
  );
}
