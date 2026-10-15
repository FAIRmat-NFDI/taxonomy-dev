/// <reference types="vite/client" />
/// <reference types="vite-plugin-svgr/client" />

interface ImportMetaEnv {
  readonly VITE_BASE?: string;
  readonly VITE_GH_OWNER?: string;
  readonly VITE_GH_REPO?: string;
  readonly VITE_GH_BRANCH?: string;
  readonly VITE_ONTOLOGY_PATH?: string;
  readonly VITE_GH_ISSUES_OWNER?: string;
  readonly VITE_GH_ISSUES_REPO?: string;
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_GITHUB_API_URL?: string;
  readonly VITE_GITHUB_RAW_URL?: string;
  readonly VITE_GITHUB_WEB_URL?: string;
  readonly VITE_PROTECTED_BRANCHES_PUBLIC?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
