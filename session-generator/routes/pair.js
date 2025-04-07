const express = require('express');
const fs = require('fs-extra');
const path = require('path');
const pino = require('pino');
const {
    default: makeWASocket,
    useMultiFileAuthState,
    delay,
    makeCacheableSignalKeyStore,
    Browsers
} = require("@whiskeysockets/baileys");
const megaUploader = require("../utils/megaUploader");

const router = express.Router();

// Reset session folder if needed
function resetSession(sessionPath) {
    if (fs.existsSync(sessionPath)) {
        fs.rmSync(sessionPath, { recursive: true, force: true });
        console.log("⚠️ Old session reset");
    }
}

async function clearAllSessions() {
    const sessionsPath = path.join(__dirname, "..", "sessions");
    try {
        if (fs.existsSync(sessionsPath)) {
            await fs.emptyDir(sessionsPath);
            console.log("🗑️ All previous sessions cleared");
        } else {
            await fs.mkdir(sessionsPath);
            console.log("📁 Sessions directory created");
        }
    } catch (err) {
        console.error("❌ Error clearing sessions:", err);
    }
}

async function connectToWhatsApp(sessionPath, res, sessionId, phoneNumber) {
    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

    const sock = makeWASocket({
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" })),
        },
        printQRInTerminal: false,
        logger: pino({ level: "fatal" }).child({ level: "fatal" }),
        browser: Browsers.macOS("Safari"),
        mobile: false,
        pairingCode: true
    });

    try {
        if (!sock.authState.creds.registered) {
            await delay(1500);
            console.log("📱 Requesting pairing code for:", phoneNumber);
            const code = await sock.requestPairingCode(phoneNumber);
            console.log("🔗 Generated pairing code:", code);

            if (!res.headersSent) {
                res.json({ status: "pair", pairingCode: code });
            }
        }
    } catch (error) {
        console.error("❌ Error generating pairing code:", error);
        if (!res.headersSent) {
            return res.status(500).json({
                status: 'error',
                error: 'Failed to generate pairing code'
            });
        }
        return;
    }

    sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect } = update;
        console.log('Connection status:', connection);

        if (connection === "open") {
            try {
                await fs.ensureDir(sessionPath);
                await fs.writeJson(`${sessionPath}/creds.json`, state.creds);

                const megaLink = await megaUploader(
                    fs.createReadStream(`${sessionPath}/creds.json`),
                    `session-${sessionId}.json`
                );

                await sock.sendMessage(`${phoneNumber}@s.whatsapp.net`, {
                    text: `✅ *Session Created!*\n\n🔐 *Session ID:* ${sessionId}\n📎 *Download:* ${megaLink}`
                });

                console.log("✅ Session info sent, logging out...");
                await sock.logout();
            } catch (err) {
                console.error("❌ Error after connection:", err);
            }
        }

        if (connection === "close") {
          const statusCode = lastDisconnect?.error?.output?.statusCode;
          const errorMsg = lastDisconnect?.error?.message;
          console.warn(`⚠️ Connection closed. Code: ${statusCode} | Message: ${errorMsg}`);
        }
    });

    sock.ev.on("creds.update", saveCreds);
}

// ROUTES
router.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "..", "public", "pair.html"));
});

router.post("/generate", async (req, res) => {
    try {
        const { phoneNumber } = req.body;
        let formattedPhone = phoneNumber.replace(/[^0-9]/g, '');

        if (!formattedPhone || formattedPhone.length < 10) {
            return res.status(400).json({
                status: 'error',
                error: 'Please enter a valid phone number'
            });
        }

        await clearAllSessions();

        const sessionId = `session-${Date.now()}`;
        const sessionPath = path.join(__dirname, "..", "sessions", sessionId);
        resetSession(sessionPath);

        console.log('🚀 Initiating connection for:', formattedPhone);
        await connectToWhatsApp(sessionPath, res, sessionId, formattedPhone);
    } catch (err) {
        console.error("❌ Error:", err);
        if (!res.headersSent) {
            res.status(500).json({
                status: 'error',
                error: "Failed to generate session"
            });
        }
    }
});

module.exports = router;
