require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

// Safe optional import for WhatsApp service (resilient for Vercel Serverless & Node environments)
let initWhatsApp = async () => {};
let getWhatsAppStatus = () => ({ connected: false, message: 'WhatsApp background service not initialized' });
let sendWhatsAppMessage = async () => ({ success: false, message: 'WhatsApp background service unavailable' });

try {
    const wa = require('./whatsappService');
    if (wa.initWhatsApp) initWhatsApp = wa.initWhatsApp;
    if (wa.getWhatsAppStatus) getWhatsAppStatus = wa.getWhatsAppStatus;
    if (wa.sendWhatsAppMessage) sendWhatsAppMessage = wa.sendWhatsAppMessage;
} catch (e) {
    console.warn("WhatsApp service notice (optional background module):", e.message);
}

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

// Vercel Serverless Route Normalization
app.use((req, res, next) => {
    const originalRoute = 
        (req.query && req.query.__vercel_route) ||
        req.headers['x-matched-path'] || 
        req.headers['x-forwarded-uri'] || 
        req.headers['x-invoke-path'];

    if (originalRoute && (req.url.startsWith('/api/index') || req.url === '/api' || req.url === '/api/')) {
        req.url = originalRoute.split('?')[0];
    }
    next();
});

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
        // Safe for serverless read-only filesystems
    }
}

// MongoDB Connection (Serverless-optimized with connection caching for Vercel & Node)
let dbPromise = null;

async function connectDb() {
    if (mongoose.connection.readyState === 1) {
        return true;
    }
    const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
    if (!uri) {
        return false;
    }
    try {
        if (!dbPromise || mongoose.connection.readyState === 0) {
            dbPromise = mongoose.connect(uri, {
                serverSelectionTimeoutMS: 9000,
                connectTimeoutMS: 9000
            });
        }
        await dbPromise;
        return mongoose.connection.readyState === 1;
    } catch (err) {
        dbPromise = null;
        console.error("MongoDB connection notice:", err.message);
        return false;
    }
}

// Check if MongoDB is connected
function isDbConnected() {
    return mongoose.connection.readyState === 1;
}

// Initial connection attempt (background)
connectDb().catch(() => {});

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

const Activity = mongoose.models.Activity || mongoose.model('Activity', ActivitySchema);
const Voucher = mongoose.models.Voucher || mongoose.model('Voucher', VoucherSchema);
const Proposal = mongoose.models.Proposal || mongoose.model('Proposal', ProposalSchema);

// ==========================================
// API ROUTER
// ==========================================
const apiRouter = express.Router();

// Middleware to ensure DB connection before every API request
apiRouter.use(async (req, res, next) => {
    try {
        await connectDb();
    } catch (e) {}
    next();
});

// 0. Live DB Health & Diagnostic Endpoint
apiRouter.get('/db-status', async (req, res) => {
    const isConnected = await connectDb();
    let vouchersCount = 0;
    let proposalsCount = 0;
    let activitiesCount = 0;
    let recentVouchers = [];
    let recentProposals = [];

    if (isDbConnected()) {
        try {
            vouchersCount = await Voucher.countDocuments();
            proposalsCount = await Proposal.countDocuments();
            activitiesCount = await Activity.countDocuments();
            recentVouchers = await Voucher.find({}).sort({ claimedAt: -1 }).limit(5);
            recentProposals = await Proposal.find({}).sort({ timestamp: -1 }).limit(5);
        } catch (e) {}
    }

    res.json({
        success: true,
        mongoConnected: isDbConnected(),
        readyState: mongoose.connection.readyState,
        statusText: isDbConnected() ? "CONNECTED_TO_MONGODB_ATLAS" : "DISCONNECTED",
        database: "proposal_app",
        hasMongoUriEnv: !!(process.env.MONGO_URI || process.env.MONGODB_URI),
        vouchersTotal: vouchersCount,
        proposalsTotal: proposalsCount,
        activitiesTotal: activitiesCount,
        recentVouchers,
        recentProposals,
        timestamp: new Date().toISOString()
    });
});

