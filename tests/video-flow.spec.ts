import { config } from 'dotenv';
import { expect, test } from '@playwright/test';

config({ path: ['.env.local', '.env'], quiet: true });

const PASSWORD = process.env.ADMIN_PASSWORD ?? '';
const SHOTS = process.env.SCREENSHOT_DIR; // optional: save design screenshots

// One story, in order: sign in → upload → edit share card → client watches → insights →
// proposal → settings → delete. Uses a WebM fixture (Playwright's Chromium has no H.264).
test('record-to-proposal flow', async ({ page, browser }) => {
  test.setTimeout(120_000);
  const TITLE = `E2E demo ${Date.now()}`;

  await test.step('sign in', async () => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/login\?next=%2F/);
    await page.getByLabel('Password').fill('wrong');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByText('Wrong password')).toBeVisible();
    await page.getByLabel('Password').fill(PASSWORD);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByRole('heading', { name: 'My videos' })).toBeVisible();
  });

  await test.step('upload a video', async () => {
    await page.getByRole('button', { name: 'Upload', exact: true }).click();
    await page.getByRole('dialog').getByLabel('Choose video file').setInputFiles('tests/fixtures/sample.webm');
    await expect(page).toHaveURL(/\/videos\/[a-z0-9]+$/, { timeout: 30_000 });
    await expect(page.getByLabel('Video title')).toHaveValue('sample');
    // Browser uploads make the share GIF themselves (first 3s).
    await expect(page.getByRole('button', { name: 'Replace GIF' })).toBeVisible();
  });

  await test.step('transcribe an uploaded file on the server', async () => {
    test.skip(!process.env.OPENROUTER_API_KEY, 'needs OpenRouter');
    await page.getByRole('link', { name: 'Transcript' }).click();
    await page.getByRole('button', { name: 'Transcribe', exact: true }).click();
    // The fixture may be silent: either outcome proves ffmpeg → model → save is wired.
    await expect(page.getByText(/Transcribed \d+ words|No speech found/)).toBeVisible({ timeout: 120_000 });
    await page.getByRole('link', { name: 'Share' }).click();
  });

  await test.step('make the GIF from a chosen section', async () => {
    await page.getByRole('button', { name: 'Choose GIF section' }).click();
    const player = page.locator('video[controls]').last();
    await expect(player).toHaveAttribute('src', /^http/); // presigned source arrives async; seeking earlier gets reset
    await player.evaluate(async (v: HTMLVideoElement) => {
      if (v.readyState < 1) await new Promise(r => (v.onloadedmetadata = r));
      v.currentTime = 1;
    });
    await expect(page.getByText(/^From 0:01 to/)).toBeVisible();
    await page.getByRole('button', { name: 'Make GIF from here' }).click();
    await expect(page.getByText('Preview GIF updated')).toBeVisible();
    const src = await page.locator('figure img').getAttribute('src');
    const gif = await page.evaluate(async url => {
      const buf = new Uint8Array(await (await fetch(url!)).arrayBuffer());
      return { magic: String.fromCharCode(...buf.slice(0, 6)), frames: buf.filter(b => b === 0x2c).length > 1 };
    }, src);
    expect(gif).toEqual({ magic: 'GIF89a', frames: true });
  });

  await test.step('rename', async () => {
    const title = page.getByLabel('Video title');
    await title.fill(TITLE);
    const saved = page.waitForResponse(r => r.request().method() === 'POST' && r.url().includes('/videos/'));
    await title.press('Enter');
    await saved;
    await page.reload();
    await expect(page.getByLabel('Video title')).toHaveValue(TITLE);
  });

  const firstUrl = await page.getByLabel('Share link').inputValue();
  expect(firstUrl).toMatch(/\/v\/[a-z0-9]{10}$/);

  // Custom link: rename the slug; the old link must keep redirecting.
  const customSlug = `e2e-${Date.now()}`;
  await test.step('rename the share link', async () => {
    await page.getByRole('button', { name: 'Edit link' }).click();
    await page.getByLabel('Custom link').fill('Bad Slug!');
    await expect(page.getByLabel('Custom link')).toHaveValue('bad-slug-');
    await page.getByRole('button', { name: 'Save link' }).click();
    await expect(page.getByText('3–60 characters')).toBeVisible();
    await page.getByLabel('Custom link').fill(customSlug);
    await page.getByRole('button', { name: 'Save link' }).click();
    await expect(page.getByLabel('Share link')).toHaveValue(new RegExp(`/v/${customSlug}$`));
  });
  const shareUrl = await page.getByLabel('Share link').inputValue();

  await test.step('edit the share card', async () => {
    await page.getByLabel('Card title').fill('Watch this before hiring');
    // Enabled only once React handles the input: the panel is hydrated. React replays early
    // clicks after hydration but drops file-input changes, so the GIF pick must wait for this.
    await expect(page.getByRole('button', { name: 'Save preview' })).toBeEnabled();
    await page.getByRole('button', { name: 'Save preview' }).click();
    await expect(page.getByText('Preview saved')).toBeVisible();
    await page.getByLabel('Choose GIF').setInputFiles('tests/fixtures/preview.gif');
    await expect(page.getByText('Preview GIF updated')).toBeVisible();
    await expect(page.locator('figure figcaption')).toContainText('Watch this before hiring');
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/detail-share.png`, fullPage: true });
  });

  await test.step('a client opens the link and watches', async () => {
    const client = await browser.newContext();
    const view = await client.newPage();
    await view.goto(firstUrl); // old link → redirect
    await expect(view).toHaveURL(new RegExp(`/v/${customSlug}$`));
    await expect(view.getByRole('heading', { name: TITLE })).toBeVisible();
    await expect(view.locator('meta[property="og:title"]')).toHaveAttribute('content', 'Watch this before hiring');
    await expect(view.locator('meta[property="og:image"]').first()).toHaveAttribute('content', /preview\.gif$/);
    const beacon = view.waitForResponse(r => r.url().includes('/view') && r.request().method() === 'POST');
    await view.locator('video').evaluate((v: HTMLVideoElement) => {
      v.muted = true;
      return v.play();
    });
    expect((await (await beacon).json()).counted).toBe(true);
    if (SHOTS) await view.screenshot({ path: `${SHOTS}/share-page.png`, fullPage: true });
    await client.close();
  });

  await test.step('insights show the view', async () => {
    await page.getByRole('link', { name: 'Insights' }).click();
    await expect(page.getByText('Viewers').locator('..')).toContainText('1');
  });

  await test.step('proposal', async () => {
    await page.getByRole('link', { name: 'Proposal' }).click();
    await page.getByLabel('Job post').fill(
      'We need a developer to fix our Stripe webhook handler. Payments succeed but orders stay pending about 5% of the time.',
    );
    // Editing the job post redrafts on its own (debounced), no button click.
    if (process.env.OPENROUTER_API_KEY) {
      await expect(page.getByLabel('Cover letter')).not.toHaveValue('', { timeout: 60_000 });
      const first = await page.getByLabel('Cover letter').inputValue();
      await page.getByLabel('Job URL').fill('https://www.upwork.com/jobs/~021234567890');
      await expect(page.getByLabel('Cover letter')).not.toHaveValue(first, { timeout: 60_000 });
      // Client name: greeting on top of the letter, "For <name>:" on the video title.
      await page.getByLabel('Client name').fill('Curtis');
      await expect(page.getByLabel('Cover letter')).toHaveValue(/^Hi Curtis 👋\n\n\S/, { timeout: 60_000 });
      await expect(page.getByLabel('Video title')).toHaveValue(/^For Curtis: /);
      // The share link lands inside what the proposals list shows before "more".
      await expect(page.getByText('✓ The video link shows before "more".')).toBeVisible();
    } else {
      await expect(page.getByText('Add OPENROUTER_API_KEY')).toBeVisible();
    }
    await page.getByLabel('Cover letter').fill('Hand-written draft');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByText('Saved', { exact: true })).toBeVisible();
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/detail-proposal.png`, fullPage: true });
  });

  await test.step('library + settings', async () => {
    await page.goto('/');
    await expect(page.getByRole('link', { name: new RegExp(TITLE) })).toBeVisible();
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/library.png`, fullPage: true });
    await page.goto('/settings');
    await expect(page.getByLabel('API token')).toHaveValue(process.env.API_TOKEN ?? '');
    await expect(page.getByLabel('Template name').first()).toHaveValue('Video-first proposal');
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/settings.png`, fullPage: true });
  });

  await test.step('delete', async () => {
    await page.goto('/');
    await page.getByRole('link', { name: new RegExp(TITLE) }).click();
    await page.getByRole('button', { name: 'Delete' }).click();
    await page.getByRole('button', { name: 'Delete video' }).click();
    await expect(page.getByRole('heading', { name: 'My videos' })).toBeVisible();
    await page.goto(shareUrl);
    await expect(page.getByRole('heading', { name: "This video isn't available" })).toBeVisible();
  });
});
