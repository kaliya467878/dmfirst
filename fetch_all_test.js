const https = require('https');
const crypto = require('crypto');

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

async function fetchAllSubordinates() {
    console.log('Logging in to dmfirst...');
    const loginRes = await makeApiRequest('/Login', {
        username: '91' + ADMIN_PHONE,
        pwd: ADMIN_PASSWORD,
        logintype: 'mobile'
    });

    if (loginRes.code !== 0 || !loginRes.data?.token) {
        console.error('Login failed:', loginRes);
        return [];
    }

    const token = loginRes.data.token;
    const tokenHeader = loginRes.data.tokenHeader || 'Bearer ';

    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

    // Get last 60 days to cover everything (Today, Yesterday, This Month, Last Month)
    const startDate = fmt(new Date(now.getTime() - 60 * 86400000));
    const endDate = fmt(new Date(now.getTime() + 86400000));

    console.log(`Fetching all subordinates from ${startDate} to ${endDate}...`);

    const allUids = new Set();
    let page = 1;
    let totalPages = 1;

    while (page <= totalPages) {
        const res = await makeApiRequest('/GetPromotionRecord', {
            startDate,
            endDate,
            level: 1,
            pageNo: page,
            pageSize: 100,
            token: token
        }, token, tokenHeader);

        if (res.code === 0 && res.data) {
            totalPages = res.data.totalPage || 1;
            const list = res.data.list || [];
            list.forEach(item => {
                if (item.bindUserID) allUids.add(String(item.bindUserID).trim());
                if (item.userId) allUids.add(String(item.userId).trim());
                if (item.uid) allUids.add(String(item.uid).trim());
            });
            console.log(`Page ${page}/${totalPages} loaded. Current total UIDs: ${allUids.size}`);
            page++;
        } else {
            console.error(`Page ${page} failed:`, res);
            break;
        }
    }

    console.log(`Total subordinates fetched: ${allUids.size}`);
    return Array.from(allUids);
}

fetchAllSubordinates();
