import { defineConfig } from 'vitest/config';

// Two pages: the public landing page (/) and the staff scheduling app (/app/).
export default defineConfig({
  build: {
    // Top-level await (main.ts waits for sign-in). Supported by Chrome/Edge 89+, Firefox 89+, Safari 15+.
    target: 'es2022',
    rollupOptions: {
      input: {
        main: new URL('./index.html', import.meta.url).pathname,
        app: new URL('./app/index.html', import.meta.url).pathname,
      },
    },
  },
  test: { include: ['tests/unit/**/*.test.ts'] },
});
