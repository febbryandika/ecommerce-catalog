import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    // Scoped to src/ so Playwright specs under e2e/ are never picked up.
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      reportsDirectory: './coverage',
      /**
       * Only the pure logic. Everything outside src/lib is either a React component, a Server
       * Action or a Drizzle query — none of which this suite executes, so including them would
       * report a large red block that says nothing except "Playwright covers this instead".
       *
       * Vitest 4 reports every file matched by `include` whether or not a test imported it, so
       * a module with no test at all still shows up at 0% rather than being silently absent —
       * that is the number worth acting on. (v3's `all: true` was removed; do not add it back.)
       */
      include: ['src/lib/**/*.ts'],
      exclude: [
        'src/lib/**/*.test.ts',
        // Structurally unreachable from a node-environment unit suite, and all covered by
        // Playwright instead. Listing them is the point: their absence from the report is a
        // decision, not an oversight.
        'src/lib/auth.ts', // next/headers, redirect(), the DB
        'src/lib/auth-client.ts', // a Better Auth client config object
        'src/lib/cart-queries.ts', // pure Drizzle; a unit test could only snapshot SQL
        'src/lib/cart-client.ts', // React hooks — vitest runs environment: 'node'
        'src/lib/wishlist-client.ts', // React hooks
        'src/lib/use-hydrated.ts', // React hook
      ],
      // No thresholds on purpose: the goal is to see what is uncovered, not to defend a number.
    },
  },
})
