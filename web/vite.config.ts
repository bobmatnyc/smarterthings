import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],

	resolve: {
		extensions: ['.js', '.ts', '.svelte']
	},

	server: {
		port: 5181,
		host: true, // Allow access from any host (including ngrok)
		allowedHosts: [
			'localhost',
			'127.0.0.1',
			'.ngrok.app', // Allow all ngrok subdomains
			'.ngrok-free.app', // Allow ngrok free tier
			'smarty.ngrok.app', // Specific ngrok subdomain
		],
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
