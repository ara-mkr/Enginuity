import fs from 'fs'
import path from 'path'

const SVG_LOGO = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" fill="#080810"/>
  <path d="M 140,140 L 372,140 M 140,256 L 372,256 M 140,372 L 372,372 M 140,140 L 140,372" stroke="#00c8ff" stroke-width="32" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  <circle cx="372" cy="140" r="22" fill="#00c8ff"/>
  <circle cx="372" cy="256" r="22" fill="#00c8ff"/>
  <circle cx="372" cy="372" r="22" fill="#00c8ff"/>
</svg>`

const sizes = [72, 96, 128, 192, 512]
const shortcuts = ['shortcut-playground', 'shortcut-notebook', 'shortcut-bom']
const screenshots = [
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'mobile', width: 390, height: 844 }
]

async function main() {
  const publicDir = path.resolve('public')
  const iconsDir = path.join(publicDir, 'icons')
  const screenshotsDir = path.join(publicDir, 'screenshots')
  const scriptsDir = path.resolve('scripts')

  if (!fs.existsSync(iconsDir)) fs.mkdirSync(iconsDir, { recursive: true })
  if (!fs.existsSync(screenshotsDir)) fs.mkdirSync(screenshotsDir, { recursive: true })

  // Write base SVG file
  fs.writeFileSync(path.join(publicDir, 'logo.svg'), SVG_LOGO)

  try {
    // Try dynamically importing sharp to resize and write PNGs
    const { default: sharp } = await import('sharp')
    console.log('Generating PNG icons via sharp...')

    const svgBuffer = Buffer.from(SVG_LOGO)

    // Icons
    for (const size of sizes) {
      await sharp(svgBuffer)
        .resize(size, size)
        .png()
        .toFile(path.join(iconsDir, `icon-${size}.png`))
    }

    // Shortcuts
    for (const sc of shortcuts) {
      await sharp(svgBuffer)
        .resize(96, 96)
        .png()
        .toFile(path.join(iconsDir, `${sc}.png`))
    }

    // Screenshots
    for (const ss of screenshots) {
      // Create a background block with the logo in the center
      const bg = sharp({
        create: {
          width: ss.width,
          height: ss.height,
          channels: 4,
          background: { r: 8, g: 8, b: 16, alpha: 1 }
        }
      })

      const resizedLogo = await sharp(svgBuffer)
        .resize(Math.min(ss.width, ss.height) / 2)
        .png()
        .toBuffer()

      await bg
        .composite([{ input: resizedLogo, gravity: 'center' }])
        .png()
        .toFile(path.join(screenshotsDir, `${ss.name}.png`))
    }

    console.log('Successfully generated all PNG assets.')
  } catch (err) {
    console.log('Sharp package not available or failed. Generating placeholder PNGs...')

    // Fallback: Write a minimal valid 1x1 transparent PNG or base64 files
    // so Vite build and manifest don't fail due to missing files.
    const base64Png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
    const dummyBuffer = Buffer.from(base64Png, 'base64')

    for (const size of sizes) {
      fs.writeFileSync(path.join(iconsDir, `icon-${size}.png`), dummyBuffer)
    }
    for (const sc of shortcuts) {
      fs.writeFileSync(path.join(iconsDir, `${sc}.png`), dummyBuffer)
    }
    for (const ss of screenshots) {
      fs.writeFileSync(path.join(screenshotsDir, `${ss.name}.png`), dummyBuffer)
    }
    console.log('Placeholder PNG files created successfully.')
  }
}

main().catch(console.error)
