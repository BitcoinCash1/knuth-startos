import { sdk } from '../sdk'
import { mainMounts } from '../mounts'
import { logDebugFile, logErrorFile } from '../utils'

export const runtimeInfo = sdk.Action.withoutInput(
  'runtime-info',
  async ({ effects: _effects }) => ({
    name: 'Node Info',
    description:
      'Display recent log output from Knuth. Since Knuth has no JSON-RPC server, node state is summarized from the debug and error logs.',
    warning: null,
    allowedStatuses: 'only-running' as const,
    group: null,
    visibility: 'enabled' as const,
  }),
  async ({ effects }) => {
    return sdk.SubContainer.withTemp(
      effects,
      { imageId: 'knuth' },
      mainMounts,
      'runtime-info',
      async (sub) => {
        const debugRes = await sub.exec([
          'sh',
          '-c',
          `tail -n 80 ${logDebugFile} 2>/dev/null || true`,
        ])
        const errRes = await sub.exec([
          'sh',
          '-c',
          `tail -n 40 ${logErrorFile} 2>/dev/null || true`,
        ])
        const versionRes = await sub
          .exec(['sh', '-c', 'kth --version 2>&1 || kth --help 2>&1 | head -5'])
          .catch(() => null)

        const parts = [
          `# Version`,
          (versionRes?.stdout || '').toString().trim() || 'unknown',
          ``,
          `# Recent debug log (last 80 lines)`,
          (debugRes.stdout || '').toString().trim() || '(empty)',
          ``,
          `# Recent error log (last 40 lines)`,
          (errRes.stdout || '').toString().trim() || '(empty)',
        ]

        return {
          version: '1' as const,
          title: 'Knuth Runtime Info',
          message: null,
          result: {
            type: 'single' as const,
            value: parts.join('\n'),
            copyable: true,
            qr: false,
            masked: false,
          },
        }
      },
    )
  },
)
