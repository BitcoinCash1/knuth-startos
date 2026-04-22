import { FileHelper, z } from '@start9labs/start-sdk'
import { sdk } from '../sdk'

export const shape = z.object({
  network: z.enum(['mainnet', 'chipnet', 'testnet4']).catch('mainnet'),
  fullySynced: z.boolean().catch(false),
  reindexBlockchain: z.boolean().catch(false),
  reindexChainstate: z.boolean().catch(false),
  torEnabled: z.boolean().catch(true),
  advertiseClearnetInbound: z.boolean().catch(false),
  externalip: z.array(z.string()).catch([]),
})

export const storeJson = FileHelper.json(
  {
    base: sdk.volumes.main,
    subpath: 'store.json',
  },
  shape,
)
