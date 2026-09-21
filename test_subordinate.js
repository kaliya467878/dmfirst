const https = require('https');
const crypto = require('crypto');

const API_BASE = 'https://api.dmfirst9api.com';
const ADMIN_PHONE = '9341225312';
const ADMIN_PASSWORD = 'qwerty1234';

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

function makeRequest(apiPath, data, token = '', tokenHeader = '') {
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
                'Authorization': tokenHeader ? (tokenHeader + token) : token,
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

async function run() {
    console.log('Logging in...');
    const loginRes = await makeRequest('/Login', {
        username: '91' + ADMIN_PHONE,
        pwd: ADMIN_PASSWORD,
        logintype: 'mobile'
    });

    if (loginRes.code !== 0) {
        console.error('Login failed:', loginRes);
        return;
    }

    const token = loginRes.data.token;
    const tokenHeader = loginRes.data.tokenHeader || 'Bearer ';
    console.log('Login OK! Fetching promotion record...');

    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart.getTime() + 86400000 - 1000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const res = await makeRequest('/GetPromotionRecord', {
        startDate: fmt(monthStart),
        endDate: fmt(todayEnd),
        level: 1,
        pageNumber: 1,
        pageSize: 100,
        token: token
    }, token, tokenHeader);

    console.log('GetPromotionRecord result:', JSON.stringify(res, null, 2));
}

run();
