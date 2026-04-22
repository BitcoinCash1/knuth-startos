import { sdk } from '../sdk'
import { kthCfg } from '../fileModels/kth.cfg'
import { storeJson } from '../fileModels/store.json'
import { dbDir, hostsCachePath, logDir, logDebugFile, logErrorFile } from '../utils'

export const seedFiles = sdk.setupOnInit(async (effects) => {
  const existing = await storeJson.read().once()
  if (!existing) {
    await storeJson.merge(effects, {
      network: 'mainnet',
      torEnabled: true,
      advertiseClearnetInbound: false,
      fullySynced: false,
    })
  }

  // Seed default kth.cfg if missing / empty.
  const existingConf = await kthCfg.read().once()
  if (!existingConf || Object.keys(existingConf).length === 0) {
    await kthCfg.merge(effects, {
      network: {
        threads: 2,
        inbound_connections: 125,
        outbound_connections: 8,
        hosts_file: hostsCachePath,
      },
      database: {
        directory: dbDir,
      },
      blockchain: {
        cores: 0,
      },
      node: {
        relay_transactions: true,
        refresh_transactions: true,
        compact_blocks_high_bandwidth: true,
        ds_proofs_enabled: true,
      },
      log: {
        archive_directory: `${logDir}/archive`,
        debug_file: logDebugFile,
        error_file: logErrorFile,
        rotation_size: 100_000_000,
        verbose: false,
      },
    })
  }
})
