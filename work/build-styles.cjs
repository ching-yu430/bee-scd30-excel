// Keep the distributable homepage in sync with the editable CSS sources.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const filename = path.join(root, 'index.html');
const html = fs.readFileSync(filename, 'utf8');
const pattern = /(<style id="siteStyles">\n)([\s\S]*?)(<\/style>)/;
const existing = html.match(pattern);
if (!existing) throw new Error('Missing bundled siteStyles element');
const sources = [...existing[2].matchAll(/^\/\* SOURCE: ([\w.-]+\.css) \*\/$/gm)].map(match => match[1]);
if (!sources.length) throw new Error('Missing CSS source markers');
const bundled = sources.map(source => `/* SOURCE: ${source} */\n${fs.readFileSync(path.join(root, source), 'utf8').trimEnd()}\n`).join('\n\n');
fs.writeFileSync(filename, html.replace(pattern, (_match, start, _old, end) => start + bundled + end));
console.log(`Bundled ${sources.length} CSS sources into index.html`);
