import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],

	resolve: {
		extensions: ['.js', '.ts', '.svelte']
	},

	server: {
		port: 5181,
		proxy: {
			'/api': {
				target: 'http://localhost:5182',
				changeOrigin: true,
			},
			'/auth': {
				target: 'http://localhost:5182',
				changeOrigin: true,
			},
			'/health': {
				target: 'http://localhost:5182',
				changeOrigin: true,
			}
		}
	},

	build: {
		target: 'esnext',
		minify: 'esbuild'
	}
});
