const fs = require('fs');

const content = fs.readFileSync('C:/Users/praja/.gemini/antigravity/brain/7a85287e-ef32-4580-beca-3e84739024b0/.system_generated/steps/86/content.md', 'utf8');

// Search for login handler / Login API call references
const pos = content.indexOf('$.Login');
if (pos !== -1) {
    console.log('--- FOUND $.Login ---');
    console.log(content.substring(Math.max(0, pos - 500), Math.min(content.length, pos + 500)));
}

const pos2 = content.indexOf('userForm');
if (pos2 !== -1) {
    console.log('--- FOUND userForm ---');
    console.log(content.substring(Math.max(0, pos2 - 200), Math.min(content.length, pos2 + 800)));
}
