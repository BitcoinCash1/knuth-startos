import { VersionInfo } from '@start9labs/start-sdk'

export const v080 = VersionInfo.of({
  version: '0.80.0:0',
  releaseNotes:
    'Initial StartOS release of Knuth v0.80.0. High-performance C++23 Bitcoin Cash full node. P2P-only (no JSON-RPC in this package).',
  migrations: {
    up: async ({ effects }) => {},
    down: async ({ effects }) => {},
  },
})
