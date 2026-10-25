// Inlines CSS and JS into one self-contained page: dist/index.html
const fs = require('fs'), path = require('path');
const r = f => fs.readFileSync(path.join(__dirname, f), 'utf8');
const html = `<title>BrandGuard</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&family=Newsreader:wght@500;600&display=swap">
<style>
${r('src/styles.css')}
</style>
<div id="app"></div>
<script>
${r('src/engine.js')}
</script>
<script>
${r('src/seed.js')}
</script>
<script>
${r('src/app.js')}
</script>
`;
fs.mkdirSync(path.join(__dirname, 'dist'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'dist/index.html'), html);
// standalone copy with full document wrapper for running outside the artifact viewer
fs.writeFileSync(path.join(__dirname, 'dist/standalone.html'), `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${html.replace('<title>BrandGuard</title>', '<title>BrandGuard</title>')}</head></html>`.replace('<div id="app"></div>', '<body><div id="app"></div>').replace(/<\/html>$/, '</body></html>'));
console.log('built', (html.length / 1024).toFixed(0) + ' KB');
