import { vi } from 'vitest';

const mockPage = {
  goto: vi.fn(),
  close: vi.fn(),
  url: vi.fn().mockReturnValue('about:blank'),
  title: vi.fn().mockResolvedValue(''),
  on: vi.fn(),
  context: vi.fn().mockReturnValue({}),
};

const mockContext = {
  newPage: vi.fn().mockResolvedValue(mockPage),
  close: vi.fn(),
  pages: vi.fn().mockReturnValue([mockPage]),
  setDefaultTimeout: vi.fn(),
  storageState: vi.fn().mockResolvedValue({}),
};

const mockBrowser = {
  newContext: vi.fn().mockResolvedValue(mockContext),
  close: vi.fn(),
  contexts: vi.fn().mockReturnValue([mockContext]),
};

const mockPlaywright = {
  chromium: {
    launch: vi.fn().mockResolvedValue(mockBrowser),
    launchPersistentContext: vi.fn().mockResolvedValue(mockContext),
    connectOverCDP: vi.fn().mockResolvedValue(mockBrowser),
  },
  firefox: {
    launch: vi.fn().mockResolvedValue(mockBrowser),
  },
  webkit: {
    launch: vi.fn().mockResolvedValue(mockBrowser),
  },
};

vi.mock('playwright-core', () => mockPlaywright);
vi.mock('playwright', () => mockPlaywright);

vi.mock('node-simctl', () => ({
  Simctl: vi.fn(),
}));

vi.mock('ws', () => ({
  WebSocketServer: vi.fn().mockImplementation(() => ({
    on: vi.fn(),
    close: vi.fn(),
  })),
  WebSocket: vi.fn(),
}));

vi.mock('@sparticuz/chromium', () => ({
  default: {},
}));
