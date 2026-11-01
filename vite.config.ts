import { defineConfig } from 'vitest/config';

// Two pages: the public landing page (/) and the staff scheduling app (/app/).
export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: new URL('./index.html', import.meta.url).pathname,
        app: new URL('./app/index.html', import.meta.url).pathname,
      },
    },
  },
  test: { include: ['tests/unit/**/*.test.ts'] },
});
