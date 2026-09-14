import { defineConfig } from 'vite';

// `npm run dev` serves the demo page, which imports the library straight from src/.
// `npm run build` builds the demo into dist/, which is deployed to GitHub Pages.
export default defineConfig({
    root: 'demo',
    // Relative asset paths, so the build works under https://pyshadi.github.io/globe-threejs/
    base: './',
    build: {
        outDir: '../dist',
        emptyOutDir: true,
    },
    server: {
        fs: { allow: ['..'] },
    },
});
