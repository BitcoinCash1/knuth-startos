import { sdk } from '../../sdk'
import { fullConfigSpec, kthCfg } from '../../fileModels/kth.cfg'

export const peersConfig = sdk.Action.withInput(
  'peers-config',
  async ({ effects: _effects }) => ({
    name: 'Peer & Connection Settings',
    description:
      'P2P network tuning: connection counts, handshake and heartbeat timers, host-pool capacity, UPnP, hosts-cache path, and user-agent string.',
    warning: null,
    allowedStatuses: 'any' as const,
    group: 'Configuration',
    visibility: 'enabled' as const,
  }),
  fullConfigSpec.filter({
    threads: true,
    outbound_connections: true,
    inbound_connections: true,
    manual_attempt_limit: true,
    connect_batch_size: true,
    host_pool_capacity: true,
    channel_handshake_seconds: true,
    channel_heartbeat_minutes: true,
    channel_inactivity_minutes: true,
    channel_expiration_minutes: true,
    hosts_file: true,
  }),
  async ({ effects: _effects }) => {
    const c = await kthCfg.read().once()
    return {
      threads: c?.network?.threads ?? 2,
      outbound_connections: c?.network?.outbound_connections ?? 8,
      inbound_connections: c?.network?.inbound_connections ?? 125,
      manual_attempt_limit: c?.network?.manual_attempt_limit ?? null,
      connect_batch_size: c?.network?.connect_batch_size ?? null,
      host_pool_capacity: c?.network?.host_pool_capacity ?? null,
      channel_handshake_seconds: c?.network?.channel_handshake_seconds ?? null,
      channel_heartbeat_minutes: c?.network?.channel_heartbeat_minutes ?? null,
      channel_inactivity_minutes:
        c?.network?.channel_inactivity_minutes ?? null,
      channel_expiration_minutes:
        c?.network?.channel_expiration_minutes ?? null,
      hosts_file: c?.network?.hosts_file ?? '/data/hosts.cache',
    }
  },
  async ({ effects, input }) => {
    await kthCfg.merge(effects, {
      network: {
        threads: input.threads,
        outbound_connections: input.outbound_connections,
        inbound_connections: input.inbound_connections,
        ...(input.manual_attempt_limit != null && {
          manual_attempt_limit: input.manual_attempt_limit,
        }),
        ...(input.connect_batch_size != null && {
          connect_batch_size: input.connect_batch_size,
        }),
        ...(input.host_pool_capacity != null && {
          host_pool_capacity: input.host_pool_capacity,
        }),
        ...(input.channel_handshake_seconds != null && {
          channel_handshake_seconds: input.channel_handshake_seconds,
        }),
        ...(input.channel_heartbeat_minutes != null && {
          channel_heartbeat_minutes: input.channel_heartbeat_minutes,
        }),
        ...(input.channel_inactivity_minutes != null && {
          channel_inactivity_minutes: input.channel_inactivity_minutes,
        }),
        ...(input.channel_expiration_minutes != null && {
          channel_expiration_minutes: input.channel_expiration_minutes,
        }),
        ...(input.hosts_file && { hosts_file: input.hosts_file }),
      },
    })
  },
)
