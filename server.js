require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/proposal_app';
const ADMIN_PASS = (process.env.ADMIN_PASS || 'admin777').toLowerCase().trim();
const VIP_PASS = (process.env.VIP_PASS || '1910').toLowerCase().trim();
const TARGET_NAME = "Sengve Rongpharpi";

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Local data fallback directory in case MongoDB connection is pending
const DATA_DIR = path.join(__dirname, 'data');
try {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }
} catch (e) {
    // Read-only environment safe fallback
}
const LOCAL_DB_FILE = path.join(DATA_DIR, 'db_backup.json');

function saveLocalBackup(type, data) {
    try {
        let current = { events: [], vouchers: [], proposal: null };
        if (fs.existsSync(LOCAL_DB_FILE)) {
            current = JSON.parse(fs.readFileSync(LOCAL_DB_FILE, 'utf8') || '{}');
            if (!current.events) current.events = [];
            if (!current.vouchers) current.vouchers = [];
        }
        if (type === 'event') current.events.push(data);
        if (type === 'voucher') current.vouchers.push(data);
        if (type === 'proposal') current.proposal = data;

        fs.writeFileSync(LOCAL_DB_FILE, JSON.stringify(current, null, 2));
    } catch (e) {
        console.error("Local backup write error:", e.message);
    }
}

// MongoDB Connection
let isMongoConnected = false;

mongoose.connect(MONGODB_URI)
    .then(() => {
        isMongoConnected = true;
        console.log("✅ Successfully connected to MongoDB Database!");
    })
    .catch((err) => {
        isMongoConnected = false;
        console.warn("⚠️ MongoDB connection notice: Could not connect to MongoDB URI yet (" + err.message + "). Local sync mode active.");
    });

// Mongoose Schemas & Models
const ActivitySchema = new mongoose.Schema({
    userName: { type: String, default: TARGET_NAME },
    eventType: { type: String, required: true },
    details: { type: mongoose.Schema.Types.Mixed },
    timestamp: { type: Date, default: Date.now }
});

const VoucherSchema = new mongoose.Schema({
    userName: { type: String, default: TARGET_NAME },
    voucherName: { type: String, required: true },
    claimedAt: { type: Date, default: Date.now }
});

const ProposalSchema = new mongoose.Schema({
    userName: { type: String, default: TARGET_NAME },
    answer: { type: String, required: true },
    timestamp: { type: Date, default: Date.now }
});

const Activity = mongoose.model('Activity', ActivitySchema);
const Voucher = mongoose.model('Voucher', VoucherSchema);
const Proposal = mongoose.model('Proposal', ProposalSchema);

// ==========================================
// API ROUTES
// ==========================================

// 1. Authentication (Only Sengve Rongpharpi & Admin)
app.post('/api/auth', async (req, res) => {
    const { passkey } = req.body;
    if (!passkey) {
        return res.status(400).json({ success: false, message: "Passkey is required" });
    }

    const cleaned = passkey.toString().trim().toLowerCase();

    // Check if it's Sengve Rongpharpi
    const isSengve = (
        cleaned === 'sengve' ||
        cleaned === 'sengve rongpharpi' ||
        cleaned === 'rongpharpi' ||
        cleaned === VIP_PASS ||
        cleaned === 'sengve19' ||
        cleaned === '1910'
    );

    // Check if it's Admin
    const isAdmin = (
        cleaned === ADMIN_PASS ||
        cleaned === 'admin' ||
        cleaned === 'chandigarh'
    );

    if (isSengve) {
        // Record login event
        const eventData = {
            userName: TARGET_NAME,
            eventType: 'LOGIN_VIP_SENGVE',
            details: { passkeyUsed: passkey },
            timestamp: new Date()
        };

        if (isMongoConnected) {
            try { await Activity.create(eventData); } catch (e) {}
        }
        saveLocalBackup('event', eventData);

        return res.json({
            success: true,
            role: 'sengve',
            userName: TARGET_NAME,
            message: `Welcome, Sengve! ❤️ Access Granted.`
        });
    }

    if (isAdmin) {
        return res.json({
            success: true,
            role: 'admin',
            userName: 'Admin',
            message: "Welcome back, Admin! 🛠️"
        });
    }

    // Access Denied for anyone else
    return res.status(403).json({
        success: false,
        message: "Access Denied. This private experience is strictly reserved for Sengve Rongpharpi."
    });
});

