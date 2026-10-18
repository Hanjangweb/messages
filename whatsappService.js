const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion
} = require('@whiskeysockets/baileys');
const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');
const pino = require('pino');

let waSocket = null;
let waQrCodeDataUrl = null;
let waConnected = false;
let waUserInfo = null;
let isInitializing = false;

const authDir = path.join(__dirname, 'data', 'whatsapp_auth');

async function initWhatsApp(forceReset = false) {
    if (isInitializing) return;
    isInitializing = true;

    try {
        if (!fs.existsSync(authDir)) {
            fs.mkdirSync(authDir, { recursive: true });
        }

        if (forceReset) {
            try {
                const files = fs.readdirSync(authDir);
                for (const file of files) {
                    fs.unlinkSync(path.join(authDir, file));
                }
                console.log("🔄 Cleared existing WhatsApp auth credentials for re-linking.");
            } catch (e) {
                console.warn("Error clearing auth directory:", e.message);
            }
        }

        const { state, saveCreds } = await useMultiFileAuthState(authDir);

        const sock = makeWASocket({
            auth: state,
            printQRInTerminal: false,
            logger: pino({ level: 'silent' }),
            browser: ['Birthday Proposal App', 'Chrome', '120.0.0']
        });

        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (qr) {
                console.log("\n=======================================================");
                console.log("📱 NEW WHATSAPP QR CODE GENERATED!");
                console.log("Scan with your phone: WhatsApp -> Linked Devices -> Link a Device");
                console.log("=======================================================\n");
                try {
                    waQrCodeDataUrl = await QRCode.toDataURL(qr, { width: 300, margin: 2 });
                } catch (e) {
                    console.error("QR data url generation error:", e.message);
                }
            }

            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
                console.log(`⚠️ WhatsApp connection closed (status ${statusCode}). Reconnect allowed: ${shouldReconnect}`);
                waConnected = false;
                waUserInfo = null;

                if (shouldReconnect) {
                    setTimeout(() => {
                        isInitializing = false;
                        initWhatsApp(false);
                    }, 5000);
                } else {
                    console.log("Logged out of WhatsApp. Clear data/whatsapp_auth to scan again.");
                    isInitializing = false;
                }
            } else if (connection === 'open') {
                console.log("\n=======================================================");
                console.log("✅ WHATSAPP CONNECTED SUCCESSFULLY!");
                console.log("Connected as:", sock.user?.name || sock.user?.id || 'User');
                console.log("Automated Midnight Dispatch is active & ready!");
                console.log("=======================================================\n");
                waConnected = true;
                waQrCodeDataUrl = null;
                waUserInfo = sock.user;
                isInitializing = false;
            }
        });

        waSocket = sock;
    } catch (err) {
        console.error("❌ Error initializing WhatsApp service:", err.message);
    } finally {
        isInitializing = false;
    }
}

function getWhatsAppStatus() {
    return {
        connected: waConnected,
        user: waUserInfo ? (waUserInfo.name || waUserInfo.id || 'Connected User') : null,
        qr: waQrCodeDataUrl,
        ready: waConnected
    };
}

async function sendWhatsAppMessage(phone, message) {
    if (!waConnected || !waSocket) {
        console.warn("⚠️ WhatsApp is not connected yet. Cannot send message.");
        return {
            success: false,
            needScan: true,
            qr: waQrCodeDataUrl,
            message: "WhatsApp is not linked yet. Please scan the QR code in the Admin Dashboard."
        };
    }

    try {
        const cleanDigits = phone.toString().replace(/\D/g, '');
        const fullPhone = cleanDigits.length === 10 ? `91${cleanDigits}` : cleanDigits;
        const jid = `${fullPhone}@s.whatsapp.net`;

        console.log(`📤 Sending automated WhatsApp message to ${fullPhone}...`);
        const sent = await waSocket.sendMessage(jid, { text: message });

        return {
            success: true,
            phone: fullPhone,
            messageId: sent?.key?.id,
            provider: 'whatsapp (direct automated via Baileys)'
        };
    } catch (err) {
        console.error("❌ Failed to send WhatsApp message:", err.message);
        return {
            success: false,
            error: err.message
        };
    }
}

module.exports = {
    initWhatsApp,
    getWhatsAppStatus,
    sendWhatsAppMessage
};
