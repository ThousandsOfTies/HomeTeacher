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

// SVGテンプレート
function generateSVG(size) {
  const cornerRadius = size * 0.2;
  const fontSize = size * 0.6;

  return `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${size}" height="${size}" fill="#4F46E5" rx="${cornerRadius}"/>
      <text
        x="${size / 2}"
        y="${size / 2 + size * 0.05}"
        font-size="${fontSize}"
        font-family="Arial, sans-serif"
        fill="white"
        text-anchor="middle"
        dominant-baseline="middle"
        font-weight="bold">H</text>
    </svg>
  `;
}

async function generateIcons() {
  try {
    await fs.mkdir(publicDir, { recursive: true });

    for (const { size, name } of sizes) {
      const svg = Buffer.from(generateSVG(size));
      const outputPath = path.join(publicDir, name);

      await sharp(svg)
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
