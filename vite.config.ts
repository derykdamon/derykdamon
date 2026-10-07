import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { createMappedinTokenResult } from './api/mappedinTokenRuntime.js'

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
