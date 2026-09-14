import { defineConfig } from 'vite';

// `npm run dev` serves the demo page, which imports the library straight from src/.
// `npm run build` builds the demo into dist/.
export default defineConfig({
    root: 'demo',
    build: {
        outDir: '../dist',
        emptyOutDir: true,
    },
    server: {
        fs: { allow: ['..'] },
    },
});
