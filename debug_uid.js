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

async function debugCheck(targetUid) {
    console.log('Logging in...');
    const loginRes = await makeApiRequest('/Login', {
        username: '91' + ADMIN_PHONE,
        pwd: ADMIN_PASSWORD,
        logintype: 'mobile'
    });

    const token = loginRes.data.token;
    const tokenHeader = loginRes.data.tokenHeader || 'Bearer ';
    console.log('Logged in successfully!');

    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart.getTime() + 86400000 - 1000);
    const yesterdayStart = new Date(todayStart.getTime() - 86400000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const ranges = [
        { name: 'Today', startDate: fmt(todayStart), endDate: fmt(todayEnd) },
        { name: 'Yesterday', startDate: fmt(yesterdayStart), endDate: fmt(todayStart) },
        { name: 'This Month', startDate: fmt(monthStart), endDate: fmt(todayEnd) },
    ];

    for (const range of ranges) {
        console.log(`Checking range ${range.name}: ${range.startDate} to ${range.endDate}`);
        let page = 1;
        let totalPages = 1;

        while (page <= totalPages) {
            let res = await makeApiRequest('/GetPromotionRecord', {
                startDate: range.startDate,
                endDate: range.endDate,
                level: 1,
                pageNumber: page,
                pageSize: 100,
                token: token
            }, token, tokenHeader);

            console.log(`Page ${page}/${totalPages} response code: ${res.code}, list count: ${res.data?.list?.length || 0}`);
            if (res.code === 0 && res.data) {
                totalPages = res.data.totalPage || 1;
                const list = res.data.list || [];
                const sampleUids = list.slice(0, 5).map(x => ({ bindUserID: x.bindUserID, userId: x.userId, uid: x.uid }));
                console.log('Sample item fields:', sampleUids);

                for (const item of list) {
                    const itemUid = String(item.bindUserID || item.userId || item.uid || '');
                    if (itemUid === String(targetUid).trim()) {
                        console.log(`>>> MATCH FOUND FOR UID ${targetUid} IN ${range.name}! <<<`);
                        return;
                    }
                }
                page++;
            } else {
                console.log('Error or empty response:', res);
                break;
            }
        }
    }
    console.log(`>>> UID ${targetUid} NOT FOUND IN ANY RANGE <<<`);
}

// Test with screenshot UID 735870
debugCheck('735870');
