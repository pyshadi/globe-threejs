import { defineConfig } from 'vite';

// `npm run dev` serves the demo page, which imports the library straight from src/.
export default defineConfig({
    root: 'demo',
    server: {
        fs: { allow: ['..'] },
    },
});
