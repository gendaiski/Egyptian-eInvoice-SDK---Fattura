/**
 * Vercel entry: one Node function serves everything under /api (see scripts/build-vercel.mjs).
 * Static files and the SPA fallback are served by Vercel's CDN.
 */
import { getRequestListener } from '@hono/node-server';
import { createApp } from './src/app';

export default getRequestListener(createApp().fetch);
