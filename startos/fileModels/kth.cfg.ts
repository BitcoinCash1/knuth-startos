import { FileHelper, z } from '@start9labs/start-sdk'
import { sdk } from '../sdk'

/**
 * Knuth (kth) configuration file.
 *
 * kth uses a Boost property-tree INI variant with explicit `[section]` headers.
 * The stock FileHelper.ini helper is flat (no sections), so we serialize /
 * deserialize manually with FileHelper.raw.
 *
 * Sections currently modelled:
 *   [network]     threads, inbound_connections, outbound_connections, hosts_file
 *   [database]    directory, flush_writes
 *   [blockchain]  cores
 *   [node]        relay_transactions
 *   [log]         archive_directory, debug_file, error_file, rotation_size, verbose
 *
 * Any keys not modelled here are passed through untouched on merge.
 */

export const kthCfgShape = z
  .object({
    network: z
      .object({
        threads: z.number().int().optional(),
        inbound_connections: z.number().int().optional(),
        outbound_connections: z.number().int().optional(),
        manual_attempt_limit: z.number().int().optional(),
        connect_batch_size: z.number().int().optional(),
        inbound_port: z.number().int().optional(),
        identifier: z.number().int().optional(),
        channel_handshake_seconds: z.number().int().optional(),
        channel_heartbeat_minutes: z.number().int().optional(),
        channel_inactivity_minutes: z.number().int().optional(),
        channel_expiration_minutes: z.number().int().optional(),
        channel_germination_seconds: z.number().int().optional(),
        host_pool_capacity: z.number().int().optional(),
        enable_upnp: z.boolean().optional(),
        hosts_file: z.string().optional(),
        user_agent: z.string().optional(),
      })
      .optional(),
    database: z
      .object({
        directory: z.string().optional(),
        db_max_size: z.number().int().optional(),
        reorg_pool_limit: z.number().int().optional(),
        safe_mode: z.boolean().optional(),
        cache_capacity: z.number().int().optional(),
      })
      .optional(),
    blockchain: z
      .object({
        cores: z.number().int().optional(),
        priority: z.boolean().optional(),
        use_libconsensus: z.boolean().optional(),
        block_buffer_limit: z.number().int().optional(),
        first_boot_hard_ram: z.number().int().optional(),
      })
      .optional(),
    node: z
      .object({
        relay_transactions: z.boolean().optional(),
        refresh_transactions: z.boolean().optional(),
        compact_blocks_high_bandwidth: z.boolean().optional(),
        block_poll_seconds: z.number().int().optional(),
        transaction_pool_capacity: z.number().int().optional(),
        ds_proofs_enabled: z.boolean().optional(),
      })
      .optional(),
    log: z
      .object({
        archive_directory: z.string().optional(),
        debug_file: z.string().optional(),
        error_file: z.string().optional(),
        rotation_size: z.number().int().optional(),
        verbose: z.boolean().optional(),
      })
      .optional(),
  })
  .passthrough()

export type KthCfg = z.infer<typeof kthCfgShape>

function serialize(cfg: KthCfg): string {
  const lines: string[] = [
    '# Knuth (kth) configuration — managed by StartOS',
    '# Do not edit directly; changes may be overwritten.',
    '',
  ]
  for (const [section, kvs] of Object.entries(cfg)) {
    if (kvs == null || typeof kvs !== 'object') continue
    lines.push(`[${section}]`)
    for (const [key, val] of Object.entries(kvs as Record<string, unknown>)) {
      if (val === undefined || val === null) continue
      const out =
        typeof val === 'boolean' ? (val ? 'true' : 'false') : String(val)
      lines.push(`${key} = ${out}`)
    }
    lines.push('')
  }
  return lines.join('\n')
}

function deserialize(raw: string): KthCfg {
  const cfg: Record<string, Record<string, unknown>> = {}
  let current: Record<string, unknown> | null = null
  for (const rawLine of raw.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#') || line.startsWith(';')) continue
    const sect = /^\[(.+)\]$/.exec(line)
    if (sect) {
      const name = sect[1].trim()
      if (!cfg[name]) cfg[name] = {}
      current = cfg[name]
      continue
    }
    const eq = line.indexOf('=')
    if (eq < 0 || current == null) continue
    const key = line.slice(0, eq).trim()
    const valRaw = line.slice(eq + 1).trim()
    let val: unknown = valRaw
    if (valRaw === 'true') val = true
    else if (valRaw === 'false') val = false
    else if (/^-?\d+$/.test(valRaw)) val = Number(valRaw)
    current[key] = val
  }
  return kthCfgShape.parse(cfg)
}

