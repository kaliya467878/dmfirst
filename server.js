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

// In-memory set of all subordinate UIDs across all levels
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

// ============== SYNC ALL SUBORDINATES (LEVELS 1, 2, 3) FROM DMFIRST ==============
let currentSyncPromise = null;

async function syncAllSubordinates() {
    if (currentSyncPromise) {
        return currentSyncPromise;
    }

    currentSyncPromise = (async () => {
        if (!adminToken) {
            const ok = await adminLogin();
            if (!ok) return;
        }

        try {
            const newUids = new Set();
            const levels = [1, 2, 3]; // Query all levels (Direct + Indirect subordinates)

            for (const level of levels) {
                let page = 1;
                let totalPages = 1;

                while (page <= totalPages) {
                    let res = await makeApiRequest('/GetPromotionRecord', {
                        startDate: '',
                        endDate: '',
                        level: level,
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
                            startDate: '',
                            endDate: '',
                            level: level,
                            pageNo: page,
                            pageSize: 100,
                            token: adminToken
                        }, adminToken, tokenHeader);
                    }

                    if (res.code === 0 && res.data) {
                        const totalCount = res.data.total || res.data.totalCount || res.data.count || 0;
                        const pageSize = res.data.pageSize || 100;
                        totalPages = res.data.totalPage || res.data.pageCount || res.data.totalPages || (totalCount > 0 ? Math.ceil(totalCount / pageSize) : 1);
                        
                        const list = res.data.list || [];

                        list.forEach(item => {
                            // Extract all properties to ensure no ID / bindID / phone / account field is missed
                            Object.keys(item).forEach(k => {
                                const val = String(item[k] || '').trim();
                                if (val && val.length >= 3 && !val.includes('{') && !val.includes('[')) {
                                    newUids.add(val);
                                    if (val.startsWith('91') && val.length > 5) {
                                        newUids.add(val.slice(2));
                                    }
                                    if (!val.startsWith('91') && val.length === 10) {
                                        newUids.add('91' + val);
                                    }
                                }
                            });
                        });
                        page++;
                    } else {
                        console.log(`[Sync] Level ${level} failed at page ${page}:`, res);
                        break;
                    }
                }
            }

            if (newUids.size > 0) {
                verifiedUidsSet = newUids;
                lastSyncTime = Date.now();
                console.log(`[Sync] ✅ Successfully synchronized ${verifiedUidsSet.size} subordinate UIDs (Levels 1, 2, 3) from DMFirst!`);
            }
        } catch (e) {
            console.log('[Sync] Error syncing subordinates:', e.message);
        } finally {
            currentSyncPromise = null;
        }
    })();

    return currentSyncPromise;
}

// ============== VERIFY UID (AUTOMATED WITH CLEANING) ==============
async function verifyUidAutomated(targetUid) {
    let cleanTargetUid = String(targetUid).trim();
    if (!cleanTargetUid) return { found: false, message: 'UID cannot be empty' };

    // Strip leading + or +91 if user typed phone prefix
    if (cleanTargetUid.startsWith('+91')) cleanTargetUid = cleanTargetUid.slice(3);
    else if (cleanTargetUid.startsWith('+')) cleanTargetUid = cleanTargetUid.slice(1);

    const digitsOnly = cleanTargetUid.replace(/\D/g, '');

    const candidates = [
        cleanTargetUid,
        '91' + cleanTargetUid,
        digitsOnly,
        '91' + digitsOnly
    ].filter(Boolean);

    for (const cand of candidates) {
        if (verifiedUidsSet.has(cand)) {
            console.log(`[Verify UID] 🎉 UID ${cleanTargetUid} MATCHED (via candidate '${cand}')!`);
            return { found: true };
        }
    }

    // Live sync fallback across all levels
    console.log(`[Verify UID] UID ${cleanTargetUid} not in memory, performing live sync...`);
    await syncAllSubordinates();

    for (const cand of candidates) {
        if (verifiedUidsSet.has(cand)) {
            console.log(`[Verify UID] 🎉 UID ${cleanTargetUid} MATCHED after live sync!`);
            return { found: true };
        }
    }

    console.log(`[Verify UID] ❌ UID ${cleanTargetUid} not found in DMFirst records (${verifiedUidsSet.size} UIDs in memory).`);
    return { found: false };
}