// 2. Log Activity Events (Envelope open, cake blow, letters)
app.post('/api/event', async (req, res) => {
    const { eventType, details } = req.body;
    const eventData = {
        userName: TARGET_NAME,
        eventType: eventType || 'GENERIC_EVENT',
        details: details || {},
        timestamp: new Date()
    };

    if (isMongoConnected) {
        try { await Activity.create(eventData); } catch (e) {}
    }
    saveLocalBackup('event', eventData);

    res.json({ success: true, message: "Event recorded in DB" });
});

// 3. Claim Voucher (Inserts directly to MongoDB)
app.post('/api/vouchers/claim', async (req, res) => {
    const { voucherName } = req.body;
    if (!voucherName) {
        return res.status(400).json({ success: false, message: "Voucher name required" });
    }

    const voucherData = {
        userName: TARGET_NAME,
        voucherName,
        claimedAt: new Date()
    };

    if (isMongoConnected) {
        try {
            await Voucher.create(voucherData);
            await Activity.create({
                userName: TARGET_NAME,
                eventType: 'VOUCHER_CLAIMED',
                details: { voucherName },
                timestamp: new Date()
            });
        } catch (e) {
            console.error(e);
        }
    }

    saveLocalBackup('voucher', voucherData);
    saveLocalBackup('event', {
        userName: TARGET_NAME,
        eventType: 'VOUCHER_CLAIMED',
        details: { voucherName },
        timestamp: new Date()
    });

    res.json({
        success: true,
        message: `Voucher "${voucherName}" successfully recorded in database!`,
        data: voucherData
    });
});

// 4. Proposal Response (YES Acceptance saved directly to DB)
app.post('/api/proposal/respond', async (req, res) => {
    const { answer } = req.body;
    const proposalData = {
        userName: TARGET_NAME,
        answer: answer || "YES",
        timestamp: new Date()
    };

    if (isMongoConnected) {
        try {
            await Proposal.create(proposalData);
            await Activity.create({
                userName: TARGET_NAME,
                eventType: 'PROPOSAL_ACCEPTED',
                details: { answer: proposalData.answer },
                timestamp: new Date()
            });
        } catch (e) {
            console.error(e);
        }
    }

    saveLocalBackup('proposal', proposalData);
    saveLocalBackup('event', {
        userName: TARGET_NAME,
        eventType: 'PROPOSAL_ACCEPTED',
        details: { answer: proposalData.answer },
        timestamp: new Date()
    });

    res.json({
        success: true,
        message: "Proposal response permanently locked into database! ❤️",
        data: proposalData
    });
});

// ==========================================
// 5. Automated Phone Alert Service (Twilio / Fast2SMS)
// ==========================================
let countdownAlertSent = false;

