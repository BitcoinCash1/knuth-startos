import { sdk } from '../sdk'
import { autoconfig } from './config/autoconfig'
import { networkConfig } from './config/network'
import { peersConfig } from './config/peers'
import { otherConfig } from './config/other'
import { runtimeInfo } from './runtimeInfo'
import { deletePeers } from './deletePeers'
import { reindexBlockchain } from './reindexBlockchain'

export const actions = sdk.Actions.of()
  // ── Hidden (cross-package) ──────────────────────────────────────────────
  .addAction(autoconfig)
  // ── Info ────────────────────────────────────────────────────────────────
  .addAction(runtimeInfo)
  // ── Configuration ───────────────────────────────────────────────────────
  .addAction(networkConfig)
  .addAction(peersConfig)
  .addAction(otherConfig)
  // ── Maintenance ─────────────────────────────────────────────────────────
  .addAction(reindexBlockchain)
  .addAction(deletePeers)
