const { chromium } = require('playwright');
require('dotenv').config();

const CNSA_ID = process.env.CNSA_ID;
const CNSA_PW = process.env.CNSA_PW;
const TEST_MESSAGE = '이 메시지는 신규 프로그램 테스트를 위해 자동으로 보내진 메시지입니다.';

async function testHeadlessSMS() {
  console.log('=== Starting Headless SMS Test ===');
  console.log('CNSA_ID:', CNSA_ID);

  const browser = await chromium.launch({
    headless: true,  // Same as Cloud Run
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const context = await browser.newContext();
    const page = await context.newPage();

    // Step 1: Login
    console.log('\n[Step 1] Logging in...');
    await page.goto('https://cnsa.riroschool.kr/user.php?action=signin', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(2000);

    const idInput = page.getByRole('textbox', { name: '학교 아이디 또는 통합 아이디(이메일)' });
    await idInput.fill(CNSA_ID);

    const pwInput = page.getByRole('textbox', { name: '비밀번호' });
    await pwInput.fill(CNSA_PW);

    await page.getByRole('button', { name: '로그인' }).click();
    await page.waitForTimeout(3000);
    console.log('Logged in, URL:', page.url());
    await page.screenshot({ path: 'screenshot-01-login.png' });

    // Step 2: Navigate to SMS page via menu
    console.log('\n[Step 2] Navigating to SMS page...');
    const smsMenu = page.locator('text=알림문자').first();
    if (await smsMenu.isVisible()) {
      await smsMenu.click();
      await page.waitForTimeout(2000);
    }

    const sendMenu = page.locator('text=문자 발송').first();
    if (await sendMenu.isVisible()) {
      await sendMenu.click();
      await page.waitForTimeout(2000);
    }

    console.log('SMS page URL:', page.url());
    await page.screenshot({ path: 'screenshot-02-sms-page.png' });

    // Step 3: Click 선생님 category
    console.log('\n[Step 3] Opening 선생님 directory...');
    await page.evaluate(() => {
      const allLis = Array.from(document.querySelectorAll('li'));
      for (const li of allLis) {
        const text = li.textContent || '';
        if (text.includes('선생님') && !text.includes('선생님(본인)')) {
          li.click();
          return true;
        }
      }
      return false;
    });
    await page.waitForTimeout(1000);

    // Step 4: Click 업무담당자
    console.log('\n[Step 4] Opening 업무담당자...');
    try {
      await page.waitForSelector('text=업무담당자', { timeout: 10000 });
      const staffLocator = page.locator('text=업무담당자').first();
      await staffLocator.click();
      await page.waitForTimeout(1000);
    } catch (e) {
      console.log('업무담당자 not found:', e.message);
    }

    // Step 5: Select 민수정
    console.log('\n[Step 5] Selecting 민수정...');
    try {
      await page.waitForSelector('text=민수정', { timeout: 10000 });
    } catch (e) {
      console.log('민수정 not found');
    }

    await page.evaluate(() => {
      const allLis = Array.from(document.querySelectorAll('ul li'));
      for (const li of allLis) {
        const text = li.textContent || '';
        if (text.includes('민수정')) {
          const checkbox = li.querySelector('input[type="checkbox"]');
          if (checkbox && !checkbox.checked) {
            checkbox.click();
            return true;
          }
        }
      }
      return false;
    });
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'screenshot-03-selected.png' });

    // Step 6: Select 선생님 as recipient
    console.log('\n[Step 6] Selecting 선생님 as recipient...');
    try {
      const recipientCheckbox = page.locator('text=선생님').last();
      await recipientCheckbox.click();
    } catch (e) {
      console.log('Recipient selection error:', e.message);
    }
    await page.waitForTimeout(500);

    // Step 7: Enter message
    console.log('\n[Step 7] Entering message...');
    const messageBox = page.getByRole('textbox', { name: /메시지를 입력/ });
    if (await messageBox.count() > 0) {
      await messageBox.fill(TEST_MESSAGE);
    }
    await page.waitForTimeout(500);

    // Step 8: Enter password
    console.log('\n[Step 8] Entering password...');
    const pwInputSend = page.getByRole('textbox', { name: '로그인 비밀번호 입력' });
    if (await pwInputSend.count() > 0) {
      await pwInputSend.fill(CNSA_PW);
    }
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'screenshot-04-before-send.png' });

    // Step 9: Click send button with dialog handling
    console.log('\n[Step 9] Clicking send button...');

    let dialogHandled = false;
    let dialogMessage = '';

    const dialogPromise = new Promise((resolve) => {
      const handler = async (dialog) => {
        dialogMessage = dialog.message();
        console.log('>>> Dialog appeared:', dialogMessage);
        await dialog.accept();
        dialogHandled = true;
        console.log('>>> Dialog accepted');
        resolve(true);
      };
      page.once('dialog', handler);

      setTimeout(() => {
        if (!dialogHandled) {
          console.log('>>> No dialog appeared within timeout');
          resolve(false);
        }
      }, 10000);
    });

    try {
      await page.getByRole('button', { name: '메시지 발송' }).click();
      console.log('Send button clicked');
    } catch (e) {
      console.log('Send button click error:', e.message);
    }

    const wasDialogHandled = await dialogPromise;
    console.log('Dialog handled:', wasDialogHandled);

    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'screenshot-05-after-send.png' });

    // Check result
    const bodyText = await page.evaluate(() => document.body.innerText);
    console.log('\n[Result] Page text contains:');
    console.log('- 발송 완료:', bodyText.includes('발송 완료'));
    console.log('- 성공:', bodyText.includes('성공'));
    console.log('- 실패:', bodyText.includes('실패'));

    // Check for alert/success message
    const resultText = bodyText.match(/발송[^\n]{0,50}/g);
    if (resultText) {
      console.log('발송 관련 텍스트:', resultText);
    }

    console.log('\n=== Test Complete ===');
    console.log('Screenshots saved: screenshot-01 through screenshot-05');

  } finally {
    await browser.close();
  }
}

testHeadlessSMS().catch(e => console.error('Error:', e));
