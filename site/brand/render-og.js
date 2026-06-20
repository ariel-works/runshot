// Renders brand/og.html → brand/og.png at 1200×630 (2× for crispness).
// Run from a context where Playwright's browser is installed: `node render-og.js`.
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport:{width:1200,height:630}, deviceScaleFactor:2 });
  const p = await ctx.newPage();
  await p.goto('file://' + path.resolve(__dirname, 'og.html'), { waitUntil:'networkidle' });
  await p.screenshot({ path: path.resolve(__dirname, 'og.png'), clip:{x:0,y:0,width:1200,height:630} });
  await b.close();
  console.log('wrote og.png');
})();