export const kthCfg = FileHelper.raw<KthCfg>(
  {
    base: sdk.volumes.main,
    subpath: 'kth.cfg',
  },
  serialize,
  deserialize,
  (data) => kthCfgShape.parse(data),
)

// User-facing config spec (Advanced). Fields map to [section] keys in kth.cfg.
// Unsupported or informational-only fields are clearly labelled — Knuth
// silently ignores unknown keys so it is safe to surface them.
export const fullConfigSpec = sdk.InputSpec.of({
  // ── Network ───────────────────────────────────────────────────────────
  threads: sdk.Value.number({
    name: 'Network Threads',
    description: '[network.threads] Threads used by the P2P network layer.',
    required: true,
    default: 2,
    min: 1,
    max: 64,
    integer: true,
    units: null,
  }),
  outbound_connections: sdk.Value.number({
    name: 'Outbound Peer Connections',
    description:
      '[network.outbound_connections] Maximum number of outbound peer connections.',
    required: true,
    default: 8,
    min: 0,
    max: 256,
    integer: true,
    units: null,
  }),
  inbound_connections: sdk.Value.number({
    name: 'Inbound Peer Connections',
    description:
      '[network.inbound_connections] Maximum number of inbound peer connections accepted.',
    required: true,
    default: 125,
    min: 0,
    max: 1000,
    integer: true,
    units: null,
  }),
  manual_attempt_limit: sdk.Value.number({
    name: 'Manual Attempt Limit',
    description:
      '[network.manual_attempt_limit] Times to retry a manually supplied peer address before giving up.',
    required: false,
    default: null,
    min: 0,
    max: 1000,
    integer: true,
    units: null,
  }),
  connect_batch_size: sdk.Value.number({
    name: 'Connect Batch Size',
    description:
      '[network.connect_batch_size] Number of outbound connection attempts made concurrently.',
    required: false,
    default: null,
    min: 1,
    max: 64,
    integer: true,
    units: null,
  }),
  host_pool_capacity: sdk.Value.number({
    name: 'Host Pool Capacity',
    description:
      '[network.host_pool_capacity] Maximum entries stored in the peer-address cache.',
    required: false,
    default: null,
    min: 0,
    max: 100000,
    integer: true,
    units: null,
  }),
  enable_upnp: sdk.Value.toggle({
    name: 'Enable UPnP',
    description:
      '[network.enable_upnp] Request a NAT port mapping for inbound P2P connectivity.',
    default: true,
  }),
  channel_handshake_seconds: sdk.Value.number({
    name: 'Handshake Timeout (seconds)',
    description:
      '[network.channel_handshake_seconds] Time allowed for a peer handshake to complete.',
    required: false,
    default: null,
    min: 1,
    max: 600,
    integer: true,
    units: 's',
  }),
  channel_heartbeat_minutes: sdk.Value.number({
    name: 'Heartbeat Interval (minutes)',
    description:
      '[network.channel_heartbeat_minutes] Idle-channel ping interval.',
    required: false,
    default: null,
    min: 1,
    max: 1440,
    integer: true,
    units: 'min',
  }),
  channel_inactivity_minutes: sdk.Value.number({
    name: 'Inactivity Timeout (minutes)',
    description:
      '[network.channel_inactivity_minutes] Disconnect peers idle longer than this.',
    required: false,
    default: null,
    min: 1,
    max: 1440,
    integer: true,
    units: 'min',
  }),
  channel_expiration_minutes: sdk.Value.number({
    name: 'Channel Expiration (minutes)',
    description:
      '[network.channel_expiration_minutes] Maximum lifetime of a peer channel before rotation.',
    required: false,
    default: null,
    min: 1,
    max: 10080,
    integer: true,
    units: 'min',
  }),
  hosts_file: sdk.Value.text({
    name: 'Hosts File',
    description:
      '[network.hosts_file] Path to the peer-address cache file. Changing this is not recommended.',
    required: false,
    default: '/data/hosts.cache',
  }),
  user_agent: sdk.Value.text({
    name: 'User Agent',
    description:
      '[network.user_agent] Override the user-agent string advertised to peers. Leave blank to use the default Knuth identifier.',
    required: false,
    default: null,
  }),

  // ── Database (LMDB) ───────────────────────────────────────────────────
  db_max_size: sdk.Value.number({
    name: 'LMDB Max Size (GB)',
    description:
      '[database.db_max_size] Maximum size of the LMDB blockchain database in gigabytes. Use 0 to let kth pick a default.',
    required: false,
    default: null,
    min: 0,
    max: 16000,
    integer: true,
    units: 'GB',
  }),
  reorg_pool_limit: sdk.Value.number({
    name: 'Reorg Pool Limit',
    description:
      '[database.reorg_pool_limit] Maximum blocks kept in the reorg pool.',
    required: false,
    default: null,
    min: 0,
    max: 10000,
    integer: true,
    units: null,
  }),
  safe_mode: sdk.Value.toggle({
    name: 'Database Safe Mode',
    description:
      '[database.safe_mode] Enable fsync after every write. Safer but slower.',
    default: false,
  }),
  cache_capacity: sdk.Value.number({
    name: 'Cache Capacity',
    description:
      '[database.cache_capacity] Number of block/tx entries kept in the in-memory cache.',
    required: false,
    default: null,
    min: 0,
    max: 1000000,
    integer: true,
    units: null,
  }),

  // ── Blockchain ────────────────────────────────────────────────────────
  blockchain_cores: sdk.Value.number({
    name: 'Blockchain Validation Cores',
    description:
      '[blockchain.cores] CPU cores used for block validation. 0 = auto-detect.',
    required: true,
    default: 0,
    min: 0,
    max: 128,
    integer: true,
    units: null,
  }),
  blockchain_priority: sdk.Value.toggle({
    name: 'High-Priority Validation',
    description:
      '[blockchain.priority] Give the validation thread pool elevated scheduling priority.',
    default: true,
  }),
  use_libconsensus: sdk.Value.toggle({
    name: 'Use libconsensus',
    description:
      '[blockchain.use_libconsensus] Use libconsensus for script validation (advanced).',
    default: false,
  }),

  // ── Node ──────────────────────────────────────────────────────────────
  relay_transactions: sdk.Value.toggle({
    name: 'Relay Transactions',
    description:
      '[node.relay_transactions] Relay unconfirmed transactions between peers.',
    default: true,
  }),
  refresh_transactions: sdk.Value.toggle({
    name: 'Refresh Mempool',
    description:
      '[node.refresh_transactions] Refresh mempool transactions on new connections.',
    default: true,
  }),
  compact_blocks_high_bandwidth: sdk.Value.toggle({
    name: 'Compact Blocks (High-Bandwidth)',
    description:
      '[node.compact_blocks_high_bandwidth] Advertise high-bandwidth compact block relay to peers.',
    default: true,
  }),
  block_poll_seconds: sdk.Value.number({
    name: 'Block Poll Interval (seconds)',
    description:
      '[node.block_poll_seconds] How often the node polls peers for new blocks.',
    required: false,
    default: null,
    min: 1,
    max: 600,
    integer: true,
    units: 's',
  }),
  transaction_pool_capacity: sdk.Value.number({
    name: 'Mempool Capacity',
    description:
      '[node.transaction_pool_capacity] Maximum number of transactions held in the mempool.',
    required: false,
    default: null,
    min: 0,
    max: 1_000_000,
    integer: true,
    units: null,
  }),
  ds_proofs_enabled: sdk.Value.toggle({
    name: 'Double-Spend Proofs',
    description:
      '[node.ds_proofs_enabled] Accept and relay BCH double-spend proofs.',
    default: true,
  }),

  // ── Logging ───────────────────────────────────────────────────────────
  verbose_logging: sdk.Value.toggle({
    name: 'Verbose Logging',
    description: '[log.verbose] Write verbose-level entries to the debug log.',
    default: false,
  }),
  log_rotation_size: sdk.Value.number({
    name: 'Log Rotation Size (bytes)',
    description:
      '[log.rotation_size] Debug-log rotation size in bytes. Logs rotate into the archive directory when this size is reached.',
    required: false,
    default: 100_000_000,
    min: 1_000_000,
    max: 1_000_000_000,
    integer: true,
    units: 'B',
  }),

  // ── Tor / Clearnet (stored in store.json, not kth.cfg) ────────────────
  torEnabled: sdk.Value.toggle({
    name: 'Tor Routing (dependency advertisement)',
    description:
      'Advertise dependency on the Tor package. Note: Knuth does not yet natively consume a SOCKS proxy in this package; this toggle currently only affects dependency advertisement and onion reachability exposure.',
    default: true,
  }),
  advertiseClearnetInbound: sdk.Value.toggle({
    name: 'Advertise Clearnet Inbound',
    description:
      'Publish public IPv4/IPv6 endpoints for inbound peers (informational only in this package; Knuth advertises via its own gossip).',
    default: false,
  }),
})
