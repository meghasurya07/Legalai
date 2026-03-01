import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
    test: {
        environment: 'happy-dom',
        globals: true,
        setupFiles: ['./vitest.setup.ts'],
        include: ['__tests__/**/*.test.{ts,tsx}'],
        coverage: {
            provider: 'v8',
            include: ['lib/**', 'components/**'],
            exclude: ['node_modules', '.next', '__tests__'],
        },
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './'),
        },
    },
})