async function sendPhoneAlert(customPhone = null, customMessage = null) {
    const phone = (customPhone || process.env.ALERT_PHONE_NUMBER || '').trim();
    const appUrl = (process.env.APP_PUBLIC_URL || `http://localhost:${PORT}`).trim();
    const baseMessage = customMessage || process.env.ALERT_MESSAGE || 'happy birthday Amitson , chandigarh please open the link';
    const message = baseMessage.includes('http') ? baseMessage : `${baseMessage} ${appUrl}`;
    const provider = (process.env.SMS_PROVIDER || 'twilio').toLowerCase().trim();

    if (!phone) {
        console.warn("⚠️ Phone alert notice: ALERT_PHONE_NUMBER is not set in .env");
        return { success: false, message: "ALERT_PHONE_NUMBER is not configured in .env" };
    }

    console.log(`📱 Triggering automated phone alert to: ${phone} via ${provider}`);

    try {
        if (provider === 'twilio') {
            const accountSid = process.env.TWILIO_ACCOUNT_SID;
            const authToken = process.env.TWILIO_AUTH_TOKEN;
            const fromNumber = process.env.TWILIO_PHONE_NUMBER;
            const isWhatsApp = (process.env.TWILIO_WHATSAPP || 'false').toLowerCase() === 'true';

            if (!accountSid || !authToken || !fromNumber) {
                console.warn("⚠️ Twilio credentials missing in .env. Mocking SMS dispatch.");
                const mockResult = {
                    success: true,
                    mock: true,
                    phone,
                    message,
                    provider: 'twilio (simulated - add TWILIO_* keys in .env to send real SMS)'
                };
                saveLocalBackup('event', {
                    eventType: 'PHONE_ALERT_SIMULATED',
                    details: mockResult,
                    timestamp: new Date()
                });
                return mockResult;
            }

            const formattedTo = isWhatsApp && !phone.startsWith('whatsapp:') ? `whatsapp:${phone}` : phone;
            const formattedFrom = isWhatsApp && !fromNumber.startsWith('whatsapp:') ? `whatsapp:${fromNumber}` : fromNumber;

            const authHeader = 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64');
            const params = new URLSearchParams();
            params.append('To', formattedTo);
            params.append('From', formattedFrom);
            params.append('Body', message);

            const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
            const response = await fetch(twilioUrl, {
                method: 'POST',
                headers: {
                    'Authorization': authHeader,
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: params.toString()
            });

            const resData = await response.json();
            if (!response.ok) {
                throw new Error(resData.message || `Twilio error status ${response.status}`);
            }

            const alertData = {
                eventType: 'PHONE_ALERT_SENT_TWILIO',
                details: { sid: resData.sid, phone, isWhatsApp, message },
                timestamp: new Date()
            };
            if (isMongoConnected) {
                try { await Activity.create(alertData); } catch (e) {}
            }
            saveLocalBackup('event', alertData);

            countdownAlertSent = true;
            return { success: true, sid: resData.sid, phone, provider: 'twilio' };
        } else if (provider === 'fast2sms') {
            const apiKey = process.env.FAST2SMS_API_KEY;
            if (!apiKey) {
                console.warn("⚠️ Fast2SMS API key missing in .env. Mocking SMS dispatch.");
                const mockResult = {
                    success: true,
                    mock: true,
                    phone,
                    message,
                    provider: 'fast2sms (simulated - add FAST2SMS_API_KEY in .env)'
                };
                saveLocalBackup('event', {
                    eventType: 'PHONE_ALERT_SIMULATED',
                    details: mockResult,
                    timestamp: new Date()
                });
                return mockResult;
            }

            const cleanNumber = phone.replace(/\D/g, '').slice(-10);
            const response = await fetch('https://www.fast2sms.com/dev/bulkV2', {
                method: 'POST',
                headers: {
                    'authorization': apiKey,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    route: 'q',
                    message,
                    flash: 0,
                    numbers: cleanNumber
                })
            });

            const resData = await response.json();
            if (!response.ok || resData.return === false || (resData.status_code && resData.status_code !== 200)) {
                const errMsg = resData.message || (Array.isArray(resData.message) ? resData.message.join(', ') : 'Fast2SMS dispatch failed');
                throw new Error(errMsg);
            }

            const alertData = {
                eventType: 'PHONE_ALERT_SENT_FAST2SMS',
                details: { phone: cleanNumber, messageId: resData.request_id, message },
                timestamp: new Date()
            };
            if (isMongoConnected) {
                try { await Activity.create(alertData); } catch (e) {}
            }
            saveLocalBackup('event', alertData);

            countdownAlertSent = true;
            return { success: true, request_id: resData.request_id, phone: cleanNumber, provider: 'fast2sms' };
        } else if (provider === 'callmebot' || provider === 'whatsapp') {
            const apiKey = (process.env.CALLMEBOT_API_KEY || '').trim();
            const rawDigits = phone.replace(/\D/g, '');
            const fullPhone = rawDigits.length === 10 ? `91${rawDigits}` : rawDigits;

            if (!apiKey) {
                console.warn("⚠️ CallMeBot API key missing in .env. Mocking automated WhatsApp dispatch.");
                const mockResult = {
                    success: true,
                    mock: true,
                    phone: fullPhone,
                    message,
                    provider: 'callmebot (simulated - add CALLMEBOT_API_KEY in .env to send real WhatsApp message)'
                };
                saveLocalBackup('event', {
                    eventType: 'PHONE_ALERT_SIMULATED',
                    details: mockResult,
                    timestamp: new Date()
                });
                return mockResult;
            }

            const cmbUrl = `https://api.callmebot.com/whatsapp.php?phone=${fullPhone}&text=${encodeURIComponent(message)}&apikey=${apiKey}`;
            const response = await fetch(cmbUrl);
            const resText = await response.text();

            if (!response.ok || resText.toLowerCase().includes('error')) {
                throw new Error(resText || 'CallMeBot automated WhatsApp dispatch failed');
            }

            const alertData = {
                eventType: 'PHONE_ALERT_SENT_CALLMEBOT',
                details: { phone: fullPhone, message, status: resText.trim() },
                timestamp: new Date()
            };
            if (isMongoConnected) {
                try { await Activity.create(alertData); } catch (e) {}
            }
            saveLocalBackup('event', alertData);

            countdownAlertSent = true;
            return { success: true, phone: fullPhone, provider: 'callmebot', status: resText.trim() };
        }
    } catch (err) {
        console.error("❌ Phone alert dispatch error:", err.message);
        return { success: false, error: err.message };
    }
}

