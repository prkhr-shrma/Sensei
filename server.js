import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'

const app = express()
const PORT = process.env.PORT || 3001
const __dirname = path.dirname(fileURLToPath(import.meta.url))

app.use(express.json())

app.post('/api/messages', async (req, res) => {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not set in .env' })
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(req.body),
    })
    const data = await response.json()
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Serve Vite build in production
app.use(express.static(path.join(__dirname, 'dist')))
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'))
})

app.listen(PORT, () => console.log(`sensei server on http://localhost:${PORT}`))
