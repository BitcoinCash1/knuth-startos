import { storeJson } from '../fileModels/store.json'
import { sdk } from '../sdk'
import { peerInterfaceId } from '../utils'

const toHostPort = (h: { hostname: string; port: number | null }): string => {
  const host = h.hostname.includes(':') ? `[${h.hostname}]` : h.hostname
  return h.port != null ? `${host}:${h.port}` : host
}

/**
 * Knuth does not have a CLI flag to publish externalip endpoints; this file
 * only records the current public addresses in store.json for reference and
 * for possible future use. No config-file mutation here.
 */
export const watchHosts = sdk.setupOnInit(async (effects) => {
  const store = await storeJson.read().const(effects)
  const advertiseClearnetInbound = !!store?.advertiseClearnetInbound

  const publicInfo = await sdk.serviceInterface
    .getOwn(effects, peerInterfaceId, (i) =>
      i?.addressInfo?.public.filter({ exclude: { kind: 'domain' } }),
    )
    .const()

  if (!publicInfo) return

  const externalip: string[] = []

  const onions = publicInfo
    .filter({
      predicate: ({ metadata }) =>
        metadata.kind === 'plugin' && metadata.packageId === 'tor',
    })
    .format('hostname-info')
    .map(toHostPort)

  externalip.push(...onions)

  if (advertiseClearnetInbound) {
    const ipv4s = publicInfo
      .filter({ kind: 'ipv4' })
      .format('hostname-info')
      .map(toHostPort)
    externalip.push(...ipv4s)
    const ipv6s = publicInfo
      .filter({ kind: 'ipv6' })
      .format('hostname-info')
      .map(toHostPort)
    externalip.push(...ipv6s)
  }

  await storeJson.merge(effects, { externalip })
})
