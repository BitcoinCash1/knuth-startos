import { sdk } from './sdk'
import {
  Network,
  configPath,
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

  // Force always-on node flags every boot so upgrades from older installs
  // (and manual edits) cannot disable transaction relay, mempool refresh,
  // double-spend proofs, or high-bandwidth compact blocks.
  await kthCfg.merge(effects, {
    node: {
      relay_transactions: true,
      refresh_transactions: true,
      compact_blocks_high_bandwidth: true,
      ds_proofs_enabled: true,
    },
  })

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

  // Knuth CLI: `kth -r -c <config>` initializes the LMDB blockchain database
  // on first run (if directory is empty/invalid) and then starts the node in
  // a single process. Equivalent to `--init_run`. See node-exe/src/main.cpp.
  const kthArgs: string[] = ['-r', '-c', configPath]

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

  // Rough height extraction from debug log. Knuth's log format is not
  // formally documented; we scan common patterns in reverse order so the
  // newest line wins.
  function extractHeightFromLog(text: string): number | null {
    const patterns = [
      /\bheight[^\d]{0,8}(\d{4,})/i,
      /\bblock[^\d]{0,8}(\d{4,})/i,
      /\btop[^\d]{0,8}(\d{4,})/i,
    ]
    for (const line of text.split(/\r?\n/).reverse()) {
      for (const re of patterns) {
        const m = re.exec(line)
        if (m) {
          const n = Number(m[1])
          if (Number.isFinite(n) && n > 0) return n
        }
      }
    }
    return null
  }

  // Rough estimate of current BCH chain tip: genesis 2009-01-03 @ ~10 min/block.
  // Used for progress % since Knuth exposes no RPC.
  function estimatedTip(): number {
    const GENESIS_TS = 1231006505
    const now = Math.floor(Date.now() / 1000)
    return Math.max(100_000, Math.floor((now - GENESIS_TS) / 600))
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

  // Count established TCP peer connections on the kth P2P port using `ss`.
  // Returns [total, inbound, outbound] or null on error.
  async function countPeers(
    port: number,
  ): Promise<{ total: number; inbound: number; outbound: number } | null> {
    try {
      const res = await kthSub.exec([
        'sh',
        '-c',
        `ss -ntnH state established 2>/dev/null || true`,
      ])
      const out = (res.stdout || '').toString()
      if (!out.trim()) return null
      let inbound = 0
      let outbound = 0
      for (const line of out.split(/\r?\n/)) {
        // ss -ntn columns: Recv-Q Send-Q Local-Address:Port Peer-Address:Port
        const parts = line.trim().split(/\s+/)
        if (parts.length < 4) continue
        const local = parts[2]
        const peer = parts[3]
        const localPort = Number(local.split(':').pop())
        const peerPortNum = Number(peer.split(':').pop())
        if (localPort === port) inbound += 1
        else if (peerPortNum === port) outbound += 1
      }
      return { total: inbound + outbound, inbound, outbound }
    } catch {
      return null
    }
  }

  return sdk.Daemons.of(effects)
    .addOneshot('nocow', {
      subcontainer: null,
      exec: {
        fn: async () => {
          // IMPORTANT: do NOT pre-create dbDir. kth's `verify_directory()`
          // treats any existing directory as an already-initialized chain
          // and skips `do_initchain`; that leads to "Error configuring LMDB
          // environment" when the node opens an empty LMDB dir. Only create
          // rootDir and log directories here; kth will create dbDir itself
          // during initchain on first run.
          try {
            for (const d of [rootDir, logDir, `${logDir}/archive`]) {
              const mkdirRes = await kthSub.exec(['mkdir', '-p', d])
              if (mkdirRes.exitCode !== 0) {
                console.warn(`nocow: mkdir failed for ${d}`)
              }
            }
            // Set NoCOW on rootDir; kth-created dbDir will inherit the
            // attribute when created under it (btrfs semantics).
            const chattrRes = await kthSub.exec(['chattr', '+C', rootDir])
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
          const log = await tailLog(600)
          if (!log) {
            return { message: 'Waiting for sync info', result: 'loading' }
          }
          const height = extractHeightFromLog(log)
          if (height == null) {
            return {
              message: 'Sync status unavailable from logs',
              result: 'loading',
            }
          }
          const tip = estimatedTip()
          const pct = Math.min(99.99, (height / tip) * 100)
          if (height >= tip - 2000) {
            return {
              message: `Synced — block ${height.toLocaleString()}`,
              result: 'success',
            }
          }
          return {
            message: `Syncing blocks... ${pct.toFixed(2)}% (block ${height.toLocaleString()})`,
            result: 'loading',
          }
        },
      },
      requires: ['primary'],
    })
    .addHealthCheck('peer-connections', {
      ready: {
        display: 'Peer Connections',
        fn: async () => {
          const counts = await countPeers(peerPort)
          if (!counts) {
            return {
              message: 'Unable to query peers',
              result: 'loading',
            }
          }
          if (counts.total === 0) {
            return {
              message: 'No peer connections established yet',
              result: 'loading',
            }
          }
          return {
            message: `${counts.total} peers (${counts.outbound} outbound, ${counts.inbound} inbound)`,
            result: 'success',
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
