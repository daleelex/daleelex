import type { RootState } from './store';
import { createSlice, PayloadAction } from '@reduxjs/toolkit';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  avatarUrl?: string;
}

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
}

// ─── Persistence helpers ──────────────────────────────────────────────────────

const STORAGE_KEY = 'daleelex_auth_user';

function persist(user: AuthUser | null) {
  try {
    if (user) localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* storage unavailable */
  }
}

function rehydrate(): AuthUser | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

// ─── Slice ────────────────────────────────────────────────────────────────────

const stored = rehydrate();

const initialState: AuthState = {
  user: stored,
  isAuthenticated: stored !== null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setUser(state, action: PayloadAction<AuthUser>) {
      state.user = action.payload;
      state.isAuthenticated = true;
      persist(action.payload);
      // Also store id for the existing getUserId() helper in top-bar
      localStorage.setItem('userId', action.payload.id);
    },
    clearUser(state) {
      state.user = null;
      state.isAuthenticated = false;
      persist(null);
      localStorage.removeItem('userId');
    },
    updateAvatar(state, action: PayloadAction<string>) {
      if (state.user) {
        state.user.avatarUrl = action.payload;
        persist(state.user);
      }
    },
  },
});

export const { setUser, clearUser, updateAvatar } = authSlice.actions;
export default authSlice.reducer;

// ─── Selectors ────────────────────────────────────────────────────────────────

export const selectUser = (s: RootState) => s.auth.user;
export const selectIsAuthenticated = (s: RootState) => s.auth.isAuthenticated;
export const selectDisplayName = (s: RootState) => (s.auth.user ? `${s.auth.user.firstName} ${s.auth.user.lastName}` : '');
export const selectRole = (s: RootState) => s.auth.user?.role ?? '';
export const selectInitials = (s: RootState) => {
  const u = s.auth.user;
  if (!u) return '?';
  return `${u.firstName.charAt(0)}${u.lastName.charAt(0)}`.toUpperCase();
};
