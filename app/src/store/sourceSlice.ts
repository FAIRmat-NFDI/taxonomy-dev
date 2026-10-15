import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { config } from '@/config';

/** Which version of the ontology every view shows. */
export interface SourceState {
  branch: string;
}

const initialState: SourceState = { branch: config.source.branch };

const sourceSlice = createSlice({
  name: 'source',
  initialState,
  reducers: {
    branchSelected: (state, action: PayloadAction<string>) => {
      state.branch = action.payload;
    },
  },
});

export const { branchSelected } = sourceSlice.actions;
export const sourceReducer = sourceSlice.reducer;
