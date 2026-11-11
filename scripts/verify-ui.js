const puppeteer = require('puppeteer-core');
const path = require('node:path');

async function run() {
  const artifactDir = '/Users/jobindaniel/.gemini/antigravity/brain/972361ec-0973-4676-b9b7-b575670d49df';
  const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--window-size=1280,1000'],
  });

  const page = await browser.newPage();
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.error('PAGE ERROR:', err));
  await page.setViewport({ width: 1280, height: 1000 });

  console.log('Navigating to http://localhost:3030...');
  await page.goto('http://localhost:3030', { waitUntil: 'networkidle2' });

  // 1. Download View screenshot
  await page.screenshot({ path: path.join(artifactDir, 'phase3_download_view.png'), fullPage: true });
  console.log('Saved phase3_download_view.png');

  // 2. Click Library Tab
  console.log('Switching to Library Tab...');
  const navButtons = await page.$$('nav button');
  if (navButtons.length >= 3) {
    await navButtons[2].click(); // Library is 3rd button
  }
  await new Promise((r) => setTimeout(r, 1000));
  await page.screenshot({ path: path.join(artifactDir, 'phase3_library_view.png'), fullPage: true });
  console.log('Saved phase3_library_view.png');

  // 3. Open track in Editor from Library
  console.log('Opening track in Audio DSP Editor...');
  const editButtons = await page.$$('button[title="Open in Audio DSP Editor"]');
  if (editButtons.length > 0) {
    await editButtons[0].click();
  } else {
    // If not found, click Editor tab and open
    await navButtons[1].click();
    await new Promise((r) => setTimeout(r, 500));
    const openBtns = await page.$$('button');
    for (const b of openBtns) {
      const text = await page.evaluate(el => el.textContent, b);
      if (text && text.includes('Open')) {
        await b.click();
        break;
      }
    }
  }

  await new Promise((r) => setTimeout(r, 3000));
  await page.screenshot({ path: path.join(artifactDir, 'phase3_editor_view.png'), fullPage: true });
  console.log('Saved phase3_editor_view.png');

  // 4. Test A/B bypass keyboard shortcut B
  await page.keyboard.press('KeyB');
  await new Promise((r) => setTimeout(r, 500));
  await page.screenshot({ path: path.join(artifactDir, 'phase3_editor_bypassed_ab.png'), fullPage: true });
  console.log('Saved phase3_editor_bypassed_ab.png');

  // Unbypass
  await page.keyboard.press('KeyB');

  // 5. Open Export Modal
  console.log('Opening Export Modal...');
  const exportButtons = await page.$$('button');
  for (const b of exportButtons) {
    const text = await page.evaluate(el => el.textContent, b);
    if (text && text.includes('Export Mastered MP3')) {
      await b.click();
      break;
    }
  }

  await new Promise((r) => setTimeout(r, 1000));
  await page.screenshot({ path: path.join(artifactDir, 'phase4_export_modal.png') });
  console.log('Saved phase4_export_modal.png');

  // 6. Click Render in Modal
  console.log('Clicking Render & Export in Modal...');
  const modalButtons = await page.$$('button');
  for (const b of modalButtons) {
    const text = await page.evaluate(el => el.textContent, b);
    if (text && text.includes('Render & Export MP3')) {
      await b.click();
      break;
    }
  }

  // Wait for rendering to complete
  await new Promise((r) => setTimeout(r, 4000));
  await page.screenshot({ path: path.join(artifactDir, 'phase4_export_complete.png') });
  console.log('Saved phase4_export_complete.png');

  // Close modal
  const closeBtn = await page.$('button[aria-label="Close export dialog"]');
  if (closeBtn) await closeBtn.click();
  await new Promise((r) => setTimeout(r, 500));

  // 7. Check Library for Mastered item
  if (navButtons.length >= 3) {
    await navButtons[2].click();
  }
  await new Promise((r) => setTimeout(r, 1500));
  await page.screenshot({ path: path.join(artifactDir, 'phase4_library_with_mastered.png'), fullPage: true });
  console.log('Saved phase4_library_with_mastered.png');

  // Unbypass
  await page.keyboard.press('KeyB');

  await browser.close();
  console.log('UI verification completed successfully!');
}

run().catch((err) => {
  console.error('Error during UI verification:', err);
  process.exit(1);
});
