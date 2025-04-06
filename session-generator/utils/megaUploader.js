const { Storage } = require('megajs');
const fs = require('fs-extra');
const archiver = require('archiver');

async function megaUploader(sessionPath, zipPath) {
  try {
    // Create zip file
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip');

    output.on('close', () => {
      console.log('📦 Session files zipped successfully');
    });

    archive.pipe(output);
    archive.directory(sessionPath, false);
    await archive.finalize();

    // Get file size
    const stats = await fs.stat(zipPath);
    const fileSize = stats.size;

    // Upload to Mega
    const storage = new Storage({
      email: process.env.MEGA_EMAIL,
      password: process.env.MEGA_PASSWORD,
      allowUploadBuffering: true // Add this line
    });

    await storage.ready;
    const file = await storage.upload({
      name: `${zipPath}`,
      size: fileSize, // Add file size
      data: fs.createReadStream(zipPath)
    });

    console.log('🔄 Uploading session to Mega...');
    const downloadLink = await file.link();
    console.log('✅ Session uploaded to Mega');

    return downloadLink;

  } catch (err) {
    console.error('❌ Mega upload error:', err);
    throw err;
  }
}

module.exports = megaUploader;