const http = require('http');
const https = require('https');
const url = require('url');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Tesseract = require('tesseract.js');

// ============== CONFIG ==============
const API_BASE = 'https://api.dmfirst9api.com';
const ADMIN_PHONE = '9341225312';
const ADMIN_PASSWORD = 'qwerty1234';
const PORT = 8080;

let adminToken = '';
let tokenHeader = 'Bearer ';

// In-memory set of all subordinate UIDs
let verifiedUidsSet = new Set();
let lastSyncTime = 0;
let isSyncing = false;

// Tesseract Worker Singleton
let ocrWorker = null;
async function getOCRWorker() {
    if (!ocrWorker) {
        ocrWorker = await Tesseract.createWorker('eng');
    }
    return ocrWorker;
}

// ============== SIGNATURE GENERATOR ==============
function generateRandom() {
    return 'xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

function generateSignature(data) {
    const sorted = {};
    const excludeKeys = ['signature', 'track', 'xosoBettingData'];
    Object.keys(data).sort().forEach(key => {
        const val = data[key];
        if (val !== null && val !== '' && !excludeKeys.includes(key)) {
            sorted[key] = val === 0 ? 0 : val;
        }
    });
    const str = JSON.stringify(sorted);
    return crypto.createHash('md5').update(str).digest('hex').toUpperCase().slice(0, 32);
}

function signRequest(data) {
    data.language = 0;
    data.random = generateRandom();
    data.signature = generateSignature(data);
    data.timestamp = Math.floor(Date.now() / 1000);
    return data;
}

// ============== HTTP API REQUEST HELPER ==============
function makeApiRequest(apiPath, data, token = '', customHeader = '') {
    return new Promise((resolve, reject) => {
        const signedData = signRequest({ ...data });
        const postData = JSON.stringify(signedData);

        const options = {
            hostname: 'api.dmfirst9api.com',
            port: 443,
            path: '/api/webapi' + apiPath,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json;charset=UTF-8',
                'Authorization': customHeader ? (customHeader + token) : (token ? 'Bearer ' + token : ''),
                'Origin': 'https://dmfirst0.com',
                'Referer': 'https://dmfirst0.com/',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
            }
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(body));
                } catch (e) {
                    resolve({ error: body });
                }
            });
        });

        req.on('error', reject);
        req.write(postData);
        req.end();
    });
}

// ============== ADMIN LOGIN ==============
async function adminLogin() {
    try {
        const result = await makeApiRequest('/Login', {
            username: '91' + ADMIN_PHONE,
            pwd: ADMIN_PASSWORD,
            logintype: 'mobile'
        });

        if (result.code === 0 && result.data && result.data.token) {
            adminToken = result.data.token;
            tokenHeader = result.data.tokenHeader || 'Bearer ';
            console.log('[Server] ✅ Admin Login successful!');
            return true;
        } else {
            console.log('[Server] ❌ Admin Login failed:', JSON.stringify(result));
            return false;
        }
    } catch (e) {
        console.log('[Server] 💥 Login error:', e.message);
        return false;
    }
}

