import { sdk } from './sdk'
import {
  Network,
  configPath,
  dbDir,
  logDir,
  logDebugFile,
  networkPorts,
  rootDir,
} from './utils'
import { kthCfg } from './fileModels/kth.cfg'
import { storeJson } from './fileModels/store.json'
import { mainMounts } from './mounts'

export { mainMounts }

export const main = sdk.setupMain(async ({ effects }) => {
  console.log('Starting Knuth (kth)!')

  const conf = await kthCfg.read().const(effects)
  const store = await storeJson.read().once()
  const network: Network =
    store?.network === 'chipnet' || store?.network === 'testnet4'
      ? store.network
      : 'mainnet'
  const { peer: peerPort } = networkPorts[network]
  const torEnabled = store?.torEnabled ?? true

  // Reindex flags (one-shot)
  const reindexBlockchain = store?.reindexBlockchain ?? false
  const reindexChainstate = store?.reindexChainstate ?? false
  if (reindexBlockchain || reindexChainstate) {
    await storeJson.merge(effects, {
      reindexBlockchain: false,
      reindexChainstate: false,
    })
  }

  // Track Tor availability (informational — kth does not consume SOCKS).
  const torIp = torEnabled
    ? await sdk.getContainerIp(effects, { packageId: 'tor' }).const()
    : null
  let torRunning = false
  if (torIp) {
    sdk.getStatus(effects, { packageId: 'tor' }).onChange((status) => {
      torRunning = status?.desired.main === 'running'
      return { cancel: false }
    })
  }

  // Knuth CLI: `kth -c <config>`. The binary also accepts `--help` flag.
  const kthArgs: string[] = ['-c', configPath]

  const kthSub = await sdk.SubContainer.of(
    effects,
    { imageId: 'knuth' },
    mainMounts,
    'node-sub',
  )

  // Log-tail helper: fetch last N lines of kth debug.log via subcontainer.
  async function tailLog(lines = 200): Promise<string> {
    try {
      const res = await kthSub.exec([
        'sh',
        '-c',
        `tail -n ${lines} ${logDebugFile} 2>/dev/null || true`,
      ])
      return (res.stdout || '').toString()
    } catch {
      return ''
    }
  }

  // Very rough height extraction: look for a "height" or "block" token in the
  // last lines of the log. Knuth log format is not formally documented; we
  // scan for common patterns and fall back to "process alive" if none match.
  function extractHeightFromLog(text: string): number | null {
    const heightRe = /height[^\d]{0,6}(\d{3,})/i
    const blockRe = /block[^\d]{0,6}(\d{3,})/i
    for (const line of text.split(/\r?\n/).reverse()) {
      const m = heightRe.exec(line) || blockRe.exec(line)
      if (m) return Number(m[1])
    }
    return null
  }

  async function processAlive(): Promise<boolean> {
    try {
      const res = await kthSub.exec(['sh', '-c', 'pgrep -c kth || true'])
      const n = Number((res.stdout || '0').toString().trim())
      return Number.isFinite(n) && n > 0
    } catch {
      return false
    }
  }

  return sdk.Daemons.of(effects)
    .addOneshot('nocow', {
      subcontainer: null,
      exec: {
        fn: async () => {
          try {
            for (const d of [rootDir, dbDir, logDir, `${logDir}/archive`]) {
              const mkdirRes = await kthSub.exec(['mkdir', '-p', d])
              if (mkdirRes.exitCode !== 0) {
                console.warn(`nocow: mkdir failed for ${d}`)
              }
            }
            const chattrRes = await kthSub.exec(['chattr', '-R', '+C', rootDir])
            if (chattrRes.exitCode !== 0) {
              console.warn(
                `nocow: chattr not applied for ${rootDir}; continuing startup`,
              )
            }
          } catch (err) {
            console.warn(
              'nocow: unable to set NoCOW attributes; continuing startup',
              err,
            )
          }
          return null
        },
      },
      requires: [],
    })
    .addDaemon('primary', {
      subcontainer: kthSub,
      exec: {
        command: ['kth', ...kthArgs],
        sigtermTimeout: 300_000,
      },
      ready: {
        display: 'Knuth',
        fn: async () => {
          const alive = await processAlive()
          if (!alive) {
            return { message: 'Knuth is starting...', result: 'starting' }
          }
          const log = await tailLog(60)
          if (!log) {
            return { message: 'Knuth is starting...', result: 'starting' }
          }
          return { message: 'Knuth is running', result: 'success' }
        },
      },
      requires: ['nocow'],
    })
    .addHealthCheck('sync-progress', {
      ready: {
        display: 'Blockchain Sync',
        fn: async () => {
          const log = await tailLog(400)
          if (!log) {
            return { message: 'Waiting for sync info', result: 'loading' }
          }
          const height = extractHeightFromLog(log)
          if (height == null) {
            // Height unknown but log writing → node is up but early in sync.
            return { message: 'Sync status unavailable from logs', result: 'loading' }
          }
          // BCH mainnet is around ~890k+ blocks (2026). If we see a height
          // within 2000 of rough current tip we call it synced. Otherwise
          // "loading". Rough tip calculation: 2016-01-03 genesis to now @ ~10min.
          const roughTipLowerBound = Math.floor(
            (Date.now() / 1000 - 1609459200) / 600 + 660_000,
          )
          if (height >= roughTipLowerBound - 2000) {
            return {
              message: `Synced — block ${height.toLocaleString()}`,
              result: 'success',
            }
          }
          return {
            message: `Syncing blocks... height ${height.toLocaleString()}`,
            result: 'loading',
          }
        },
      },
      requires: ['primary'],
    })
    .addOneshot('synced-true', {
      subcontainer: null,
      exec: {
        fn: async () => {
          const currentStore = await storeJson.read().once()
          if (!currentStore?.fullySynced) {
            await storeJson.merge(effects, { fullySynced: true })
          }
          return null
        },
      },
      requires: ['sync-progress'],
    })
    .addHealthCheck('peer-connections', {
      ready: {
        display: 'Peer Connections',
        fn: async () => {
          const log = await tailLog(400)
          if (!log) {
            return { message: 'Unable to query peers', result: 'loading' }
          }
          // Heuristic: count lines mentioning "connected" or "handshake" peers
          const peerRe = /peer[^\n]*\b(connected|handshake|height)\b/gi
          const matches = log.match(peerRe) ?? []
          const count = matches.length
          if (count === 0) {
            return {
              message: 'No peer activity in recent logs',
              result: 'loading',
            }
          }
          return {
            message: `Active peer activity (${count} recent log events)`,
            result: 'success',
          }
        },
      },
      requires: ['primary'],
    })
    .addHealthCheck('tor', {
      ready: {
        display: 'Tor',
        fn: () => {
          if (!torEnabled)
            return {
              result: 'disabled' as const,
              message: 'Tor is disabled in settings',
            }
          if (!torIp)
            return {
              result: 'disabled' as const,
              message: 'Tor package is not installed',
            }
          if (!torRunning)
            return {
              result: 'disabled' as const,
              message: 'Tor package is not running',
            }
          return {
            result: 'success' as const,
            message:
              'Tor package is reachable. Note: Knuth does not natively consume a SOCKS proxy; Tor here provides inbound onion reachability only.',
          }
        },
      },
      requires: [],
    })
    .addHealthCheck('clearnet', {
      ready: {
        display: 'Clearnet',
        fn: () => {
          const externalip = store?.externalip ?? []
          return {
            result: 'success' as const,
            message: externalip.some(
              (ip: string) => ip && !ip.includes('.onion'),
            )
              ? 'Inbound and outbound connections'
              : 'Outbound only. Publish an IP address to enable inbound.',
          }
        },
      },
      requires: [],
    })
})
