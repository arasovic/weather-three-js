import sharp from 'sharp';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const inputPath = join(__dirname, '../public/textures/land_ocean_ice_8192.png');
const outputDir = join(__dirname, '../public/textures');

async function optimizeTextures() {
  console.log('🌍 Starting Earth texture optimization...\n');

  try {
    // Generate 1024x512 preview (low-res, fast loading) - 2:1 aspect ratio
    console.log('📦 Generating 1024x512 preview (2:1 ratio)...');
    await sharp(inputPath)
      .resize(1024, 512, { fit: 'fill', kernel: 'lanczos3' })
      .webp({ quality: 85, effort: 6 })
      .toFile(join(outputDir, 'earth_preview_1024.webp'));

    const previewStats = await sharp(join(outputDir, 'earth_preview_1024.webp')).metadata();
    console.log(`✅ Preview created: ${(previewStats.size / 1024).toFixed(0)} KB (${previewStats.width}x${previewStats.height})\n`);

    // Generate 4096x2048 high-quality version - 2:1 aspect ratio
    console.log('📦 Generating 4096x2048 high-quality (2:1 ratio)...');
    await sharp(inputPath)
      .resize(4096, 2048, { fit: 'fill', kernel: 'lanczos3' })
      .webp({ quality: 90, effort: 6 })
      .toFile(join(outputDir, 'earth_4096.webp'));

    const hqStats = await sharp(join(outputDir, 'earth_4096.webp')).metadata();
    console.log(`✅ High-quality created: ${(hqStats.size / 1024 / 1024).toFixed(2)} MB (${hqStats.width}x${hqStats.height})\n`);

    console.log('🎉 Texture optimization complete!');
    console.log('\n📊 Summary:');
    console.log(`   Preview:  ${(previewStats.size / 1024).toFixed(0)} KB (${previewStats.width}x${previewStats.height})`);
    console.log(`   Full:     ${(hqStats.size / 1024 / 1024).toFixed(2)} MB (${hqStats.width}x${hqStats.height})`);
    console.log(`   Original: ~23 MB (8192x4096)`);
    console.log(`   Savings:  ~${((1 - hqStats.size / (23 * 1024 * 1024)) * 100).toFixed(0)}%`);

  } catch (error) {
    console.error('❌ Error optimizing textures:', error);
    process.exit(1);
  }
}

optimizeTextures();
