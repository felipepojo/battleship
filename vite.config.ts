/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Served from https://felipepojo.github.io/battleship/. Set BASE_PATH=/ for hosts that serve from the root.
const base = process.env.BASE_PATH ?? '/battleship/';

export default defineConfig({
  base,
  plugins: [react()],
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
});
