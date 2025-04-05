async function sendWhatsappMsg(sock, messageObj) {
    try {
      const jid = sock.user.id;
      await sock.sendMessage(jid, { text: messageObj.text });
      console.log("✅ Sent session ID to WhatsApp!");
    } catch (err) {
      console.error("❌ Failed to send message:", err.message);
    }
  }
  
  module.exports = sendWhatsappMsg;
  