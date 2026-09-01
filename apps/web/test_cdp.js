const { chromium } = require('playwright');
(async () => {
  try {
    console.log('Attempting to connect to CDP...');
    const browser = await chromium.connectOverCDP('http://localhost:9222', { timeout: 10000 });
    console.log('Connected successfully!');
    await browser.close();
  } catch(e) {
    console.error('Error:', e.message);
  }
})();
