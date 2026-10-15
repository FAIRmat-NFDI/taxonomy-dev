import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

/**
 * Work in progress that is not a network request (e.g. laying out a graph).
 * Each task has an id (so start/end pair up) and a label shown in the busy overlay.
 */
export interface UiState {
  tasks: Record<string, string>;
}

const initialState: UiState = { tasks: {} };

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    busyStarted: (state, action: PayloadAction<{ id: string; label: string }>) => {
      state.tasks[action.payload.id] = action.payload.label;
    },
    busyEnded: (state, action: PayloadAction<string>) => {
      delete state.tasks[action.payload];
    },
  },
});

export const { busyStarted, busyEnded } = uiSlice.actions;
export const uiReducer = uiSlice.reducer;
