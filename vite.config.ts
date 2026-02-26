import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const perplexityKey = env.VITE_PERPLEXITY_API_KEY
  const youtubeApiKey = env.YOUTUBE_API_KEY || env.VITE_YOUTUBE_API_KEY
  const grabbitKey = env.GRABBIT_API_KEY || 'grabbit_sk_3010541e016bb354a96dfdb83cf20cc8b6dd24d6ee99a1d1'

  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api/perplexity/search': {
          target: 'https://api.perplexity.ai',
          changeOrigin: true,
          rewrite: () => '/search',
          configure: (proxy: any) => {
            proxy.on('proxyReq', (proxyReq: any) => {
              if (!perplexityKey) return
              proxyReq.setHeader('Authorization', `Bearer ${perplexityKey}`)
              proxyReq.setHeader('Accept', 'application/json')
            })
          },
        },
        '/api/youtube/search': {
          target: 'https://www.googleapis.com',
          changeOrigin: true,
          rewrite: () => '/youtube/v3/search',
          configure: (proxy: any) => {
            proxy.on('proxyReq', (proxyReq: any) => {
              if (!youtubeApiKey) return
              const url = new URL(proxyReq.path, 'https://www.googleapis.com')
              if (!url.searchParams.has('key')) {
                url.searchParams.set('key', youtubeApiKey)
              }
              proxyReq.path = `${url.pathname}?${url.searchParams.toString()}`
              proxyReq.setHeader('Accept', 'application/json')
            })
          },
        },
        '/api/grabbit/run': {
          target: 'https://www.grabbit.dev',
          changeOrigin: true,
          rewrite: () => '/api/workflows/67ccde1d-784e-4263-8829-a89e7a71ecee/run',
          configure: (proxy: any) => {
            proxy.on('proxyReq', (proxyReq: any) => {
              proxyReq.setHeader('Authorization', `Bearer ${grabbitKey}`)
              proxyReq.setHeader('Content-Type', 'application/json')
            })
          },
        },
      },
    },
  }
})
