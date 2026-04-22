import { sdk } from '../sdk'
import { mainMounts } from '../mounts'
import { hostsCachePath } from '../utils'

export const deletePeers = sdk.Action.withoutInput(
  'delete-peers',
  async ({ effects: _effects }) => ({
    name: 'Delete Peer List',
    description:
      'Delete the hosts cache to reset known peers. Knuth will rebuild the peer list from DNS seeds on next startup.',
    warning:
      'All known peer addresses will be lost. The node will need to rediscover peers, which may take a few minutes.',
    allowedStatuses: 'only-stopped' as const,
    group: 'Maintenance',
    visibility: 'enabled' as const,
  }),
  async ({ effects }) => {
    await sdk.SubContainer.withTemp(
      effects,
      { imageId: 'knuth' },
      mainMounts,
      'delete-peers',
      async (sub) => {
        await sub.exec(['sh', '-c', `rm -f ${hostsCachePath}`])
      },
    )
    return {
      version: '1' as const,
      title: 'Peer List Deleted',
      message:
        'Hosts cache removed. Knuth will rebuild the peer list on next startup.',
      result: null,
    }
  },
)
