import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { createMappedinTokenResult } from './api/mappedinTokenRuntime.js'
import { intake } from './server/aviation/intake.ts'

export default defineConfig(({ mode }) => {
  const serverEnvironment = {
    ...process.env,
    ...loadEnv(mode, process.cwd(), ''),
  }

  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'aviation-local-intake',
        configureServer(server) {
          server.middlewares.use('/api/aviation/inquiries', async (request, response) => {
            let body = ''
            for await (const chunk of request) {
              if (Buffer.byteLength(body) <= 12000) body += String(chunk)
            }
            const header = (name: string) => { const value = request.headers[name]; return typeof value === 'string' ? value : undefined }
            const result = await intake({ method: request.method ?? '', origin: header('origin'), host: header('host'), contentType: header('content-type'), idempotencyKey: header('idempotency-key'), ip: request.socket.remoteAddress ?? 'local', body }, serverEnvironment)
            response.statusCode = result.status
            response.setHeader('Cache-Control', 'no-store')
            response.setHeader('Content-Type', 'application/json')
            response.setHeader('Allow', 'POST')
            if (result.status === 429) response.setHeader('Retry-After', '3600')
            response.end(JSON.stringify(result.body))
          })
        },
      },
      {
        name: 'aether-local-mappedin-token',
        configureServer(server) {
          server.middlewares.use(
            '/api/mappedin-token',
            async (request, response) => {
              if (request.method !== 'GET') {
                response.statusCode = 405
                response.setHeader('Allow', 'GET')
                response.setHeader('Content-Type', 'application/json')
                response.end(JSON.stringify({ error: 'Method not allowed' }))
                return
              }

              const result = await createMappedinTokenResult(serverEnvironment)

              response.statusCode = result.status
              response.setHeader('Content-Type', 'application/json')

              if (result.headers) {
                Object.entries(result.headers).forEach(([header, value]) => {
                  response.setHeader(header, String(value))
                })
              }

              response.end(JSON.stringify(result.body))
            },
          )
        },
      },
    ],
  }
})