// ============== SYNC ALL SUBORDINATES FROM DMFIRST ==============
async function syncAllSubordinates() {
    if (isSyncing) return;
    isSyncing = true;

    if (!adminToken) {
        const ok = await adminLogin();
        if (!ok) {
            isSyncing = false;
            return;
        }
    }

    try {
        const now = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

        // Fetch last 90 days of records
        const startDate = fmt(new Date(now.getTime() - 90 * 86400000));
        const endDate = fmt(new Date(now.getTime() + 86400000));

        let page = 1;
        let totalPages = 1;
        const newUids = new Set();

        while (page <= totalPages) {
            let res = await makeApiRequest('/GetPromotionRecord', {
                startDate,
                endDate,
                level: 1,
                pageNo: page,
                pageSize: 100,
                token: adminToken
            }, adminToken, tokenHeader);

            // Re-login if token expired or permission error
            if (res.code !== 0) {
                console.log('[Sync] Token invalid/expired (code ' + res.code + '), re-logging in...');
                const ok = await adminLogin();
                if (!ok) break;
                res = await makeApiRequest('/GetPromotionRecord', {
                    startDate,
                    endDate,
                    level: 1,
                    pageNo: page,
                    pageSize: 100,
                    token: adminToken
                }, adminToken, tokenHeader);
            }

            if (res.code === 0 && res.data) {
                totalPages = res.data.totalPage || 1;
                const list = res.data.list || [];

                list.forEach(item => {
                    const u1 = String(item.bindUserID || '').trim();
                    const u2 = String(item.userId || '').trim();
                    const u3 = String(item.uid || '').trim();
                    if (u1) newUids.add(u1);
                    if (u2) newUids.add(u2);
                    if (u3) newUids.add(u3);
                });
                page++;
            } else {
                console.log('[Sync] Failed at page ' + page + ':', res);
                break;
            }
        }

        if (newUids.size > 0) {
            verifiedUidsSet = newUids;
            lastSyncTime = Date.now();
            console.log(`[Sync] ✅ Successfully synchronized ${verifiedUidsSet.size} subordinate UIDs from DMFirst!`);
        }
    } catch (e) {
        console.log('[Sync] Error syncing subordinates:', e.message);
    } finally {
        isSyncing = false;
    }
}

// ============== VERIFY UID ==============
async function verifyUidAutomated(targetUid) {
    const cleanTargetUid = String(targetUid).trim();
    if (!cleanTargetUid) return { found: false, message: 'UID cannot be empty' };

    // Check in-memory set first
    if (verifiedUidsSet.has(cleanTargetUid)) {
        console.log(`[Verify UID] 🎉 UID ${cleanTargetUid} MATCHED!`);
        return { found: true };
    }

    // Live sync fallback
    console.log(`[Verify UID] UID ${cleanTargetUid} not in memory, performing live sync...`);
    await syncAllSubordinates();

    if (verifiedUidsSet.has(cleanTargetUid)) {
        console.log(`[Verify UID] 🎉 UID ${cleanTargetUid} MATCHED after live sync!`);
        return { found: true };
    }

    console.log(`[Verify UID] ❌ UID ${cleanTargetUid} not found in DMFirst records.`);
    return { found: false };
}

// ============== AI DEPOSIT OCR PARSER ==============
function parseDepositText(text, targetDate) {
    console.log(`[AI OCR] Analyzing text for target date: ${targetDate}`);
    
    // Basic validity check for deposit history
    const isDeposit = /Deposit|Order|RC20|History|Recharge|Complete|Failed|UPI/i.test(text);
    if (!isDeposit) {
        return { 
            approved: false, 
            reason: '⚠️ Sahi Deposit History ka Screenshot upload karein (DMFirst -> Deposit History).' 
        };
    }

    // Check target date (YYYY-MM-DD or YYYY/MM/DD or YYYY.MM.DD)
    const dateRegexStr = targetDate.replace(/-/g, '[-/\\.]');
    const todayRegex = new RegExp(dateRegexStr, 'g');
    const hasTodayDate = todayRegex.test(text);

    if (!hasTodayDate) {
        return { 
            approved: false, 
            reason: `⚠️ Aaj ki date (${targetDate}) ka deposit nahi mila. Kripya aaj ki date ka Deposit History screenshot upload karein.` 
        };
    }

    // Extract amounts from lines
    const lines = text.split('\n');
    let amounts = [];

    lines.forEach(line => {
        if (/Order\s*amount|amount|Complete/i.test(line) || /[₹%]\s*\d/.test(line)) {
            const matches = line.match(/([1-9]\d{0,2}(?:,\d{3})+|[1-9]\d{2,5})(?:\.\d{2})?/g);
            if (matches) {
                matches.forEach(m => {
                    const clean = parseFloat(m.replace(/,/g, ''));
                    if (!isNaN(clean) && clean !== 2026 && clean !== 2025 && clean >= 100) {
                        amounts.push(clean);
                    }
                });
            }
        }
    });

    // Fallback: search overall text for numbers >= 300
    if (amounts.length === 0) {
        const allMatches = text.match(/([1-9]\d{0,2}(?:,\d{3})+|[1-9]\d{2,5})(?:\.\d{2})?/g);
        if (allMatches) {
            allMatches.forEach(m => {
                const clean = parseFloat(m.replace(/,/g, ''));
                if (!isNaN(clean) && clean !== 2026 && clean !== 2025 && clean >= 300 && clean <= 500000) {
                    amounts.push(clean);
                }
            });
        }
    }

    console.log('[AI OCR] Parsed Amounts:', amounts);

    const validAmount = amounts.find(amt => amt >= 300);

    if (!validAmount) {
        return { 
            approved: false, 
            reason: `⚠️ Aaj ki date ka deposit ₹300 se kam hai. Minimum ₹300 recharge required for access.` 
        };
    }

    return {
        approved: true,
        amount: validAmount,
        reason: `✅ Aaj ka Deposit Verified: ₹${validAmount}!`
    };
}

