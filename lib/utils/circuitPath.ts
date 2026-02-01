/**
 * Circuit Path Resolver
 *
 * Resolves the path to privacycash circuit files.
 * Uses process.cwd() which works correctly in Next.js server environment
 * (including Vercel deployments where cwd is set to the app root).
 */

import * as path from 'path';

/**
 * Get the base path for ZK circuit files (transaction2.wasm and transaction2.zkey)
 */
export function getCircuitBasePath(): string {
  return path.join(
    process.cwd(),
    'node_modules',
    'privacycash',
    'circuit2',
    'transaction2'
  );
}

/**
 * Cached version to avoid repeated path.join calls
 */
let cachedPath: string | null = null;

export function getCircuitBasePathCached(): string {
  if (!cachedPath) {
    cachedPath = getCircuitBasePath();
  }
  return cachedPath;
}
