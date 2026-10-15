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
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
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

// 5. Admin Live Dashboard Data
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
        recentEvents: events
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