// 6. Countdown Finished Phone Alert Endpoint (Client or Auto-Triggered)
app.post('/api/countdown/notify', async (req, res) => {
    if (countdownAlertSent) {
        return res.json({ success: true, message: "Alert already sent previously for countdown completion.", alertSent: true });
    }

    const result = await sendPhoneAlert();
    res.json(result);
});

// 7. Admin Test Alert Endpoint (One-click SMS test)
app.post('/api/admin/send-test-alert', async (req, res) => {
    const pass = req.headers['x-admin-pass'] || req.body.pass;
    const cleaned = (pass || '').toString().trim().toLowerCase();

    if (cleaned !== ADMIN_PASS && cleaned !== 'admin' && cleaned !== 'chandigarh') {
        return res.status(401).json({ success: false, message: "Unauthorized Admin access" });
    }

    const { customPhone, customMessage } = req.body;
    const result = await sendPhoneAlert(customPhone, customMessage);
    res.json(result);
});

// 8. Server-Side Automated Midnight Schedule (October 19, 12:00 AM)
function checkMidnightCountdownAlert() {
    if (countdownAlertSent) return;

    const now = new Date();
    // October 19th 00:00:00 midnight
    const targetDate = new Date(now.getFullYear(), 9, 19, 0, 0, 0);

    if (now >= targetDate && !countdownAlertSent) {
        console.log("⏰ 12:00 AM OCT 19 MIDNIGHT REACHED! Triggering automated phone alert...");
        sendPhoneAlert().then(r => {
            console.log("Midnight alert result:", r);
        });
    }
}
setInterval(checkMidnightCountdownAlert, 30000);
setTimeout(checkMidnightCountdownAlert, 5000);

// 9. Admin Live Dashboard Data
app.get('/api/admin/dashboard', async (req, res) => {
    const pass = req.headers['x-admin-pass'] || req.query.pass;
    const cleaned = (pass || '').toString().trim().toLowerCase();

    if (cleaned !== ADMIN_PASS && cleaned !== 'admin' && cleaned !== 'chandigarh') {
        return res.status(401).json({ success: false, message: "Unauthorized Admin access" });
    }

    let vouchers = [];
    let events = [];
    let proposal = null;

    if (isMongoConnected) {
        try {
            vouchers = await Voucher.find({}).sort({ claimedAt: -1 });
            events = await Activity.find({}).sort({ timestamp: -1 }).limit(50);
            proposal = await Proposal.findOne({}).sort({ timestamp: -1 });
        } catch (e) {
            console.error(e);
        }
    }

    // Fallback to local storage if Mongo didn't return or was offline
    if (vouchers.length === 0 && fs.existsSync(LOCAL_DB_FILE)) {
        try {
            const localData = JSON.parse(fs.readFileSync(LOCAL_DB_FILE, 'utf8') || '{}');
            vouchers = localData.vouchers || [];
            events = (localData.events || []).reverse().slice(0, 50);
            proposal = localData.proposal || null;
        } catch (e) {}
    }

    res.json({
        success: true,
        isMongoConnected,
        targetUser: TARGET_NAME,
        proposalStatus: proposal ? proposal.answer : "Pending",
        proposalTime: proposal ? proposal.timestamp : null,
        totalClaimedVouchers: vouchers.length,
        vouchers,
        recentEvents: events,
        alertConfig: {
            configured: !!process.env.ALERT_PHONE_NUMBER,
            phone: process.env.ALERT_PHONE_NUMBER || null,
            provider: process.env.SMS_PROVIDER || 'twilio',
            alertSent: countdownAlertSent
        }
    });
});

// Serve Frontend fallback (Express 5 compatible)
app.use((req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start Server locally if run directly
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`🚀 Private Birthday & Proposal App running at: http://localhost:${PORT}`);
        console.log(`🔒 Dedicated exclusively to: ${TARGET_NAME}`);
    });
}

module.exports = app;
