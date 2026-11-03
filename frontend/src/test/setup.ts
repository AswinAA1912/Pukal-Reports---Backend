import "@testing-library/jest-dom";
import { vi, beforeEach } from "vitest";

// Mock window.matchMedia for MUI useMediaQuery
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock ResizeObserver for Recharts / ResponsiveContainer
global.ResizeObserver = class ResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
};

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  root = null;
  rootMargin = "";
  thresholds = [];
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  takeRecords = vi.fn().mockReturnValue([]);
};

// Mock HTMLCanvasElement getContext
HTMLCanvasElement.prototype.getContext = vi.fn() as any;

// Mock scrollTo and open
window.scrollTo = vi.fn() as any;
window.open = vi.fn() as any;

// Mock localStorage with default authenticated session
const defaultStorage: Record<string, string> = {
  AUTH_ID: "test-auth-token",
  COMPANY_ID: "1",
  COMPANY_API: "http://localhost:5000",
  user: JSON.stringify({
    id: 1,
    uniqueName: "Admin",
    Name: "Administrator",
    companyId: 1,
    Company_Name: "Test Company",
    Global_User_Id: "USR-001",
    UserTypeId: "0",
  }),
  companies: JSON.stringify([
    { id: 1, name: "Test Company", api: "http://localhost:5000" },
  ]),
};

let storageState: Record<string, string> = { ...defaultStorage };

const localStorageMock = {
  getItem: (key: string) => storageState[key] || null,
  setItem: (key: string, value: string) => {
    storageState[key] = value.toString();
  },
  removeItem: (key: string) => {
    delete storageState[key];
  },
  clear: () => {
    storageState = {};
  },
};

Object.defineProperty(window, "localStorage", {
  value: localStorageMock,
  writable: true,
});

beforeEach(() => {
  storageState = { ...defaultStorage };
});

// Smart safe mock data supporting both array and { rows: [] } formats
const createSmartMockData = () => {
  const arr: any = [];
  arr.rows = [];
  arr.data = [];
  return {
    success: true,
    data: arr,
    rows: [],
  };
};

// Mock global fetch
global.fetch = vi.fn().mockImplementation(() =>
  Promise.resolve({
    ok: true,
    status: 200,
    headers: new Headers({ "content-type": "application/json" }),
    json: () => Promise.resolve(createSmartMockData()),
    text: () => Promise.resolve(JSON.stringify(createSmartMockData())),
  } as any)
);

// Mock axios
vi.mock("axios", () => {
  const mockAxios: any = {
    get: vi.fn(() => Promise.resolve({ data: createSmartMockData() })),
    post: vi.fn(() => Promise.resolve({ data: createSmartMockData() })),
    put: vi.fn(() => Promise.resolve({ data: createSmartMockData() })),
    delete: vi.fn(() => Promise.resolve({ data: createSmartMockData() })),
    patch: vi.fn(() => Promise.resolve({ data: createSmartMockData() })),
    create: vi.fn(() => mockAxios),
    interceptors: {
      request: { use: vi.fn(), eject: vi.fn() },
      response: { use: vi.fn(), eject: vi.fn() },
    },
    defaults: {
      headers: {
        common: {},
      },
    },
  };
  return {
    default: mockAxios,
    ...mockAxios,
  };
});
