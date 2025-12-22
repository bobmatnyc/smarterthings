/**
 * Version information for mcp-smarterthings
 * This file is automatically updated during the release process
 */

// Version is synchronized with package.json during release
export const VERSION = '0.7.2';

// Build metadata (updated by build scripts)
export const BUILD_INFO = {
  version: VERSION,
  buildDate: '2025-12-22T17:33:43Z',
  gitCommit: '6e8d63ff40e45d52ddf2db2d49e847a7660f583f',
  gitBranch: 'main',
} as const;

/**
 * Get formatted version string with build info
 */
export function getVersionString(): string {
  return `${VERSION} (${BUILD_INFO.gitCommit.substring(0, 7)})`;
}

/**
 * Get full version information
 */
export function getFullVersionInfo(): typeof BUILD_INFO {
  return BUILD_INFO;
}