// 1. Authentication (Only Sengve Rongpharpi & Admin)
apiRouter.post('/auth', async (req, res) => {
    const { passkey } = req.body;
    if (!passkey) {
        return res.status(400).json({ success: false, message: "Passkey is required" });
    }

    const cleaned = passkey.toString().trim().toLowerCase();

    const isSengve = (
        cleaned === 'sengve' ||
        cleaned === 'sengve rongpharpi' ||
        cleaned === 'rongpharpi' ||
        cleaned === VIP_PASS ||
        cleaned === 'sengve19' ||
        cleaned === '1910'
    );

    const isAdmin = (
        cleaned === ADMIN_PASS ||
        cleaned === 'admin' ||
        cleaned === 'chandigarh'
    );

    if (isSengve) {
        const eventData = {
            userName: TARGET_NAME,
            eventType: 'LOGIN_VIP_SENGVE',
            details: { passkeyUsed: passkey },
            timestamp: new Date()
        };

        if (isDbConnected()) {
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

    return res.status(403).json({
        success: false,
        message: "Access Denied. This private experience is strictly reserved for Sengve Rongpharpi."
    });
});

// 2. Log Activity Events
apiRouter.post('/event', async (req, res) => {
    const { eventType, details } = req.body;
    const eventData = {
        userName: TARGET_NAME,
        eventType: eventType || 'GENERIC_EVENT',
        details: details || {},
        timestamp: new Date()
    };

    if (isDbConnected()) {
        try { await Activity.create(eventData); } catch (e) {}
    }
    saveLocalBackup('event', eventData);

    res.json({ success: true, message: "Event recorded in DB" });
});

// 3. Claim Voucher (Inserts directly to MongoDB Atlas)
apiRouter.post('/vouchers/claim', async (req, res) => {
    const { voucherName } = req.body;
    if (!voucherName) {
        return res.status(400).json({ success: false, message: "Voucher name required" });
    }

    const voucherData = {
        userName: TARGET_NAME,
        voucherName,
        claimedAt: new Date()
    };

    let savedToMongo = false;
    let mongoError = null;

    try {
        await connectDb();
        if (isDbConnected()) {
            await Voucher.create(voucherData);
            try {
                await Activity.create({
                    userName: TARGET_NAME,
                    eventType: 'VOUCHER_CLAIMED',
                    details: { voucherName },
                    timestamp: new Date()
                });
            } catch (e) {}
            savedToMongo = true;
            console.log(`✅ Voucher saved to MongoDB Atlas: ${voucherName}`);
        } else {
            console.warn(`⚠️ Mongoose not connected (readyState=${mongoose.connection.readyState})`);
        }
    } catch (err) {
        mongoError = err.message;
        console.error("MongoDB Voucher Insert Error:", err.message);
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
        savedToMongo,
        mongoError,
        message: savedToMongo
            ? `Voucher "${voucherName}" successfully recorded in MongoDB Atlas! ❤️`
            : `Voucher "${voucherName}" saved locally (MongoDB readyState: ${mongoose.connection.readyState}).`,
        data: voucherData
    });
});

// 3b. Get All Claimed Vouchers
apiRouter.get('/vouchers', async (req, res) => {
    try {
        await connectDb();
        if (isDbConnected()) {
            const vouchers = await Voucher.find({}).sort({ claimedAt: -1 });
            return res.json({ success: true, vouchers });
        }
    } catch (e) {}

    let vouchers = [];
    if (fs.existsSync(LOCAL_DB_FILE)) {
        try {
            vouchers = JSON.parse(fs.readFileSync(LOCAL_DB_FILE, 'utf8') || '{}').vouchers || [];
        } catch (e) {}
    }
    res.json({ success: true, vouchers, fallback: true });
});

// 4. Proposal Response (YES Acceptance saved directly to MongoDB Atlas)
apiRouter.post('/proposal/respond', async (req, res) => {
    const { answer } = req.body;
    const proposalData = {
        userName: TARGET_NAME,
        answer: answer || "YES",
        timestamp: new Date()
    };

    let savedToMongo = false;
    let mongoError = null;

    try {
        await connectDb();
        if (isDbConnected()) {
            await Proposal.create(proposalData);
            try {
                await Activity.create({
                    userName: TARGET_NAME,
                    eventType: 'PROPOSAL_ACCEPTED',
                    details: { answer: proposalData.answer },
                    timestamp: new Date()
                });
            } catch (e) {}
            savedToMongo = true;
            console.log(`✅ Proposal response saved to MongoDB Atlas: ${proposalData.answer}`);
        } else {
            console.warn(`⚠️ Mongoose not connected (readyState=${mongoose.connection.readyState})`);
        }
    } catch (err) {
        mongoError = err.message;
        console.error("MongoDB Proposal Insert Error:", err.message);
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
        savedToMongo,
        mongoError,
        message: savedToMongo
            ? "Proposal response permanently locked into MongoDB Atlas! ❤️"
            : `Proposal response recorded locally (MongoDB readyState: ${mongoose.connection.readyState}).`,
        data: proposalData
    });
});

