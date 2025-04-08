const express = require("express");
const fs = require("fs-extra");
const path = require("path");
const pino = require("pino");
const {
makeWASocket,
useMultiFileAuthState,
DisconnectReason,
Browsers
} = require("@whiskeysockets/baileys");
const qrcode = require("qrcode");
const megaUploader = require("../utils/megaUploader");
const sendWhatsappMsg = require("../utils/sendWhatsappMsg");

const MESSAGE = process.env.MESSAGE ||  `
🚀 *SESSION GENERATED SUCCESSFULY* ✅

✨ *Gɪᴠᴇ ᴀ ꜱᴛᴀʀ ᴛᴏ ʀᴇᴘᴏ ꜰᴏʀ ᴄᴏᴜʀᴀɢᴇ* 🌟
https://github.com/Sutauruki/Satauruki_md.git

💭 *Sᴜᴘᴘᴏʀᴛ Gʀᴏᴜᴘ ꜰᴏʀ ϙᴜᴇʀʏ* 💭
-----


🎥 *Yᴏᴜ-ᴛᴜʙᴇ ᴛᴜᴛᴏʀɪᴀʟꜱ* 💻
https://youtube.com/bytemystique

🔗 *SUTAURUKI-MD__SESSION-GENERATOR* 🔗
`

const router = express.Router();

let string_session = '';

// Reset session folder if needed
function resetSession(sessionPath) {
if (fs.existsSync(sessionPath)) {
fs.rmSync(sessionPath, { recursive: true, force: true });
console.log("⚠️ Old session reset");
}
}



async function connectToWhatsApp(sessionPath, res, sessionId) {
const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

const sock = makeWASocket({
auth: state,
printQRInTerminal: false,
logger: pino({ level: "silent" }),
browser: Browsers.macOS("Desktop"),
connectTimeoutMs: 60000,
retryRequestDelayMs: 2000
});

let qrSent = false;
let connectionAttempts = 0;
const MAX_RETRIES = 3;

sock.ev.on("connection.update", async (update) => {
const { connection, qr, lastDisconnect } = update;
if (qr && !qrSent) {
  qrSent = true;
  const qrImageData = await qrcode.toDataURL(qr);
  console.log("📱 QR Code Generated");
  return res.json({ status: "qr", qrImage: qrImageData });
}

if (connection === "open") {
  console.log("✅ Connected via QR!");
  connectionAttempts = 0;

  try {
      await fs.ensureDir(sessionPath);
      await fs.writeJson(`${sessionPath}/creds.json`, state.creds);
      
      // Create session archive
      const sessionZipPath = `${sessionPath}.zip`;

      //Random Mega ID generator
      function randomMegaId(length = 6, numberLength = 4) {

        const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

        let result = '';

        for (let i = 0; i < length; i++) {

        result += characters.charAt(Math.floor(Math.random() * characters.length));

          }

         const number = Math.floor(Math.random() * Math.pow(10, numberLength));

          return `${result}${number}`;

          }

      
      // Upload to mega
      const megaLink = await megaUploader(
        fs.createReadStream(`${sessionPath}/creds.json`),
        `${randomMegaId()}.json`
    );

      // Update global string_session
      let string_session = megaLink.replace('https://mega.nz/file/', '');

      //GET YOUR CREDS.JSON FILE  WITH "https://mega.nz/file/YOUR_SESSION_ID"

    
    let user = sock.user.id;

      setTimeout(async () => {
          try {
              let sessionMsg = await sock.sendMessage(user, { 
                  text: `✅ Session Created!\n🔐 Session ID: ${string_session}\n📎 Download: ${megaLink}`
              });
              await sock.sendMessage(user, { text: MESSAGE } , { quoted : sessionMsg });
              console.log("✅ Session sent to WhatsApp and logging out...");
              await sock.logout();
          } catch (err) {
              console.error("❌ Failed to send or logout:", err);
          }
      }, 4000);
  } catch (err) {
      console.error("❌ Error after login:", err);
  }
}

if (connection === "close") {
const statusCode = lastDisconnect?.error?.output?.statusCode;
const shouldReconnect = statusCode !== DisconnectReason.loggedOut 
                      && connectionAttempts < MAX_RETRIES;

console.warn(`⚠️ Connection closed. Status code: ${statusCode}`);

if (statusCode === 515) {
  console.log("🔄 Stream error 515 detected, attempting to reconnect...");
  connectionAttempts++;
  
  if (shouldReconnect) {
      console.log(`🔁 Reconnection attempt ${connectionAttempts}/${MAX_RETRIES}`);
      setTimeout(() => connectToWhatsApp(sessionPath, res, sessionId), 5000);
    } else {
      console.log("❌ Max reconnection attempts reached");
    }
}
}
});

sock.ev.on("creds.update", saveCreds)
}

router.get("/", async (req, res) => {
res.sendFile(path.join(__dirname, "..", "public", "qr.html"));
});

router.get("/generate", async (req, res) => {
  // Use random session ID if string_session is empty
  const sessionId = string_session || Math.random().toString(36).substring(2, 15);
  const sessionPath = path.join(__dirname, "..", "sessions", sessionId);

  resetSession(sessionPath);
  await connectToWhatsApp(sessionPath, res, sessionId);
});

module.exports = router;