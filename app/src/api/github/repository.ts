import { config } from '@/config';
import { AppError, isAppError } from '../errors';
import { request } from '../http';
import type { BranchAccess, OntologyFile, OntologyFileRef } from '../types';
import { decodeBase64Utf8 } from './base64';
import { encodePath, gh, repoPath } from './client';

const ONTOLOGY_EXTENSIONS = ['.ttl', '.owl', '.rdf', '.nt'];
const repo = () => repoPath(config.source.owner, config.source.repo);

interface ContentEntry {
  type: 'file' | 'dir' | 'symlink' | 'submodule';
  name: string;
  path: string;
  sha: string;
  content?: string;
}

export async function listBranches(): Promise<string[]> {
  const names: string[] = [];
  for (let page = 1; page <= 10; page++) {
    const batch = await gh.get<{ name: string }[]>(`${repo()}/branches`, { per_page: 100, page });
    names.push(...batch.map((b) => b.name));
    if (batch.length < 100) break;
  }
  return names;
}

export async function listFiles(directory = '', ref = config.source.branch): Promise<OntologyFileRef[]> {
  const data = await gh.get<ContentEntry[] | ContentEntry>(`${repo()}/contents/${encodePath(directory)}`, { ref });
  if (!Array.isArray(data)) return [];
  return data
    .filter((e) => e.type === 'file' && ONTOLOGY_EXTENSIONS.some((ext) => e.name.endsWith(ext)))
    .map((e) => ({ path: e.path, name: e.name, sha: e.sha }));
}

/** GitHub REST without any credentials — what a signed-out visitor can see. */
const anonymous = { baseUrl: config.githubApiUrl, token: null, headers: { Accept: 'application/vnd.github+json' } };

/**
 * Probes a branch anonymously: public or not, protected or not, and its head commit.
 * 404 / 401 / 403 (other than rate limiting) mean the repository is not publicly readable.
 */
export async function getBranchAccess(branch: string): Promise<BranchAccess> {
  try {
    const data = await request<{ name: string; protected: boolean; commit: { sha: string } }>(
      anonymous,
      'GET',
      `${repo()}/branches/${encodePath(branch)}`,
    );
    return { branch: data.name, visibility: 'public', protected: data.protected, commit: data.commit.sha };
  } catch (e) {
    if (isAppError(e) && ['NOT_FOUND', 'UNAUTHENTICATED', 'FORBIDDEN'].includes(e.code)) {
      return { branch, visibility: 'restricted', protected: false, commit: null };
    }
    throw e;
  }
}

/**
 * Reads a file of a public repository from raw.githubusercontent.com (CORS-enabled, no API
 * rate limit). Pinned to a commit, so a CDN-cached copy of an older branch head is never served.
 */
export async function getPublicFile(path: string, commit: string, ref: string): Promise<OntologyFile> {
  const url = `${config.githubRawUrl}/${encodeURIComponent(config.source.owner)}/${encodeURIComponent(config.source.repo)}/${commit}/${encodePath(path)}`;
  let res: Response;
  try {
    res = await fetch(url);
  } catch (e) {
    throw new AppError('NETWORK', 'Could not reach raw.githubusercontent.com.', e);
  }
  if (res.status === 404) throw new AppError('NOT_FOUND', `${path} was not found on ${ref}.`);
  if (!res.ok) throw new AppError('UNKNOWN', `Reading ${path} failed (${res.status}).`);
  return { path, content: await res.text(), ref, commit };
}

export async function getFile(path: string, ref = config.source.branch): Promise<OntologyFile> {
  const data = await gh.get<ContentEntry | ContentEntry[]>(`${repo()}/contents/${encodePath(path)}`, { ref });
  if (Array.isArray(data) || data.type !== 'file') throw new AppError('NOT_FOUND', `${path} is not a file`);
  // Files over 1 MB come back without inline content — fetch the blob instead.
  const base64 = data.content || (await gh.get<{ content: string }>(`${repo()}/git/blobs/${data.sha}`)).content;
  return { path: data.path, content: decodeBase64Utf8(base64), sha: data.sha, ref };
}
