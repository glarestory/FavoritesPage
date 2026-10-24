import { loadEnvFile } from './load-env.mjs'
import { getConfig } from './config.mjs'
import { createAppServer } from './app.mjs'

loadEnvFile()

let config
try {
  config = getConfig()
} catch (error) {
  console.error(`[sync] ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
}

const { server, close } = await createAppServer(config)

server.listen(config.port, config.host, () => {
  const address = server.address()
  const port = typeof address === 'object' && address ? address.port : config.port
  console.log(`[sync] API server listening on http://${config.host}:${port}`)
  console.log(`[sync] Data directory: ${config.dataDir}`)
})

let shuttingDown = false
async function shutdown(signal) {
  if (shuttingDown) return
  shuttingDown = true
  console.log(`[sync] Received ${signal}. Shutting down.`)

  try {
    await close()
    process.exit(0)
  } catch (error) {
    console.error('[sync] Shutdown failed', error)
    process.exit(1)
  }
}

process.on('SIGINT', () => void shutdown('SIGINT'))
process.on('SIGTERM', () => void shutdown('SIGTERM'))
