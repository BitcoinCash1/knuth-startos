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
        hosts_file: z.string().optional(),
      })
      .optional(),
    database: z
      .object({
        directory: z.string().optional(),
        flush_writes: z.boolean().optional(),
      })
      .optional(),
    blockchain: z
      .object({
        cores: z.number().int().optional(),
      })
      .optional(),
    node: z
      .object({
        relay_transactions: z.boolean().optional(),
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

// User-facing config spec (Advanced)
export const fullConfigSpec = sdk.InputSpec.of({
  threads: sdk.Value.number({
    name: 'Network Threads',
    description: 'Number of threads used by the P2P network layer.',
    required: true,
    default: 2,
    min: 1,
    max: 64,
    integer: true,
    units: null,
  }),
  outbound_connections: sdk.Value.number({
    name: 'Outbound Peer Connections',
    description: 'Maximum number of outbound peer connections.',
    required: true,
    default: 8,
    min: 0,
    max: 256,
    integer: true,
    units: null,
  }),
  inbound_connections: sdk.Value.number({
    name: 'Inbound Peer Connections',
    description: 'Maximum number of inbound peer connections.',
    required: true,
    default: 125,
    min: 0,
    max: 1000,
    integer: true,
    units: null,
  }),
  blockchain_cores: sdk.Value.number({
    name: 'Blockchain Validation Cores',
    description:
      'Number of CPU cores used for block validation. 0 = auto-detect.',
    required: true,
    default: 0,
    min: 0,
    max: 128,
    integer: true,
    units: null,
  }),
  relay_transactions: sdk.Value.toggle({
    name: 'Relay Transactions',
    description: 'Relay unconfirmed transactions between peers.',
    default: true,
  }),
  verbose_logging: sdk.Value.toggle({
    name: 'Verbose Logging',
    description: 'Write verbose-level entries to the debug log.',
    default: false,
  }),
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
