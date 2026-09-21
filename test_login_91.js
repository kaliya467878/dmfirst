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

function makeRequest(apiPath, data) {
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

async function test() {
    const attempts = [
        { username: '91' + ADMIN_PHONE, pwd: ADMIN_PASSWORD, logintype: 'mobile' },
        { username: '+91' + ADMIN_PHONE, pwd: ADMIN_PASSWORD, logintype: 'mobile' },
        { username: ADMIN_PHONE, pwd: ADMIN_PASSWORD, logintype: 'mobile' },
        { username: '91' + ADMIN_PHONE, pwd: ADMIN_PASSWORD, logintype: 'cell' },
    ];

    for (let i = 0; i < attempts.length; i++) {
        console.log(`Testing attempt ${i+1}:`, attempts[i]);
        const res = await makeRequest('/Login', attempts[i]);
        console.log(`Result ${i+1}:`, res);
        if (res.code === 0 && res.data && res.data.token) {
            console.log('SUCCESS! Token:', res.data.token);
            return res.data.token;
        }
        await new Promise(r => setTimeout(r, 1000));
    }
}

test();
