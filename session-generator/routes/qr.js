const express = require("express");
const fs = require("fs-extra");
const path = require("path");
const {
  makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  Browsers
} = require("@whiskeysockets/baileys");
const qrcode = require("qrcode");
const megaUploader = require("../utils/megaUploader");
const sendWhatsappMsg = require("../utils/sendWhatsappMsg");

const router = express.Router();

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
    browser: Browsers.macOS("Safari"),
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
          const sessionZipPath = `${sessionPath}.zip`;
          await fs.ensureDir("sessions");
          await fs.writeJson(`${sessionPath}/session.json`, state.creds);
    
          const megaLink = await megaUploader(sessionPath, sessionZipPath);
    
          setTimeout(async () => {
            try {
              await sendWhatsappMsg(sock, {
                text: `✅ Session Created!\n🔐 Session ID: ${sessionId}\n📎 Download: ${megaLink}`,
              });
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

  sock.ev.on("creds.update", saveCreds);
}

router.get("/", async (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "qr.html"));
});

router.get("/generate", async (req, res) => {
    const sessionId = `session-${Date.now()}`;
    const sessionPath = path.join(__dirname, "..", "sessions", sessionId);
  
    resetSession(sessionPath);
    await connectToWhatsApp(sessionPath, res, sessionId);
  });

module.exports = router;