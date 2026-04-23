import { sdk } from '../../sdk'
import { fullConfigSpec, kthCfg } from '../../fileModels/kth.cfg'
import { storeJson } from '../../fileModels/store.json'

export const otherConfig = sdk.Action.withInput(
  'other-config',
  async ({ effects: _effects }) => ({
    name: 'Node & Mempool Settings',
    description:
      'Validation, mempool, LMDB database, logging, and Tor/clearnet advertisement.',
    warning: null,
    allowedStatuses: 'any' as const,
    group: 'Configuration',
    visibility: 'enabled' as const,
  }),
  fullConfigSpec.filter({
    blockchain_cores: true,
    blockchain_priority: true,
    compact_blocks_high_bandwidth: true,
    db_max_size: true,
    reorg_pool_limit: true,
    safe_mode: true,
    cache_capacity: true,
    verbose_logging: true,
    log_rotation_size: true,
    torEnabled: true,
    advertiseClearnetInbound: true,
  }),
  async ({ effects: _effects }) => {
    const [c, s] = await Promise.all([
      kthCfg.read().once(),
      storeJson.read().once(),
    ])
    return {
      blockchain_cores: c?.blockchain?.cores ?? 0,
      blockchain_priority: c?.blockchain?.priority ?? true,
      compact_blocks_high_bandwidth:
        c?.node?.compact_blocks_high_bandwidth ?? true,
      db_max_size: c?.database?.db_max_size ?? null,
      reorg_pool_limit: c?.database?.reorg_pool_limit ?? null,
      safe_mode: c?.database?.safe_mode ?? false,
      cache_capacity: c?.database?.cache_capacity ?? null,
      verbose_logging: c?.log?.verbose ?? false,
      log_rotation_size: c?.log?.rotation_size ?? 100_000_000,
      torEnabled: s?.torEnabled ?? true,
      advertiseClearnetInbound: s?.advertiseClearnetInbound ?? false,
    }
  },
  async ({ effects, input }) => {
    await Promise.all([
      kthCfg.merge(effects, {
        blockchain: {
          cores: input.blockchain_cores,
          priority: input.blockchain_priority,
        },
        node: {
          relay_transactions: true,
          refresh_transactions: true,
          compact_blocks_high_bandwidth: input.compact_blocks_high_bandwidth,
          ds_proofs: true,
        },
        database: {
          ...(input.db_max_size != null && { db_max_size: input.db_max_size }),
          ...(input.reorg_pool_limit != null && {
            reorg_pool_limit: input.reorg_pool_limit,
          }),
          safe_mode: input.safe_mode,
          ...(input.cache_capacity != null && {
            cache_capacity: input.cache_capacity,
          }),
        },
        log: {
          verbose: input.verbose_logging,
          ...(input.log_rotation_size != null && {
            rotation_size: input.log_rotation_size,
          }),
        },
      }),
      storeJson.merge(effects, {
        torEnabled: input.torEnabled ?? true,
        advertiseClearnetInbound: input.advertiseClearnetInbound ?? false,
      }),
    ])
  },
)
