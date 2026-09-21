const fs = require('fs');

const content = fs.readFileSync('C:/Users/praja/.gemini/antigravity/brain/7a85287e-ef32-4580-beca-3e84739024b0/.system_generated/steps/86/content.md', 'utf8');

const pos = 1159010;
console.log(content.substring(pos - 800, pos + 200));
