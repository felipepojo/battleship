import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, expect, vi } from 'vitest';

beforeEach(() => {
  vi.spyOn(console, 'error');
  vi.spyOn(console, 'warn');
});

afterEach(() => {
  cleanup();
  expect(console.error).not.toHaveBeenCalled();
  expect(console.warn).not.toHaveBeenCalled();
  vi.restoreAllMocks();
});
