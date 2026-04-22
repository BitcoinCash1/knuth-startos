import { setupManifest } from '@start9labs/start-sdk'

export const manifest = setupManifest({
  id: 'knuth',
  title: 'Knuth',
  license: 'MIT',
  packageRepo: 'https://github.com/BitcoinCash1/knuth-startos',
  upstreamRepo: 'https://github.com/k-nuth/kth',
  marketingUrl: 'https://kth.cash',
  donationUrl:
    'bitcoincash:qrlgfg2qkj3na2x9k7frvcmv06ljx5xlnuuwx95zfn',
  docsUrls: [
    'https://github.com/BitcoinCash1/knuth-startos/blob/master/README.md',
    'https://kth.cash/docs/',
    'https://github.com/k-nuth/kth',
  ],
  description: {
    short: 'Knuth — high-performance C++23 Bitcoin Cash full node',
    long:
      'Knuth is a high-performance Bitcoin Cash full node implementation written in C++23. It features a modular architecture and aggressive micro-architecture optimizations (prebuilt Haswell binaries) — a strong fit for wallets, exchanges, block explorers and miners. This package runs the P2P node only; Knuth does not expose a JSON-RPC server.',
  },
  volumes: ['main'],
  images: {
    knuth: {
      source: { dockerBuild: {} },
      arch: ['x86_64', 'aarch64'],
      emulateMissingAs: 'x86_64',
    },
  },
  alerts: {
    install:
      'Knuth will begin syncing the full Bitcoin Cash blockchain after installation. Initial Block Download may take several hours. Note: Knuth is a P2P-only node — it does not expose a JSON-RPC interface in this package.',
    update: null,
    uninstall:
      'Uninstalling Knuth will permanently delete all blockchain data and configuration. Ensure you have a backup before proceeding.',
    restore:
      'Restoring will overwrite current configuration. Blockchain data is not included in backups and will be re-synced.',
    start: null,
    stop: null,
  },
  dependencies: {
    tor: {
      description:
        'Enables Tor onion routing for anonymous peer-to-peer connections.',
      optional: true,
      metadata: {
        title: 'Tor',
        icon: 'https://raw.githubusercontent.com/Start9Labs/tor-startos/65faea17febc739d910e8c26ff4e61f6333487a8/icon.svg',
      },
    },
  },
})
