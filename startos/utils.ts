import { StartSdk } from '@start9labs/start-sdk'
import { manifest } from './manifest'

/**
 * Plumbing. DO NOT EDIT.
 */
export const sdk = StartSdk.of().withManifest(manifest).build(true)

export const NETWORKS = ['mainnet', 'chipnet', 'testnet4'] as const
export type Network = (typeof NETWORKS)[number]

// Knuth uses the standard BCH ports. No JSON-RPC server in this package.
export const networkPorts: Record<Network, { peer: number }> = {
  mainnet: { peer: 8333 },
  chipnet: { peer: 48333 },
  testnet4: { peer: 28333 },
}

export const peerPort = networkPorts.mainnet.peer
export const peerInterfaceId = 'peer'
export const rootDir = '/data'
export const configPath = `${rootDir}/kth.cfg`
export const hostsCachePath = `${rootDir}/hosts.cache`
export const dbDir = `${rootDir}/blockchain`
export const logDir = `${rootDir}/log`
export const logDebugFile = `${logDir}/node-bch-mainnet-debug.log`
export const logErrorFile = `${logDir}/node-bch-mainnet-error.log`
