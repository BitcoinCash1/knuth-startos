import { sdk } from '../sdk'
import { runtimeInfo } from './runtimeInfo'
import { deletePeers } from './deletePeers'
import { reindexBlockchain } from './reindexBlockchain'
import { advancedSettings, autoconfig } from './settings'

export const actions = sdk.Actions.of()
  .addAction(autoconfig)
  .addAction(runtimeInfo)
  .addAction(advancedSettings)
  .addAction(deletePeers)
  .addAction(reindexBlockchain)