// ============== AI DEPOSIT OCR PARSER (STRICT STATUS + DATE + AMOUNT >= 300) ==============
function parseDepositText(text, targetDate) {
    console.log(`[AI OCR] Analyzing text for target date: ${targetDate}`);
    
    // 1. Basic validity check for deposit history page
    const isDeposit = /Deposit|Order|RC20|History|Recharge|UPI|Pay/i.test(text);
    if (!isDeposit) {
        return { 
            approved: false, 
            reason: '⚠️ Sahi Deposit History ka Screenshot upload karein (DMFirst -> Deposit History).' 
        };
    }

    // Prepare date regex (e.g. 2026-09-22 or 2026/09/22)
    const dateRegexStr = targetDate.replace(/-/g, '[-/\\.]');
    const todayRegex = new RegExp(dateRegexStr, 'g');

    // Split text into deposit cards by Deposit/Order/Recharge keywords or date headers
    let cardChunks = text.split(/(?=\bDeposit\b|\bOrder\b|\bRecharge\b|\b\d{4}[-/]\d{2}[-/]\d{2}\b)/i)
                         .map(c => c.trim())
                         .filter(c => c.length > 15);

    if (cardChunks.length === 0) {
        cardChunks = [text];
    }

    console.log('[AI OCR] Total Deposit Cards detected:', cardChunks.length);

    let approvedAmounts = [];

    cardChunks.forEach((card, idx) => {
        const hasToday = todayRegex.test(card);
        // Positive check: Must explicitly contain Complete/Completed/Succeed/Success
        const hasPositive = /complete|completed|succeed|success/i.test(card);

        // Negative check: Reject if contains any non-completed status like Paid, De paid, To be paid, Unpaid, Pending, Failed, etc.
        const hasNegative = /paid|payed|unpaid|pending|failed|refus|process|timeout|cancel|uncompleted|incomplete/i.test(card);

        console.log(`[AI OCR] Card ${idx+1}: Today=${hasToday}, Positive(Complete)=${hasPositive}, Negative(Paid/Pending/Failed)=${hasNegative}`);

        // MUST have Today's date AND status MUST be Complete/Success AND MUST NOT contain any Paid/Pending/Failed status
        if (hasToday && hasPositive && !hasNegative) {
            const matches = card.match(/([1-9]\d{0,2}(?:,\d{3})+|[1-9]\d{2,5})(?:\.\d{2})?/g);
            if (matches) {
                matches.forEach(m => {
                    const clean = parseFloat(m.replace(/,/g, ''));
                    if (!isNaN(clean) && clean !== 2026 && clean !== 2025 && clean >= 100 && clean <= 500000) {
                        approvedAmounts.push(clean);
                    }
                });
            }
        }
    });

    console.log('[AI OCR] Approved Amounts:', approvedAmounts);

    const validAmount = approvedAmounts.find(amt => amt >= 300);

    if (!validAmount) {
        return { 
            approved: false, 
            reason: `⚠️ Aaj ki date (${targetDate}) par Completed deposit ₹300 se kam hai (ya status Complete nahi hai). Status 'Paid' / 'To be paid' / 'Pending' reject hota hai.` 
        };
    }

    return {
        approved: true,
        amount: validAmount,
        reason: `✅ Aaj ka Completed Deposit Verified: ₹${validAmount}!`
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
    console.log(`🤖 Live Automated DMFirst Sync Engine (Levels 1,2,3): INITIALIZING`);
    console.log(`📸 AI Deposit History OCR Engine (Strict Complete Status): INITIALIZING`);
    console.log('======================================================\n');

    await adminLogin();
    await syncAllSubordinates();

    // Background auto-sync every 60 seconds
    setInterval(() => {
        syncAllSubordinates();
    }, 60000);
});
