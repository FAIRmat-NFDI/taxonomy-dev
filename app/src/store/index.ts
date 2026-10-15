import { configureStore } from '@reduxjs/toolkit';
import { useDispatch, useSelector } from 'react-redux';
import { authReducer } from './authSlice';
import { ontologyReducer } from './ontologySlice';
import { sourceReducer } from './sourceSlice';
import { uiReducer } from './uiSlice';

/** The materialized model and source text can be large and is replaced as a whole — skip the dev-only deep checks on it. */
const LARGE_PATHS = ['ontology.model', 'ontology.text'];

/**
 * Redux holds app state: who is signed in, which branch is selected, and the
 * loaded ontology (access decision + materialized node model).
 * Other GitHub data (branch list, issues) is cached by React Query (see hooks/).
 */
export function makeStore() {
  return configureStore({
    reducer: {
      auth: authReducer,
      source: sourceReducer,
      ontology: ontologyReducer,
      ui: uiReducer,
    },
    middleware: (getDefault) =>
      getDefault({
        immutableCheck: { ignoredPaths: LARGE_PATHS },
        serializableCheck: { ignoredPaths: LARGE_PATHS },
      }),
  });
}

export const store = makeStore();

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore['getState']>;
export type AppDispatch = AppStore['dispatch'];

export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();

// ── Selectors ───────────────────────────────────────────────────────────────
export const selectAuth = (s: RootState) => s.auth;
export const selectCurrentUser = (s: RootState) => s.auth.user;
export const selectBranch = (s: RootState) => s.source.branch;
export const selectOntology = (s: RootState) => s.ontology;
export const selectModel = (s: RootState) => s.ontology.model;
export const selectBusyTasks = (s: RootState) => s.ui.tasks;

export * from './authSlice';
export * from './ontologySlice';
export * from './uiSlice';
export * from './sourceSlice';
