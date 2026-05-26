import { defineConfig } from 'vitest/config';

export const config = defineConfig({
  resolve: {
    alias: {
      obsidian: 'obsidian-test-mocks/obsidian'
    }
  },
  test: {
    coverage: {
      exclude: [
        'src/**/*.test.ts'
      ],
      include: ['src/**/*.ts'],
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      reportsDirectory: './coverage'
    },
    environment: 'jsdom',
    globals: false,
    include: ['src/**/*.test.ts'],
    onConsoleLog: (): false => false,
    server: {
      deps: {
        inline: ['@obsidian-typings', 'obsidian-dev-utils']
      }
    },
    setupFiles: [
      'obsidian-test-mocks/vitest-setup',
      'obsidian-test-mocks/obsidian-typings/vitest-setup'
    ]
  }
});
