/** Data shapes shared by the api layer, the store and the UI. Plain, serializable objects only. */

// ── User & session ──────────────────────────────────────────────────────────
export interface AuthUser {
  id?: string;
  login: string;
  name?: string;
  email?: string;
  avatarUrl?: string;
  /** e.g. "GitHub", "Helmholtz ID", "Email & password" */
  providerLabel?: string;
}

/**
 * How GitHub is reached for this user:
 *  - direct: the user's own GitHub token → https://api.github.com
 *  - proxy:  a backend session token     → <API>/github (on-behalf-of, same paths)
 */
export type SessionMode = 'direct' | 'proxy';

/** Full session, as issued by the backend (or built from a personal access token). Holds tokens. */
export interface Session {
  mode: SessionMode;
  provider: string;
  providerLabel: string;
  user: AuthUser;
  accessToken: string;
  refreshToken?: string;
  /** Epoch ms. */
  expiresAt?: number;
}

/** Session without tokens — what the UI/Redux may see. */
export type SessionInfo = Pick<Session, 'mode' | 'provider' | 'providerLabel' | 'user'>;

export interface LoginProvider {
  id: string;
  label: string;
  type: 'github' | 'oidc';
  mode: SessionMode;
  showButton: boolean;
}

/** What the backend offers (GET /auth/providers). `available: false` = backend unreachable. */
export interface NewAccount {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export interface LoginOptions {
  available: boolean;
  providers: LoginProvider[];
  password: { provider: string; label: string } | null;
  /** Account creation from the web app's form (null = off). */
  registration: { provider: string; label: string } | null;
  proxy: { enabled: boolean };
}

// ── Repository access ───────────────────────────────────────────────────────
/** Whether the repository can be read without signing in. */
export type RepoVisibility = 'public' | 'restricted';

/** What an anonymous request to GitHub reveals about a branch. */
export interface BranchAccess {
  branch: string;
  visibility: RepoVisibility;
  /** GitHub branch protection (from the branches API). */
  protected: boolean;
  /** Head commit of the branch; null when the repository is not publicly readable. */
  commit: string | null;
}

export type ReadMode = 'anonymous' | 'authenticated';

/** How the ontology is read for the current user, and whether commenting is possible. */
export interface AccessDecision {
  read: ReadMode | 'login-required';
  canComment: boolean;
  reason: 'public-branch' | 'protected-branch' | 'restricted-repository';
}

// ── Repository files ────────────────────────────────────────────────────────
export interface OntologyFile {
  path: string;
  content: string;
  /** Branch or tag the file was requested for. */
  ref: string;
  /** Commit the content belongs to (anonymous reads always pin one). */
  commit?: string;
  /** Blob SHA (authenticated reads via the contents API). */
  sha?: string;
}

export interface OntologyFileRef {
  path: string;
  name: string;
  sha: string;
}

// ── RDF ─────────────────────────────────────────────────────────────────────
export interface NamedNode {
  termType: 'NamedNode';
  value: string;
}
export interface BlankNode {
  termType: 'BlankNode';
  value: string;
}
export interface Literal {
  termType: 'Literal';
  value: string;
  language?: string;
  datatype?: string;
}
export type Subject = NamedNode | BlankNode;
export type ObjectTerm = NamedNode | BlankNode | Literal;

export interface Triple {
  subject: Subject;
  predicate: NamedNode;
  object: ObjectTerm;
  /** Named graph; undefined = default graph. */
  graph?: string;
}

/** prefix → namespace IRI */
export type PrefixMap = Record<string, string>;

/** 1-based, inclusive line range in the source file. */
export interface LineSpan {
  start: number;
  end: number;
}

/** A triple plus where it came from in the Turtle source. */
export interface LocatedTriple extends Triple {
  /** Line on which the triple was completed (usually the object's line). */
  line: number;
  /** Index into `ParsedOntology.statements` — the top-level statement it belongs to. */
  statement: number;
}

export interface ParsedOntology {
  triples: LocatedTriple[];
  prefixes: PrefixMap;
  /** Top-level Turtle statements (`subject … .`), in file order. */
  statements: LineSpan[];
  lineCount: number;
}

// ── Materialized ontology (node model) ──────────────────────────────────────
export type EntityKind = 'class' | 'objectProperty' | 'datatypeProperty' | 'annotationProperty' | 'individual' | 'datatype';
export type HierarchyKind = Exclude<EntityKind, 'individual' | 'datatype'>;

/** Object of a statement: an IRI, a literal, an anonymous expression, or an RDF list. */
export type NodeValue =
  | { type: 'iri'; iri: string }
  | { type: 'literal'; value: string; language?: string; datatype?: string }
  | { type: 'expression'; id: string }
  | { type: 'list'; items: NodeValue[] };

/** One outgoing edge of a node, with its source line. */
export interface NodeStatement {
  predicate: string;
  value: NodeValue;
  line: number;
}

/** A named OWL entity (class, property, individual, datatype). */
export interface EntityNode {
  iri: string;
  curie: string;
  label: string;
  /** More than one kind = punning (e.g. class and individual). */
  kinds: EntityKind[];
  /** False for entities only referenced (external or dangling), never declared in this file. */
  declared: boolean;
  deprecated: boolean;
  /** Statement blocks in which this entity is the subject. */
  locations: LineSpan[];
  /** Named super-classes / super-properties. */
  parents: string[];
  /** Named sub-classes / sub-properties. */
  children: string[];
  /** Named classes of an individual. */
  types: string[];
  statements: NodeStatement[];
}

export type ExpressionKind =
  | 'restriction'
  | 'union'
  | 'intersection'
  | 'complement'
  | 'oneOf'
  | 'inverse'
  | 'dataRange'
  | 'anonymousIndividual'
  | 'other';

/** An anonymous (blank-node) class / property / data-range expression. */
export interface ExpressionNode {
  id: string;
  kind: ExpressionKind;
  /** Manchester-like rendering, e.g. "has component some layer". */
  text: string;
  location: LineSpan;
  /** Named entities (or axiom ids) that use this expression. */
  owners: string[];
  /** True when used inside another expression (not listed on its own). */
  nested: boolean;
  statements: NodeStatement[];
}

export type AxiomKind =
  | 'AllDisjointClasses'
  | 'AllDisjointProperties'
  | 'AllDifferent'
  | 'NegativePropertyAssertion'
  | 'GeneralClassInclusion'
  | 'AnnotatedAxiom';

/** An axiom that does not belong to a single named entity. */
export interface AxiomNode {
  id: string;
  kind: AxiomKind;
  text: string;
  location: LineSpan;
  members: string[];
  statements: NodeStatement[];
}

export interface OntologyHeader {
  iri: string;
  label: string;
  versionIri?: string;
  versionInfo?: string;
  imports: string[];
  location?: LineSpan;
  statements: NodeStatement[];
}

/**
 * The materialized ontology: plain, serializable nodes keyed by id (IRI or blank-node id),
 * each with its source lines. Built once per file version (in a Web Worker) and kept in Redux.
 */
export interface OntologyModel {
  header: OntologyHeader | null;
  prefixes: PrefixMap;
  entities: Record<string, EntityNode>;
  expressions: Record<string, ExpressionNode>;
  axioms: Record<string, AxiomNode>;
  /** Outgoing statements of every blank node (lists excluded — they appear as list values). */
  blankNodes: Record<string, NodeStatement[]>;
  /** Top-level statement blocks of the file (`subject … .`), in order. */
  blocks: LineSpan[];
  /** Top of each hierarchy (includes one member of every parentless cycle). */
  roots: Record<HierarchyKind, string[]>;
  /** Strongly connected sub-class / sub-property groups (incl. self-loops). */
  cycles: string[][];
  stats: {
    triples: number;
    lines: number;
    entities: Record<EntityKind, number>;
    expressions: number;
    axioms: number;
  };
}

// ── Comments (GitHub Issues) ────────────────────────────────────────────────
export interface CommentAnchor {
  filePath: string;
  entityIri?: string;
  lineStart?: number;
  lineEnd?: number;
  ref?: string;
}

export interface CommentThread {
  id: number;
  title: string;
  body: string;
  author: string;
  state: 'open' | 'closed';
  url: string;
  createdAt: string;
  anchor: CommentAnchor | null;
}