// 4b. Get Proposal Status
apiRouter.get('/proposal/status', async (req, res) => {
    try {
        await connectDb();
        if (isDbConnected()) {
            const proposal = await Proposal.findOne({}).sort({ timestamp: -1 });
            return res.json({ success: true, proposal });
        }
    } catch (e) {}

    let proposal = null;
    if (fs.existsSync(LOCAL_DB_FILE)) {
        try {
            proposal = JSON.parse(fs.readFileSync(LOCAL_DB_FILE, 'utf8') || '{}').proposal || null;
        } catch (e) {}
    }
    res.json({ success: true, proposal, fallback: true });
});

// 5. Automated Phone Alert Service
let countdownAlertSent = false;

async function sendPhoneAlert(customPhone = null, customMessage = null) {
    const phone = (customPhone || process.env.ALERT_PHONE_NUMBER || '').trim();
    const appUrl = (process.env.APP_PUBLIC_URL || `http://localhost:${PORT}`).trim();
    const baseMessage = customMessage || process.env.ALERT_MESSAGE || 'Wishing you a very Happy 26th Birthday, Sengve! 🎂✨ Handcrafted with love from Amitson in Chandigarh — please open your special link:';
    const message = baseMessage.includes('http') ? baseMessage : `${baseMessage} ${appUrl}`;
    const provider = (process.env.SMS_PROVIDER || 'twilio').toLowerCase().trim();

    if (!phone) {
        console.warn("⚠️ Phone alert notice: ALERT_PHONE_NUMBER is not set in .env");
        return { success: false, message: "ALERT_PHONE_NUMBER is not configured in .env" };
    }

    console.log(`📱 Triggering automated phone alert to: ${phone} via ${provider}`);

    try {
        if (provider === 'whatsapp' || provider === 'baileys' || !provider) {
            const waRes = await sendWhatsAppMessage(phone, message);
            if (!waRes.success) {
                console.warn("⚠️ WhatsApp dispatch notice:", waRes.message || waRes.error);
                return waRes;
            }

            const alertData = {
                eventType: 'PHONE_ALERT_SENT_WHATSAPP',
                details: { phone: waRes.phone, message, messageId: waRes.messageId },
                timestamp: new Date()
            };
            if (isDbConnected()) {
                try { await Activity.create(alertData); } catch (e) {}
            }
            saveLocalBackup('event', alertData);

            countdownAlertSent = true;
            return {
                success: true,
                phone: waRes.phone,
                messageId: waRes.messageId,
                provider: 'whatsapp'
            };
        } else if (provider === 'twilio') {
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
            if (isDbConnected()) {
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
            if (isDbConnected()) {
                try { await Activity.create(alertData); } catch (e) {}
            }
            saveLocalBackup('event', alertData);

            countdownAlertSent = true;
            return { success: true, request_id: resData.request_id, phone: cleanNumber, provider: 'fast2sms' };
        } else if (provider === 'callmebot') {
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
            if (isDbConnected()) {
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

// 6. Countdown Finished Phone Alert Endpoint
apiRouter.post('/countdown/notify', async (req, res) => {
    if (countdownAlertSent) {
        return res.json({ success: true, message: "Alert already sent previously for countdown completion.", alertSent: true });
    }

    const result = await sendPhoneAlert();
    res.json(result);
});

// 7. Admin Test Alert Endpoint
apiRouter.post('/admin/send-test-alert', async (req, res) => {
    const pass = req.headers['x-admin-pass'] || req.body.pass;
    const cleaned = (pass || '').toString().trim().toLowerCase();

    if (cleaned !== ADMIN_PASS && cleaned !== 'admin' && cleaned !== 'chandigarh') {
        return res.status(401).json({ success: false, message: "Unauthorized Admin access" });
    }

    const { customPhone, customMessage } = req.body;
    const result = await sendPhoneAlert(customPhone, customMessage);
    res.json(result);
});

// 8. Admin Live Dashboard Data
apiRouter.get('/admin/dashboard', async (req, res) => {
    const pass = req.headers['x-admin-pass'] || req.query.pass;
    const cleaned = (pass || '').toString().trim().toLowerCase();

    if (cleaned !== ADMIN_PASS && cleaned !== 'admin' && cleaned !== 'chandigarh') {
        return res.status(401).json({ success: false, message: "Unauthorized Admin access" });
    }

    let vouchers = [];
    let events = [];
    let proposal = null;

    if (isDbConnected()) {
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
        isMongoConnected: isDbConnected(),
        targetUser: TARGET_NAME,
        proposalStatus: proposal ? proposal.answer : "Pending",
        proposalTime: proposal ? proposal.timestamp : null,
        totalClaimedVouchers: vouchers.length,
        vouchers,
        recentEvents: events,
        alertConfig: {
            configured: !!process.env.ALERT_PHONE_NUMBER,
            phone: process.env.ALERT_PHONE_NUMBER || null,
            provider: process.env.SMS_PROVIDER || 'whatsapp',
            alertSent: countdownAlertSent
        },
        whatsappStatus: getWhatsAppStatus()
    });
});

// 9. WhatsApp Status & QR Code Endpoint
apiRouter.get('/admin/whatsapp/status', (req, res) => {
    res.json(getWhatsAppStatus());
});

// 10. WhatsApp Reconnect / Fresh QR Endpoint
apiRouter.post('/admin/whatsapp/reconnect', async (req, res) => {
    const pass = req.headers['x-admin-pass'] || req.body.pass;
    const cleaned = (pass || '').toString().trim().toLowerCase();
    if (cleaned !== ADMIN_PASS && cleaned !== 'admin' && cleaned !== 'chandigarh') {
        return res.status(401).json({ success: false, message: "Unauthorized Admin access" });
    }
    await initWhatsApp(true);
    res.json({ success: true, message: "WhatsApp reconnection started." });
});

// Mount API Router on both '/api' and '/'
app.use('/api', apiRouter);
app.use(apiRouter);

// Return JSON 404 for unhandled /api requests
app.use((req, res, next) => {
    if (req.path.startsWith('/api')) {
        return res.status(404).json({ success: false, message: `API route not found: ${req.method} ${req.url}` });
    }
    next();
});

// Serve Frontend fallback for SPA
app.use((req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Server-Side Automated Midnight Schedule (runs when executed directly in Node)
function checkMidnightCountdownAlert() {
    if (countdownAlertSent) return;

    const now = new Date();
    const targetDate = new Date(now.getFullYear(), 9, 19, 0, 0, 0);

    if (now >= targetDate && !countdownAlertSent) {
        console.log("⏰ 12:00 AM OCT 19 MIDNIGHT REACHED! Triggering automated phone alert...");
        sendPhoneAlert().then(r => {
            console.log("Midnight alert result:", r);
        });
    }
}

// Start Server locally if run directly
if (require.main === module) {
    setInterval(checkMidnightCountdownAlert, 30000);
    setTimeout(checkMidnightCountdownAlert, 5000);

    app.listen(PORT, () => {
        console.log(`🚀 Private Birthday & Proposal App running at: http://localhost:${PORT}`);
        console.log(`🔒 Dedicated exclusively to: ${TARGET_NAME}`);
        initWhatsApp().catch(e => console.error("WhatsApp init error:", e.message));
    });
}

module.exports = app;
