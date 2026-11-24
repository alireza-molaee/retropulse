import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { chromium } from 'playwright';
import { createApp } from '../server.js';

test('host and mobile guest complete a retro through the web UI', async t => {
  const server = createApp(':memory:').listen(0, '127.0.0.1');
  await once(server, 'listening');
  const browser = await chromium.launch({ channel: 'msedge' });
  t.after(async () => {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  });
  const desktop = await browser.newContext({ viewport: { width: 1440, height: 1000 }, permissions: ['clipboard-read', 'clipboard-write'] });
  const host = await desktop.newPage();
  const guest = await browser.newPage({ viewport: { width: 390, height: 844 }, colorScheme: 'dark' });
  const errors = [];
  for (const page of [host, guest]) {
    page.setDefaultTimeout(8000);
    page.on('pageerror', error => errors.push(error.message));
  }
  const button = (page, name) => page.getByRole('button', { name, exact: true });
  async function avatar(page) {
    await button(page, 'انتخاب آواتار').click();
    await button(page, 'حیوان‌ها').click();
    await button(page, 'گربه').click();
  }
  async function phase(label) {
    await button(host, label).click();
    await button(host, 'تأیید').click();
  }
  await host.goto('http://127.0.0.1:' + server.address().port);
  await guest.goto(host.url());
  assert.equal(await host.title(), 'RetroPulse | برد رتروسپکتیو تیم');
  await guest.getByRole('link', { name: 'RetroPulse چطور کار می‌کند؟' }).click();
  assert.equal(new URL(guest.url()).hash, '#how-it-works');
  await guest.getByRole('heading', { name: 'از گفت‌وگو تا تصمیم تیمی' }).waitFor();
  assert.ok(await guest.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await host.getByRole('link', { name: 'ساخت جلسهٔ رترو', exact: true }).first().click();
  assert.equal(new URL(host.url()).pathname, '/create');
  await host.reload();
  await host.getByLabel('نام جلسه', { exact: true }).fill('Release retro');
  await host.getByLabel('نام شما').fill('Host');
  await avatar(host);
  await host.getByRole('switch', { name: 'افزودن نظرسنجی' }).check();
  await button(host, 'رتروی اسپرینت تیم فنی').click();
  await button(host, 'ساخت برد').click();
  await button(host, 'دعوت اعضا').click();
  await guest.goto(await host.getByLabel('لینک دعوت').inputValue());
  await host.keyboard.press('Escape');
  await guest.getByLabel('نام شما').fill('Guest');
  await guest.getByRole('button', { name: /تم نمایش/ }).click();
  await button(guest, 'روشن').click();
  assert.equal(await guest.locator('html').getAttribute('data-theme'), 'light');
  await avatar(guest);
  await button(guest, 'پیوستن به جلسه').click();
  await guest.getByRole('switch', { name: 'آماده‌ام' }).check();
  await host.locator('.readiness__avatars li[title="Guest"]').waitFor();
  await button(host, 'بازنشانی آمادگی').click();
  await button(host, 'تنظیم زمان').click();
  await host.getByLabel('دقیقه', { exact: true }).fill('0');
  await host.getByLabel('ثانیه', { exact: true }).fill('5');
  await button(host, 'تنظیم و شروع').click();
  await guest.locator('.countdown__time[data-flash=true]').waitFor();
  await button(host, 'بازنشانی تایمر').click();
  await button(guest, 'نظرسنجی جلسه').click();
  for (const question of await guest.locator('dialog fieldset').all()) {
    await question.getByRole('radio').first().check();
  }
  await button(guest, 'ثبت پاسخ‌ها').click();
  for (const [page, text] of [[host, 'Pairing'], [guest, 'Code review']]) {
    await page.locator('.lane__add').first().click();
    await page.locator('dialog textarea').fill(text);
    if (page === guest) await page.locator('dialog').getByRole('switch').check();
    await button(page, 'تأیید').click();
    await page.locator('.note').getByText(text).waitFor();
  }
  assert.equal(await host.getByText('Code review').count(), 0);
  await phase('رفتن به گروه‌بندی');
  const card = (page, text) => page.locator('.note').filter({ hasText: text });
  await card(host, 'Code review').waitFor();
  await host.bringToFront();
  await card(host, 'Pairing').evaluate(element => element.scrollIntoView({ block: 'center' }));
  await card(host, 'Pairing').dragTo(card(host, 'Code review'), {
    sourcePosition: { x: 8, y: 8 }, targetPosition: { x: 8, y: 8 },
  });
  await host.locator('.group').getByText('Pairing').waitFor();
  const discussion = card(guest, 'Code review');
  await guest.locator('.group').getByText('Code review').waitFor();
  await discussion.locator('.card-discussion__toggle').click();
  await discussion.locator('textarea').fill('More time for reviews');
  await discussion.getByRole('switch').check();
  await button(discussion, 'ارسال کامنت').click();
  await discussion.locator('.card-comments__anonymous').waitFor();
  await discussion.locator('.reaction-pill').first().click();
  await phase('رفتن به رأی‌گیری');
  await button(guest, 'رأی دادن').click();
  await guest.getByText('۲ رأی باقی‌مانده').waitFor();
  await phase('رفتن به اقدام‌ها');
  await host.locator('.assignee__trigger').click();
  await host.locator('.assignee__option').filter({ hasText: 'Guest' }).click();
  await host.getByLabel('اقدام', { exact: true }).fill('Schedule review');
  await host.getByLabel('مهلت').fill('2027-01-01');
  await button(host, 'ثبت اقدام').click();
  await host.locator('.action-owner .avatar__art').waitFor();
  await phase('پایان جلسه');
  await guest.locator('.survey-results').waitFor();
  assert.equal(await guest.locator('.survey-chart').count(), 3);
  await button(host, 'کپی خلاصه برای Confluence').click();
  await host.getByText('در کلیپ‌بورد کپی شد.').waitFor();
  const report = await host.evaluate(() => navigator.clipboard.readText());
  for (const text of ['Code review', 'More time for reviews', 'Schedule review', 'نتایج نظرسنجی']) {
    assert.ok(report.includes(text));
  }
  await guest.reload();
  await guest.locator('.survey-results').waitFor();
  assert.ok(await guest.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  assert.deepEqual(errors, []);
});
