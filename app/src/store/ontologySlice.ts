import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { isAppError, ontologyApi, type AccessDecision, type AppErrorCode, type LoadedSource, type OntologyModel } from '@/api';

/**
 *  idle ──load──▶ loading ──▶ ready            (model available)
 *                         ├─▶ login-required   (protected branch / private repo, signed out)
 *                         └─▶ error
 */
export type OntologyStatus = 'idle' | 'loading' | 'ready' | 'login-required' | 'error';

export interface OntologyState {
  status: OntologyStatus;
  source: LoadedSource | null;
  access: AccessDecision | null;
  /** Materialized node model — plain JSON, replaced as a whole on every load. */
  model: OntologyModel | null;
  /** The Turtle source the model was built from (for the read-only source view). */
  text: string | null;
  error: { code: AppErrorCode; message: string } | null;
  /** Latest request; results of older requests (e.g. a branch switched mid-load) are ignored. */
  requestId: string | null;
}

const initialState: OntologyState = { status: 'idle', source: null, access: null, model: null, text: null, error: null, requestId: null };

export const loadOntology = createAsyncThunk(
  'ontology/load',
  async ({ branch, signedIn }: { branch: string; signedIn: boolean }, { rejectWithValue }) => {
    try {
      return await ontologyApi.loadOntology({ branch, signedIn });
    } catch (e) {
      return rejectWithValue(isAppError(e) ? { code: e.code, message: e.message } : { code: 'UNKNOWN' as const, message: String(e) });
    }
  },
);

const ontologySlice = createSlice({
  name: 'ontology',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(loadOntology.pending, (state, action) => {
        state.status = 'loading';
        state.error = null;
        state.requestId = action.meta.requestId;
      })
      .addCase(loadOntology.fulfilled, (state, action) => {
        if (action.meta.requestId !== state.requestId) return;
        const result = action.payload;
        state.source = result.source;
        state.access = result.access;
        state.status = result.status;
        state.model = result.status === 'ready' ? result.model : null;
        state.text = result.status === 'ready' ? result.text : null;
      })
      .addCase(loadOntology.rejected, (state, action) => {
        if (action.meta.requestId !== state.requestId) return;
        state.status = 'error';
        state.model = null;
        state.text = null;
        state.error = (action.payload as OntologyState['error']) ?? { code: 'UNKNOWN', message: action.error.message ?? 'Loading failed.' };
      });
  },
});

export const ontologyReducer = ontologySlice.reducer;
