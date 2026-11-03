// store.ts
import { configureStore, createSlice, type PayloadAction } from "@reduxjs/toolkit";

/* ================= DUMMY USER SLICE ================= */
interface UserState {
  token: string | null;
  name: string | null;
}

const initialUserState: UserState = {
  token: null,
  name: null,
};

const userSlice = createSlice({
  name: "user",
  initialState: initialUserState,
  reducers: {
    setUser: (state, action: PayloadAction<{ token: string; name: string }>) => {
      state.token = action.payload.token;
      state.name = action.payload.name;
    },
    clearUser: (state) => {
      state.token = null;
      state.name = null;
    },
  },
});

/* ================= DUMMY REPORTS SLICE ================= */
interface ReportsState {
  data: any[];
  loading: boolean;
}

const initialReportsState: ReportsState = {
  data: [],
  loading: false,
};

const reportsSlice = createSlice({
  name: "reports",
  initialState: initialReportsState,
  reducers: {
    setReports: (state, action: PayloadAction<any[]>) => {
      state.data = action.payload;
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
  },
});

/* ================= CONFIGURE STORE ================= */
export const store = configureStore({
  reducer: {
    user: userSlice.reducer,
    reports: reportsSlice.reducer,
  },
});

/* ================= EXPORT ACTIONS ================= */
export const { setUser, clearUser } = userSlice.actions;
export const { setReports, setLoading } = reportsSlice.actions;

/* ================= EXPORT TYPES ================= */
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
