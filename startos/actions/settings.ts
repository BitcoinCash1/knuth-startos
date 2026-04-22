import { sdk } from '../sdk'
import { fullConfigSpec, kthCfg } from '../fileModels/kth.cfg'
import { storeJson } from '../fileModels/store.json'

export const advancedSettings = sdk.Action.withInput(
  'advanced-settings',
  async ({ effects: _effects }) => ({
    name: 'Advanced Settings',
    description: 'Edit Knuth node configuration (network, logging, Tor).',
    warning: null,
    allowedStatuses: 'any' as const,
    group: 'Configuration',
    visibility: 'enabled' as const,
  }),
  async ({ effects: _effects, prefill: _prefill }) => fullConfigSpec,
  async ({ effects }) => {
    const conf = await kthCfg.read().once()
    const store = await storeJson.read().once()
    return {
      threads: conf?.network?.threads ?? 2,
      outbound_connections: conf?.network?.outbound_connections ?? 8,
      inbound_connections: conf?.network?.inbound_connections ?? 125,
      blockchain_cores: conf?.blockchain?.cores ?? 0,
      relay_transactions: conf?.node?.relay_transactions ?? true,
      verbose_logging: conf?.log?.verbose ?? false,
      torEnabled: store?.torEnabled ?? true,
      advertiseClearnetInbound: store?.advertiseClearnetInbound ?? false,
    }
  },
  async ({ effects, input }) => {
    const {
      threads,
      outbound_connections,
      inbound_connections,
      blockchain_cores,
      relay_transactions,
      verbose_logging,
      torEnabled,
      advertiseClearnetInbound,
    } = input
    await kthCfg.merge(effects, {
      network: {
        threads,
        outbound_connections,
        inbound_connections,
      },
      blockchain: { cores: blockchain_cores },
      node: { relay_transactions },
      log: { verbose: verbose_logging },
    })
    await storeJson.merge(effects, {
      torEnabled: torEnabled ?? true,
      advertiseClearnetInbound: advertiseClearnetInbound ?? false,
    })
  },
)

export const autoconfig = sdk.Action.withInput(
  'autoconfig',
  async ({ effects: _effects }) => ({
    name: 'Auto-Configure',
    description: 'Automatically configure Knuth for another service.',
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
  async ({ effects }) => {
    const conf = await kthCfg.read().once()
    const store = await storeJson.read().once()
    return {
      threads: conf?.network?.threads ?? 2,
      outbound_connections: conf?.network?.outbound_connections ?? 8,
      inbound_connections: conf?.network?.inbound_connections ?? 125,
      blockchain_cores: conf?.blockchain?.cores ?? 0,
      relay_transactions: conf?.node?.relay_transactions ?? true,
      verbose_logging: conf?.log?.verbose ?? false,
      torEnabled: store?.torEnabled ?? true,
      advertiseClearnetInbound: store?.advertiseClearnetInbound ?? false,
    }
  },
  async ({ effects, input }) => {
    await kthCfg.merge(effects, {
      network: {
        threads: input.threads,
        outbound_connections: input.outbound_connections,
        inbound_connections: input.inbound_connections,
      },
      blockchain: { cores: input.blockchain_cores },
      node: { relay_transactions: input.relay_transactions },
      log: { verbose: input.verbose_logging },
    })
    await storeJson.merge(effects, {
      torEnabled: input.torEnabled ?? true,
      advertiseClearnetInbound: input.advertiseClearnetInbound ?? false,
    })
  },
)
