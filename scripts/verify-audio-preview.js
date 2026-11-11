const puppeteer = require('puppeteer-core');
const path = require('node:path');

async function testAudioPreview() {
  const artifactDir = '/Users/jobindaniel/.gemini/antigravity/brain/972361ec-0973-4676-b9b7-b575670d49df';
  const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-gpu',
      '--autoplay-policy=no-user-gesture-required',
      '--window-size=1280,1000',
    ],
  });

  const page = await browser.newPage();
  page.on('console', (msg) => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', (err) => console.error('PAGE ERROR:', err));

  await page.setViewport({ width: 1280, height: 1000 });

  console.log('Navigating to http://localhost:3030...');
  await page.goto('http://localhost:3030', { waitUntil: 'networkidle2' });

  // 1. Verify audio player in the download card
  await page.waitForSelector('audio');
  console.log('Found audio element in the download queue card!');

  // Test playing the audio element in Chrome
  const playResult = await page.evaluate(async () => {
    const audio = document.querySelector('audio');
    if (!audio) return { error: 'No audio element' };

    try {
      await audio.play();
      await new Promise((r) => setTimeout(r, 800));
      return {
        paused: audio.paused,
        currentTime: audio.currentTime,
        duration: audio.duration,
        src: audio.src,
      };
    } catch (e) {
      return { error: e.message };
    }
  });

  console.log('Audio playback test in Chrome:', playResult);

  // Take screenshot of Download card with audio preview
  await page.screenshot({
    path: path.join(artifactDir, 'phase5_audio_preview_download_card.png'),
    fullPage: true,
  });
  console.log('Saved phase5_audio_preview_download_card.png');

  // 2. Click "Master in Editor" button
  console.log('Testing "Master in Editor" transition...');
  const masterBtn = await page.$('button ::-p-text(Master in Editor)');
  if (masterBtn) {
    await masterBtn.click();
  } else {
    // fallback query
    const buttons = await page.$$('button');
    for (const b of buttons) {
      const text = await page.evaluate((el) => el.textContent, b);
      if (text && text.includes('Master in Editor')) {
        await b.click();
        break;
      }
    }
  }

  await new Promise((r) => setTimeout(r, 2000));

  // Check Editor audio context state and play in Editor
  const editorPlayResult = await page.evaluate(async () => {
    const playBtn = document.querySelector('button[title*="Play"]');
    if (playBtn) playBtn.click();
    await new Promise((r) => setTimeout(r, 800));

    const audioCtx = window.__sharedAudioCtx;
    return {
      audioCtxState: audioCtx ? audioCtx.state : 'none',
      wavesurferPresent: Boolean(document.querySelector('.cursor-pointer')),
    };
  });

  console.log('Editor Web Audio test:', editorPlayResult);

  await page.screenshot({
    path: path.join(artifactDir, 'phase5_audio_preview_editor.png'),
    fullPage: true,
  });
  console.log('Saved phase5_audio_preview_editor.png');

  await browser.close();
  console.log('Audio preview test finished successfully!');
}

testAudioPreview().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
