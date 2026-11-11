const puppeteer = require('puppeteer-core');
const path = require('node:path');

async function testQueueRemovalUI() {
  const artifactDir = '/Users/jobindaniel/.gemini/antigravity/brain/972361ec-0973-4676-b9b7-b575670d49df';
  const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--window-size=1280,1000'],
  });

  const page = await browser.newPage();
  page.on('console', (msg) => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', (err) => console.error('PAGE ERROR:', err));

  await page.setViewport({ width: 1280, height: 1000 });

  console.log('Navigating to http://localhost:3031...');
  await page.goto('http://localhost:3031', { waitUntil: 'networkidle2' });

  // Find the remove button on a job in queue
  console.log('Looking for remove queue button...');
  await page.waitForSelector('button[title*="Remove from queue"]');

  const removeBtn = await page.$('button[title*="Remove from queue"]');
  if (removeBtn) {
    await removeBtn.click();
    console.log('Clicked remove from queue button!');
  }

  // Wait for the modal to appear
  await page.waitForSelector('::-p-text(Remove from Queue)');
  console.log('Modal opened!');

  // Take screenshot of Remove from Queue modal with checkboxes
  await page.screenshot({
    path: path.join(artifactDir, 'phase5_remove_from_queue_modal.png'),
    fullPage: false,
  });
  console.log('Saved phase5_remove_from_queue_modal.png');

  // Verify checkboxes exist
  const checkboxes = await page.$$('input[type="checkbox"]');
  console.log(`Found ${checkboxes.length} checkboxes in dialog!`);

  // Check the first checkbox (keep files in download folder)
  if (checkboxes.length >= 2) {
    await checkboxes[0].click();
    console.log('Toggled keep downloads checkbox!');
  }

  await new Promise((r) => setTimeout(r, 500));
  await page.screenshot({
    path: path.join(artifactDir, 'phase5_remove_from_queue_checked.png'),
    fullPage: false,
  });
  console.log('Saved phase5_remove_from_queue_checked.png');

  // Click Cancel or Confirm
  const confirmBtn = await page.$('button ::-p-text(Remove)');
  if (confirmBtn) {
    await confirmBtn.click();
    console.log('Confirmed job removal!');
  }

  await new Promise((r) => setTimeout(r, 1000));
  await browser.close();
  console.log('Verification finished successfully!');
}

testQueueRemovalUI().catch((err) => {
  console.error('Error testing removal UI:', err);
  process.exit(1);
});
