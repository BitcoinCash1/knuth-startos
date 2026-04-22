import { sdk } from '../../sdk'
import { storeJson } from '../../fileModels/store.json'

const { InputSpec, Value } = sdk

const networkSpec = InputSpec.of({
  network: Value.select({
    name: 'Network',
    description:
      'Bitcoin Cash network to connect to. Changing this requires a node restart.',
    warning:
      'Switching networks requires a full restart. The node will sync from scratch on the new network. Your mainnet data is preserved separately on disk.',
    values: {
      mainnet: 'Mainnet (production BCH)',
      chipnet: 'Chipnet (upgrade / chip testing)',
      testnet4: 'Testnet4 (public test network)',
    },
    default: 'mainnet',
  }),
})

export const networkConfig = sdk.Action.withInput(
  'network-config',
  async ({ effects: _effects }) => ({
    name: 'Network',
    description:
      'Select the Bitcoin Cash network. P2P ports adjust automatically for the selected network.',
    warning:
      'Changing the network requires a node restart. The P2P port will change to match the selected network.',
    allowedStatuses: 'any' as const,
    group: 'Configuration',
    visibility: 'enabled' as const,
  }),
  networkSpec,
  async ({ effects: _effects }) => {
    const store = await storeJson.read().once()
    return { network: store?.network ?? 'mainnet' }
  },
  async ({ effects, input }) => {
    const store = await storeJson.read().once()
    const prev = store?.network ?? 'mainnet'
    await storeJson.merge(effects, {
      network: input.network,
      fullySynced: false,
    })
    if (input.network !== prev) {
      await effects.restart()
    }
    return {
      version: '1' as const,
      title: 'Network Updated',
      message:
        input.network === prev
          ? `Already on ${input.network} — no change made.`
          : `Switched Knuth from ${prev} to ${input.network}. Restart triggered automatically.`,
      result: null,
    }
  },
)
