import { defineConfig, sessionDrivers } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  output: 'server',
  adapter: cloudflare({ imageService: 'compile' }),
  session: { driver: sessionDrivers.memory() },
  vite: { plugins: [tailwindcss()] },
});
