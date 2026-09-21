const fs = require('fs');

const content = fs.readFileSync('C:/Users/praja/.gemini/antigravity/brain/7a85287e-ef32-4580-beca-3e84739024b0/.system_generated/steps/86/content.md', 'utf8');

let pos = 0;
while ((pos = content.indexOf('Dce(', pos)) !== -1) {
    console.log('--- Dce at', pos, '---');
    console.log(content.substring(Math.max(0, pos - 300), Math.min(content.length, pos + 500)));
    pos += 4;
}
