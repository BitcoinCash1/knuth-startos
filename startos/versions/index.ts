import { VersionGraph } from '@start9labs/start-sdk'
import { v080 } from './v0.80.0.0'
import { v0_80_0_1 } from './v0.80.0.1'

export const versionGraph = VersionGraph.of({
  current: v0_80_0_1,
  other: [v080],
})
