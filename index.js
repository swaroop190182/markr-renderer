const express = require('express')
const { chromium } = require('playwright')
const { execSync } = require('child_process')

const app = express()
app.use(express.json())

const SECRET = process.env.RENDERER_SECRET || 'markr_renderer_2026'

app.get('/health', (req, res) => res.json({ status: 'ok' }))

app.get('/chromium-path', async (req, res) => {
  try {
    const path1 = execSync('which chromium 2>/dev/null || echo "not found"').toString().trim()
    const path2 = execSync('which chromium-browser 2>/dev/null || echo "not found"').toString().trim()
    const path3 = execSync('find /nix -name "chromium" -type f 2>/dev/null | head -5').toString().trim()
    const path4 = execSync('find /usr -name "chromium*" -type f 2>/dev/null | head -5').toString().trim()
    res.json({ path1, path2, path3, path4 })
  } catch (err) {
    res.json({ error: err.message })
  }
})

app.post('/render', async (req, res) => {
  if (req.headers['x-renderer-secret'] !== SECRET) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const { url } = req.body
  if (!url) return res.status(400).json({ error: 'URL required' })

  let browser
  try {
    console.log('[renderer] Starting:', url)
    browser = await chromium.launch({
      executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run',
        '--no-zygote',
        '--single-process'
      ]
    })
    const page = await browser.newPage()
    await page.setExtraHTTPHeaders({
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    })
    await page.goto(url, { waitUntil: 'networkidle', timeout: 25000 })
    await page.waitForTimeout(2000)
    const html = await page.content()
    const wordCount = html.split(/\s+/).length
    console.log('[renderer] Done:', url, '— chars:', html.length, 'words:', wordCount)
    res.json({ html, wordCount, url })
  } catch (err) {
    console.error('[renderer] Error:', err.message)
    res.status(500).json({ error: err.message })
  } finally {
    if (browser) await browser.close()
  }
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => console.log(`Markr renderer running on port ${PORT}`))