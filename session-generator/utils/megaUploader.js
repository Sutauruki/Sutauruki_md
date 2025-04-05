const fs = require("fs-extra");
const path = require("path");
const mega = require("megajs");
const archiver = require("archiver");

require("dotenv").config();

async function zipSessionFolder(sessionFolderPath, outputZipPath) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outputZipPath);
    const archive = archiver("zip", { zlib: { level: 9 } });

    output.on("close", () => resolve());
    archive.on("error", (err) => reject(err));

    archive.pipe(output);
    archive.directory(sessionFolderPath, false);
    archive.finalize();
  });
}

async function megaUploader(sessionFolderPath, zipPath) {
  await zipSessionFolder(sessionFolderPath, zipPath);

  const storage = mega({
    email: process.env.MEGA_EMAIL,
    password: process.env.MEGA_PASSWORD,
  });

  await new Promise((resolve, reject) => {
    storage.on("ready", resolve);
    storage.on("error", reject);
  });

  const fileStream = fs.createReadStream(zipPath);
  const fileName = path.basename(zipPath);

  const upload = storage.upload(fileName, fileStream);

  return new Promise((resolve, reject) => {
    upload.on("complete", (file) => {
      file.link((err, link) => {
        if (err) return reject(err);
        resolve(link);
      });
    });

    upload.on("error", reject);
  });
}

module.exports = megaUploader;
