/** Source-workspace preload; the supported apps/cli/src/bin.ts remains the application entry. @module */
import { homedir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { getDshRuntimeVersion } from '@deepseek-ai/dsh-app-boot'
import { genesisLaunch } from './genesis-launch.ts'

const launch = genesisLaunch(process.argv.slice(2), getDshRuntimeVersion(), fileURLToPath(new URL('..', import.meta.url)))
process.argv.splice(2, process.argv.length - 2, ...launch.args)
if (launch.genesisHome) process.env.DSH_HOME ??= join(homedir(), '.genesis-harness')
