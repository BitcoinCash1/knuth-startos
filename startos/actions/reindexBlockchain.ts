import { sdk } from '../sdk'
import { mainMounts } from '../mounts'
import { storeJson } from '../fileModels/store.json'
import { dbDir } from '../utils'

export const reindexBlockchain = sdk.Action.withoutInput(
  'reindex-blockchain',
  async ({ effects: _effects }) => ({
    name: 'Reindex Blockchain',
    description:
      'Delete the Knuth blockchain database and re-sync from scratch. This will take several hours.',
    warning:
      'All block data will be deleted. Knuth must re-download and verify the entire chain on next start.',
    allowedStatuses: 'only-stopped' as const,
    group: 'Maintenance',
    visibility: 'enabled' as const,
  }),
  async ({ effects }) => {
    await sdk.SubContainer.withTemp(
      effects,
      { imageId: 'knuth' },
      mainMounts,
      'reindex-blockchain',
      async (sub) => {
        await sub.exec(['sh', '-c', `rm -rf ${dbDir} && mkdir -p ${dbDir}`])
      },
    )
    await storeJson.merge(effects, {
      reindexBlockchain: true,
      fullySynced: false,
    })
    return {
      version: '1' as const,
      title: 'Blockchain Reset',
      message:
        'Blockchain database cleared. Knuth will re-sync from genesis on next start.',
      result: null,
    }
  },
)
