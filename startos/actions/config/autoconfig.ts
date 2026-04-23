import { sdk } from '../../sdk'
import { fullConfigSpec, kthCfg } from '../../fileModels/kth.cfg'
import { storeJson } from '../../fileModels/store.json'

export const autoconfig = sdk.Action.withInput(
  'autoconfig',
  async ({ effects: _effects }) => ({
    name: 'Auto-Configure',
    description: 'Automatically configure Knuth for the needs of another service.',
    warning: null,
    allowedStatuses: 'any' as const,
    group: null,
    visibility: 'hidden' as const,
  }),
  async ({ effects: _effects, prefill }) => {
    if (!prefill) return fullConfigSpec
    return fullConfigSpec
      .filterFromPartial(prefill as typeof fullConfigSpec._PARTIAL)
      .disableFromPartial(
        prefill as typeof fullConfigSpec._PARTIAL,
        'These fields were provided by a task and cannot be edited',
      )
  },
  async ({ effects: _effects }) => {
    const [c, s] = await Promise.all([
      kthCfg.read().once(),
      storeJson.read().once(),
    ])
    return {
      threads: c?.network?.threads ?? 2,
      outbound_connections: c?.network?.outbound_connections ?? 8,
      inbound_connections: c?.network?.inbound_connections ?? 125,
      blockchain_cores: c?.blockchain?.cores ?? 0,
      relay_transactions: c?.node?.relay_transactions ?? true,
      verbose_logging: c?.log?.verbose ?? false,
      torEnabled: s?.torEnabled ?? true,
      advertiseClearnetInbound: s?.advertiseClearnetInbound ?? false,
    }
  },
  async ({ effects, input }) => {
    const cfgInput = input as Record<string, unknown>
    const networkKeys = [
      'threads',
      'outbound_connections',
      'inbound_connections',
      'manual_attempt_limit',
      'connect_batch_size',
      'host_pool_capacity',
      'channel_handshake_seconds',
      'channel_heartbeat_minutes',
      'channel_inactivity_minutes',
      'channel_expiration_minutes',
      'hosts_file',
    ] as const
    const blockchainMap: Record<string, string> = {
      blockchain_cores: 'cores',
      blockchain_priority: 'priority',
    }
    const nodeKeys = [
      'relay_transactions',
      'refresh_transactions',
      'compact_blocks_high_bandwidth',
      'ds_proofs',
    ] as const
    const dbKeys = [
      'db_max_size',
      'reorg_pool_limit',
      'safe_mode',
      'cache_capacity',
    ] as const
    const network: Record<string, unknown> = {}
    const blockchain: Record<string, unknown> = {}
    const node: Record<string, unknown> = {}
    const database: Record<string, unknown> = {}
    const log: Record<string, unknown> = {}
    for (const k of networkKeys) {
      if (cfgInput[k] !== undefined && cfgInput[k] !== null) network[k] = cfgInput[k]
    }
    for (const [from, to] of Object.entries(blockchainMap)) {
      if (cfgInput[from] !== undefined && cfgInput[from] !== null)
        blockchain[to] = cfgInput[from]
    }
    for (const k of nodeKeys) {
      if (cfgInput[k] !== undefined && cfgInput[k] !== null) node[k] = cfgInput[k]
    }
    for (const k of dbKeys) {
      if (cfgInput[k] !== undefined && cfgInput[k] !== null) database[k] = cfgInput[k]
    }
    if (cfgInput.verbose_logging !== undefined)
      log.verbose = cfgInput.verbose_logging
    if (cfgInput.log_rotation_size !== undefined)
      log.rotation_size = cfgInput.log_rotation_size

    await Promise.all([
      kthCfg.merge(effects, {
        ...(Object.keys(network).length && { network }),
        ...(Object.keys(blockchain).length && { blockchain }),
        ...(Object.keys(node).length && { node }),
        ...(Object.keys(database).length && { database }),
        ...(Object.keys(log).length && { log }),
      }),
      storeJson.merge(effects, {
        ...(cfgInput.torEnabled !== undefined && {
          torEnabled: !!cfgInput.torEnabled,
        }),
        ...(cfgInput.advertiseClearnetInbound !== undefined && {
          advertiseClearnetInbound: !!cfgInput.advertiseClearnetInbound,
        }),
      }),
    ])
  },
)
