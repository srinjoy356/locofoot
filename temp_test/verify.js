const puppeteer = require('puppeteer-core');

(async () => {
  try {
    console.log(`Connecting to Chrome...`);
    const browser = await puppeteer.connect({
      browserURL: 'http://localhost:9222',
      defaultViewport: null
    });
    
    const pages = await browser.pages();
    const page = pages.find(p => p.url().includes('localhost:3000')) || pages[0];
    console.log('Using page:', page.url());

    // Wait for our Animated Pitch container
    await page.waitForSelector('.h-\\[700px\\]', { timeout: 10000 }).catch(() => console.log('Timeout waiting for timeline container'));
    
    const pitchExists = await page.evaluate(() => {
       return !!document.querySelector('.bg-green-800');
    });
    console.log(`Pitch rendered: ${pitchExists}`);
    
    if (!pitchExists) {
      console.log('Failed to find AnimatedPitch bg-green-800');
      process.exit(1);
    }

    // Find timeline buttons
    const buttons = await page.$$('.h-\\[700px\\] button');
    console.log(`Found ${buttons.length} timeline events.`);
    
    if (buttons.length > 0) {
       console.log('Clicking first timeline event...');
       await buttons[0].click();
       
       // wait a bit for animation state to kick in
       await new Promise(r => setTimeout(r, 100));
       
       const activeEvent = await page.evaluate(() => {
          const activeFX = document.querySelectorAll('.animate-ping, .animate-bounce, .animate-pulse');
          return { fxCount: activeFX.length };
       });
       console.log(`Visual FX triggered (or ball active):`, activeEvent);
    }
    
    await browser.disconnect();
    console.log('Verification Complete.');
  } catch (err) {
    console.error('Error during verification:', err);
  }
})();
