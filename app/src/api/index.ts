/**
 * api/ — the app's "model" layer: auth, GitHub REST, access policy, TTL parsing and materialization.
 * Plain TypeScript (no React), plain fetch (no SDKs).
 */
export * as authApi from './auth';
export * as repositoryApi from './github/repository';
export * as issuesApi from './github/issues';
export * as ontologyApi from './ontology';
export type { LoadedSource, OntologyLoadResult } from './ontology';
export { decideAccess, type AccessPolicy } from './access';
export { githubTarget } from './github/client';
export { parseTurtle } from './rdf/parser';
export { materialize, compactIri } from './rdf/materialize';
export { materializeTurtle } from './rdf/engine';
export { runSparql } from './rdf/sparql';
export { queryErrorMessage, toSparqlResult, withPrefixes, type SparqlResult } from './rdf/sparqlResult';
export { buildOntologyGraph, graphRootFor, type EdgeRelation, type GraphEdge, type GraphNode, type GraphNodeKind, type OntologyGraph } from './rdf/graph';
export { annotationsOf, type AnnotationGroup } from './rdf/annotations';
export { axiomsFor, renderAxiom, INCOMING_LIMIT, type Axiom, type NodeAxiom, type Notation, type Token } from './rdf/axioms';
export { formatNodeTurtle, sourceSpans, highlightTurtle, type TurtleSegment, type TurtleTokenClass } from './rdf/turtle';
export * from './rdf/vocab';
export * from './errors';
export type * from './types';
