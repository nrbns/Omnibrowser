/**
 * Vitest Test Setup
 * This file runs before all tests
 */

import { expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import React from 'react';

// Mock framer-motion at the top level - must be hoisted before any imports
// This prevents React context errors when testing components with framer-motion
vi.mock('framer-motion', () => {
  return {
    motion: {
      div: React.forwardRef((props: any, ref: any) =>
        React.createElement('div', { ...props, ref })
      ),
      span: React.forwardRef((props: any, ref: any) =>
        React.createElement('span', { ...props, ref })
      ),
      button: React.forwardRef((props: any, ref: any) =>
        React.createElement('button', { ...props, ref })
      ),
      section: React.forwardRef((props: any, ref: any) =>
        React.createElement('section', { ...props, ref })
      ),
      header: React.forwardRef((props: any, ref: any) =>
        React.createElement('header', { ...props, ref })
      ),
      footer: React.forwardRef((props: any, ref: any) =>
        React.createElement('footer', { ...props, ref })
      ),
      nav: React.forwardRef((props: any, ref: any) =>
        React.createElement('nav', { ...props, ref })
      ),
      main: React.forwardRef((props: any, ref: any) =>
        React.createElement('main', { ...props, ref })
      ),
      aside: React.forwardRef((props: any, ref: any) =>
        React.createElement('aside', { ...props, ref })
      ),
      article: React.forwardRef((props: any, ref: any) =>
        React.createElement('article', { ...props, ref })
      ),
      p: React.forwardRef((props: any, ref: any) => React.createElement('p', { ...props, ref })),
      h1: React.forwardRef((props: any, ref: any) => React.createElement('h1', { ...props, ref })),
      h2: React.forwardRef((props: any, ref: any) => React.createElement('h2', { ...props, ref })),
      h3: React.forwardRef((props: any, ref: any) => React.createElement('h3', { ...props, ref })),
      ul: React.forwardRef((props: any, ref: any) => React.createElement('ul', { ...props, ref })),
      li: React.forwardRef((props: any, ref: any) => React.createElement('li', { ...props, ref })),
    },
    AnimatePresence: ({ children }: any) => children,
    useAnimation: () => ({
      start: vi.fn(),
      stop: vi.fn(),
      set: vi.fn(),
      controls: {},
    }),
    useMotionValue: vi.fn(() => ({ get: vi.fn(), set: vi.fn() })),
    useTransform: vi.fn(() => vi.fn()),
  };
});

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock sessionStorage
const sessionStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();
Object.defineProperty(window, 'sessionStorage', {
  value: sessionStorageMock,
});
