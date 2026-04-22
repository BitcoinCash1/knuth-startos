import { sdk } from './sdk'
import { storeJson } from './fileModels/store.json'

export const setDependencies = sdk.setupDependencies(async ({ effects }) => {
  const store = await storeJson.read().const(effects)
  const torEnabled = store?.torEnabled ?? true

  if (torEnabled) {
    return {
      tor: {
        kind: 'running' as const,
        versionRange: '>=0.4.9.5:0',
        healthChecks: [] as string[],
      },
    }
  }

  return {}
})
