import { Chip, Link } from '@mui/material';
import { compactIri, type NodeValue, type OntologyModel } from '@/api';
import { NodeLink } from './NodeLink';

/** An annotation value: literal (with language), a link to a node, or an external IRI. */
export function ValueView({ model, value }: { model: OntologyModel; value: NodeValue }) {
  switch (value.type) {
    case 'literal':
      return (
        <>
          <span style={{ whiteSpace: 'pre-wrap' }}>{value.value}</span>
          {value.language && <Chip label={value.language} size="small" variant="outlined" sx={{ ml: 1, height: 18 }} />}
        </>
      );
    case 'iri':
      if (model.entities[value.iri]) return <NodeLink id={value.iri}>{model.entities[value.iri]!.label}</NodeLink>;
      return /^https?:/.test(value.iri) ? (
        <Link href={value.iri} target="_blank" rel="noreferrer">
          {compactIri(value.iri, model.prefixes)}
        </Link>
      ) : (
        <>{compactIri(value.iri, model.prefixes)}</>
      );
    case 'expression':
      return <NodeLink id={value.id}>{model.expressions[value.id]?.text ?? value.id}</NodeLink>;
    case 'list':
      return <>({value.items.map((v, i) => (i ? [', ', <ValueView key={i} model={model} value={v} />] : <ValueView key={i} model={model} value={v} />))})</>;
  }
}
