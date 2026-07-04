import { configureStore } from '@reduxjs/toolkit';
import authReducer from './authSlice';
import { useDispatch, useSelector, type TypedUseSelectorHook } from 'react-redux';

// Add your other existing reducers alongside auth here
export const store = configureStore({
  reducer: {
    auth: authReducer,
    // e.g. alarms: alarmsReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

// ─── Typed hooks — use these instead of plain useSelector/useDispatch ─────────
export const useAppDispatch: () => AppDispatch = useDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
