import sharp from 'sharp';
import { promises as fs } from 'fs';
import path from 'path';

const sizes = [
  { size: 192, name: 'pwa-192x192.png' },
  { size: 512, name: 'pwa-512x512.png' },
  { size: 180, name: 'apple-touch-icon.png' },
  { size: 32, name: 'favicon.ico' }
];

const publicDir = path.join(process.cwd(), 'public');
const sourceIconPath = path.join(publicDir, 'favicon.svg');

async function generateIcons() {
  try {
    await fs.mkdir(publicDir, { recursive: true });

    // Read the source SVG file
    const svgBuffer = await fs.readFile(sourceIconPath);

    for (const { size, name } of sizes) {
      const outputPath = path.join(publicDir, name);

      await sharp(svgBuffer)
        .resize(size, size)
        .png()
        .toFile(outputPath);

      console.log(`Generated: ${name}`);
    }

    console.log('All icons generated successfully!');
  } catch (error) {
    console.error('Error generating icons:', error);
    process.exit(1);
  }
}

generateIcons();
