const fs = require('fs');
const path = require('path');

const appResDir = path.join(__dirname, 'android_src', 'app', 'src', 'main', 'res');

function removeWebpFiles(dir) {
    if (!fs.existsSync(dir)) return;
    const items = fs.readdirSync(dir);
    for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            removeWebpFiles(fullPath);
        } else if (item.endsWith('.webp')) {
            fs.unlinkSync(fullPath);
            console.log(`Deleted duplicate webp resource: ${fullPath}`);
        }
    }
}

console.log('Cleaning up duplicate .webp launcher icons...');
removeWebpFiles(appResDir);
console.log('✅ Cleaned all .webp duplicate resources successfully!');
