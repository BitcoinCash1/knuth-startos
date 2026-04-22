import { VersionInfo } from '@start9labs/start-sdk'

export const v0_80_0_1 = VersionInfo.of({
  version: '0.80.0:1',
  releaseNotes:
    'Knuth v0.80.0 packaging improvements:\n' +
    '- Dashboard: shows sync percentage alongside block height (e.g. "Syncing blocks... 21.57% (block 190,000)").\n' +
    '- Dashboard: Peer Connections now counts actual established TCP sessions on the P2P port instead of log heuristics.\n' +
    '- Branding: replaced icon with the official Knuth logo.\n' +
    '- Configuration: refactored Advanced Settings into grouped sections (Network, Peers, Other) mirroring the BCHN package layout, and exposed many more kth.cfg flags.\n' +
    '- Multi-arch: native aarch64 builds in addition to x86_64 (Knuth Conan packages are source-built on arm64).\n' +
    '- Runtime image: added iproute2 for peer-count diagnostics.',
  migrations: {
    up: async ({ effects: _effects }) => {},
    down: async ({ effects: _effects }) => {},
  },
})