async function verifyDepositImage(base64Image) {
    try {
        const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '');
        const imgBuffer = Buffer.from(base64Data, 'base64');

        const worker = await getOCRWorker();
        const ret = await worker.recognize(imgBuffer);
        const ocrText = ret.data.text;
        console.log('[AI OCR] Text extracted length:', ocrText.length);

        // Get IST today's date
        const now = new Date();
        const istOffset = 5.5 * 60 * 60 * 1000;
        const istDate = new Date(now.getTime() + istOffset);
        const y = istDate.getUTCFullYear();
        const m = String(istDate.getUTCMonth() + 1).padStart(2, '0');
        const d = String(istDate.getUTCDate()).padStart(2, '0');
        const todayDateStr = `${y}-${m}-${d}`;

        return parseDepositText(ocrText, todayDateStr);
    } catch (e) {
        console.error('[AI OCR] Error recognizing image:', e);
        return { approved: false, reason: '⚠️ Image process karne mein error aayi. Clear screenshot upload karein.' };
    }
}

// ============== HTTP SERVER ==============
const server = http.createServer(async (req, res) => {
    const parsed = url.parse(req.url, true);

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    // API 1: Verify UID
    if (parsed.pathname === '/api/verify-uid' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                const { uid } = JSON.parse(body);
                const result = await verifyUidAutomated(uid);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(result));
            } catch (e) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: e.message }));
            }
        });
        return;
    }

    // API 2: Verify Deposit Screenshot (AI OCR)
    if (parsed.pathname === '/api/verify-deposit' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                const { image } = JSON.parse(body);
                if (!image) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ approved: false, reason: '⚠️ Image data missing!' }));
                    return;
                }
                const result = await verifyDepositImage(image);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(result));
            } catch (e) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ approved: false, error: e.message }));
            }
        });
        return;
    }

    // Static file serving
    let filePath = parsed.pathname === '/' ? '/index.html' : parsed.pathname;
    filePath = path.join(__dirname, filePath);

    const ext = path.extname(filePath);
    const mimeTypes = {
        '.html': 'text/html',
        '.js': 'application/javascript',
        '.css': 'text/css',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.ico': 'image/x-icon',
    };

    const contentType = mimeTypes[ext] || 'text/plain';

    fs.readFile(filePath, (err, content) => {
        if (err) {
            res.writeHead(404);
            res.end('Not Found');
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content);
        }
    });
});

// Start Server & Sync Engine
server.listen(PORT, async () => {
    console.log('\n======================================================');
    console.log(`🎯 WinGo Predictor Server running at: http://localhost:${PORT}`);
    console.log(`🤖 Live Automated DMFirst Sync Engine: INITIALIZING`);
    console.log(`📸 AI Deposit History OCR Engine: INITIALIZING`);
    console.log('======================================================\n');

    await adminLogin();
    await syncAllSubordinates();

    // Background auto-sync every 60 seconds
    setInterval(() => {
        syncAllSubordinates();
    }, 60000);
});
