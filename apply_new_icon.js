const fs = require('fs');
const path = require('path');

const userUploadedIcon = 'C:\\Users\\praja\\.gemini\\antigravity\\brain\\7a85287e-ef32-4580-beca-3e84739024b0\\.user_uploaded\\media_1790019672572.jpg';
const projectDir = __dirname;
const publicDir = path.join(projectDir, 'public');
const appResDir = path.join(projectDir, 'android_src', 'app', 'src', 'main', 'res');

console.log('Copying user uploaded icon to public folder...');
fs.copyFileSync(userUploadedIcon, path.join(publicDir, 'icon-512.jpg'));
fs.copyFileSync(userUploadedIcon, path.join(publicDir, 'icon-512.png'));
fs.copyFileSync(userUploadedIcon, path.join(publicDir, 'icon-192.png'));
fs.copyFileSync(userUploadedIcon, path.join(publicDir, 'favicon.ico'));

const folders = [
    'drawable',
    'mipmap-hdpi',
    'mipmap-mdpi',
    'mipmap-xhdpi',
    'mipmap-xxhdpi',
    'mipmap-xxxhdpi'
];

folders.forEach(folder => {
    const dir = path.join(appResDir, folder);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    fs.copyFileSync(userUploadedIcon, path.join(dir, 'ic_launcher.png'));
    fs.copyFileSync(userUploadedIcon, path.join(dir, 'ic_launcher_round.png'));
    console.log(`Updated icon in ${folder}`);
});

// Remove adaptive vector icon files in mipmap-anydpi-v26 if present
const anydpiDir = path.join(appResDir, 'mipmap-anydpi-v26');
if (fs.existsSync(anydpiDir)) {
    fs.rmSync(anydpiDir, { recursive: true, force: true });
}

console.log('🎉 Successfully applied the new golden DmFirst icon across the Web app and Android app!');
