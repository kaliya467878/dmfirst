const fs = require('fs');
const path = require('path');

const srcIcon = path.join(__dirname, 'public', 'icon-512.png');
const appResDir = path.join(__dirname, 'android_src', 'app', 'src', 'main', 'res');

const mipmapFolders = [
    'drawable',
    'mipmap-hdpi',
    'mipmap-mdpi',
    'mipmap-xhdpi',
    'mipmap-xxhdpi',
    'mipmap-xxxhdpi'
];

mipmapFolders.forEach(folder => {
    const dir = path.join(appResDir, folder);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    fs.copyFileSync(srcIcon, path.join(dir, 'ic_launcher.png'));
    fs.copyFileSync(srcIcon, path.join(dir, 'ic_launcher_round.png'));
    console.log(`Copied icon to ${folder}`);
});

// Remove adaptive vector icon files in mipmap-anydpi-v26 if present so PNG icons take precedence
const anydpiDir = path.join(appResDir, 'mipmap-anydpi-v26');
if (fs.existsSync(anydpiDir)) {
    fs.rmSync(anydpiDir, { recursive: true, force: true });
    console.log('Removed mipmap-anydpi-v26 adaptive vector launchers');
}

console.log('✅ Android custom icon setup complete!');
