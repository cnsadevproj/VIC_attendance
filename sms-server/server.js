const express = require('express');
const cors = require('cors');
const { chromium } = require('playwright');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 8080;

// Riroschool credentials from environment
const CNSA_ID = process.env.CNSA_ID;
// Remove any backslash escaping that may have been added during env var setting
const CNSA_PW = process.env.CNSA_PW?.replace(/\\!/g, '!');

console.log('CNSA_ID loaded:', CNSA_ID);
console.log('CNSA_PW length:', CNSA_PW?.length);

// Production start date: 2026년 1월 7일
const PRODUCTION_START_DATE = new Date('2026-01-07T00:00:00+09:00');

// Check if we're in production mode
function isProductionMode() {
  return new Date() >= PRODUCTION_START_DATE;
}

// Parse student ID: 10823 -> { grade: 1, class: '108', number: 23 }
function parseStudentId(studentId) {
  const idStr = studentId.toString().padStart(5, '0');
  const grade = parseInt(idStr[0]);
  const classNum = idStr.substring(0, 3); // e.g., '108'
  const number = parseInt(idStr.substring(3)); // e.g., 23
  return { grade, classNum, number };
}

// SMS message template
const SMS_MESSAGE = `안녕하세요, 충남삼성고등학교입니다.

본 메시지는 금일 08:30 면학실 출석 확인이 되지 않은 학생을 대상으로 자동 발송됩니다.
출석 확인은 08:30부터 면학실에서 진행되오니,
반드시 출석 체크를 완료한 후 방과후 교실로 이동해 주시기 바랍니다.

원활한 운영을 위해 협조 부탁드립니다.
감사합니다.

충남삼성고등학교 드림`;

const SMS_TITLE = '방과후학교 면학 출결 안내';

const TEST_MESSAGE = '이 메시지는 신규 프로그램 테스트를 위해 자동으로 보내진 메시지입니다.';

// Robust login function using role-based selectors
async function loginToRiroschool(page) {
  console.log('Logging into Riroschool...');

  // Go directly to login page
  await page.goto('https://cnsa.riroschool.kr/user.php?action=signin', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(2000);

  console.log('Current URL:', page.url());

  // Use role-based selectors (most reliable for this page)
  try {
    // Fill ID using role selector
    const idInput = page.getByRole('textbox', { name: '학교 아이디 또는 통합 아이디(이메일)' });
    await idInput.fill(CNSA_ID);
    console.log('ID entered:', CNSA_ID);

    // Fill password using role selector
    const pwInput = page.getByRole('textbox', { name: '비밀번호' });
    await pwInput.fill(CNSA_PW);
    console.log('Password entered');

    // Click login button
    const loginBtn = page.getByRole('button', { name: '로그인' });
    await loginBtn.click();
    console.log('Login button clicked');

  } catch (e) {
    console.log('Role-based login failed, trying fallback:', e.message);

    // Fallback: use CSS selectors for visible inputs
    const idInput = await page.locator('input[type="text"]:visible').first();
    await idInput.fill(CNSA_ID);

    const pwInput = await page.locator('input[type="password"]:visible').first();
    await pwInput.fill(CNSA_PW);

    const loginBtn = await page.locator('button:has-text("로그인"):visible').first();
    await loginBtn.click();
  }

  await page.waitForTimeout(3000);
  console.log('Login completed, current URL:', page.url());
}

// Test SMS sending to 민수정 선생님
async function sendTestSMS() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const context = await browser.newContext();
    const page = await context.newPage();

    // Login
    await loginToRiroschool(page);

    // Navigate to SMS page by clicking through menu (direct URL navigation might be blocked)
    console.log('Navigating to SMS page via menu...');

    // First, go to main page after login
    await page.waitForTimeout(2000);
    console.log('Current URL after login:', page.url());

    // Click on 알림문자 menu to go to SMS page
    try {
      // Look for the 알림문자 menu item
      const smsMenu = page.locator('text=알림문자').first();
      if (await smsMenu.isVisible()) {
        await smsMenu.click();
        console.log('알림문자 menu clicked');
        await page.waitForTimeout(2000);
      } else {
        console.log('알림문자 menu not visible, trying to find it...');
      }
    } catch (e) {
      console.log('알림문자 menu click error:', e.message);
    }

    // Click on 문자 발송 submenu if needed
    try {
      const sendMenu = page.locator('text=문자 발송').first();
      if (await sendMenu.isVisible()) {
        await sendMenu.click();
        console.log('문자 발송 submenu clicked');
        await page.waitForTimeout(2000);
      }
    } catch (e) {
      console.log('문자 발송 submenu error:', e.message);
    }

    // If menu navigation didn't work, try direct URL
    let currentUrl = page.url();
    console.log('Current URL after menu navigation:', currentUrl);

    if (!currentUrl.includes('sms.php')) {
      console.log('Menu navigation failed, trying direct URL...');
      await page.goto('https://cnsa.riroschool.kr/sms.php', { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(3000);
      currentUrl = page.url();
      console.log('URL after direct navigation:', currentUrl);
    }

    // Wait for page to fully load
    await page.waitForTimeout(3000);

    // Debug: Check page state
    const pageState = await page.evaluate(() => {
      return {
        url: window.location.href,
        title: document.title,
        checkboxCount: document.querySelectorAll('input[type="checkbox"]').length,
        liCount: document.querySelectorAll('li').length,
        has1학년: document.body.innerText.includes('1학년'),
        has선생님: document.body.innerText.includes('선생님'),
        bodyLength: document.body.innerText.length
      };
    });
    console.log('Page state:', JSON.stringify(pageState));

    // Try clicking 주소록 tab in case it needs to be activated
    console.log('Clicking on 주소록 tab...');
    try {
      // Look for 주소록 as a clickable element
      const addressBookTab = page.locator('text=주소록').first();
      if (await addressBookTab.isVisible()) {
        await addressBookTab.click();
        console.log('주소록 tab clicked');
        await page.waitForTimeout(2000);
      }
    } catch (e) {
      console.log('주소록 tab click error:', e.message);
    }

    // Wait for address book list to appear
    console.log('Waiting for address book list...');
    try {
      // The address book should have a list with 1학년, 2학년, 3학년, etc.
      // Wait for multiple checkboxes to appear (indicating the list is loaded)
      await page.waitForFunction(() => {
        return document.querySelectorAll('input[type="checkbox"]').length > 5;
      }, { timeout: 15000 });
      const checkboxCount = await page.evaluate(() => document.querySelectorAll('input[type="checkbox"]').length);
      console.log('Address book loaded, checkbox count:', checkboxCount);
    } catch (e) {
      console.log('Timeout waiting for address book. Checking current state...');
      const currentCheckboxes = await page.evaluate(() => {
        const cbs = document.querySelectorAll('input[type="checkbox"]');
        return Array.from(cbs).slice(0, 10).map(cb => {
          const li = cb.closest('li');
          return li ? li.textContent?.substring(0, 30) : 'no li';
        });
      });
      console.log('Current checkboxes context:', JSON.stringify(currentCheckboxes));
    }

    // Step 1: Click 선생님 category to expand
    // The address book has a tree structure: 1학년, 2학년, 3학년, 학번미등록자, 선생님, 그룹
    console.log('Opening 선생님 directory...');

    // Wait for the address list to fully load - specifically look for address book items
    // The address book is a scrollable list with checkboxes for each grade/category
    await page.waitForTimeout(2000);

    // Debug: Check if 1학년 is visible (should be in address book)
    const addressBookCheck = await page.evaluate(() => {
      const pageText = document.body.innerText;
      return {
        has1학년: pageText.includes('1학년'),
        has선생님: pageText.includes('선생님'),
        hasCheckbox: document.querySelectorAll('input[type="checkbox"]').length
      };
    });
    console.log('Address book check:', JSON.stringify(addressBookCheck));

    // Find and click "선생님" in the main category list (not the recipient checkbox)
    // The address book has items like: 1학년, 2학년, 3학년, 학번미등록자, 선생님, 그룹
    // Each category has a checkbox and can be expanded
    let teacherCategoryClicked = false;

    // Method 1: Find the 선생님 listitem in the address book
    // It should have a checkbox and NOT be in the recipient selection area
    teacherCategoryClicked = await page.evaluate(() => {
      // The address book list items have checkboxes with em/emphasis elements for toggle
      const allLis = Array.from(document.querySelectorAll('li'));

      for (const li of allLis) {
        const checkbox = li.querySelector('input[type="checkbox"]');
        if (!checkbox) continue;

        // Get the label/text of this item
        const text = li.textContent || '';

        // The address book 선생님 item should:
        // 1. Have a checkbox
        // 2. Contain "선생님" text
        // 3. NOT contain "선생님(본인)" (that's the recipient checkbox)
        // 4. Have child categories like 업무담당자, 비담임, etc. (if already expanded) OR be expandable
        if (text.includes('선생님') && !text.includes('선생님(본인)')) {
          // This might be the right element - click it to expand
          console.log('Clicking on li with text:', text.substring(0, 100));
          li.click();
          return true;
        }
      }

      // If not found by li, try finding by checkbox label
      const checkboxes = document.querySelectorAll('input[type="checkbox"]');
      for (const cb of checkboxes) {
        const parent = cb.closest('li');
        if (parent) {
          const text = parent.textContent || '';
          if (text.startsWith('선생님') && !text.includes('선생님(본인)')) {
            parent.click();
            return true;
          }
        }
      }
      return false;
    });

    // Method 2: Try Playwright locators
    if (!teacherCategoryClicked) {
      try {
        // Look for the listitem that contains checkbox AND "선생님" text
        // but exclude the recipient area which has "선생님" without checkbox in li
        const items = page.locator('li:has(input[type="checkbox"])').filter({ hasText: '선생님' });
        const count = await items.count();
        console.log('Found', count, 'li items with checkbox and 선생님');

        for (let i = 0; i < count; i++) {
          const item = items.nth(i);
          const text = await item.textContent();
          if (text && !text.includes('선생님(본인)')) {
            await item.click();
            teacherCategoryClicked = true;
            console.log('Clicked 선생님 via locator, text:', text.substring(0, 50));
            break;
          }
        }
      } catch (e) {
        console.log('Locator method failed:', e.message);
      }
    }

    // Method 3: Look for specific structure in address book
    if (!teacherCategoryClicked) {
      try {
        // The address book has specific structure: ul > li with checkbox and text
        // Try clicking the checkbox label directly
        await page.click('li:has-text("선생님"):has(input[type="checkbox"]):not(:has-text("선생님(본인)"))');
        teacherCategoryClicked = true;
      } catch (e) {
        console.log('Direct selector failed:', e.message);
      }
    }

    console.log('선생님 category clicked:', teacherCategoryClicked);

    // Wait for 업무담당자 to appear after tree expansion
    console.log('Waiting for tree to expand...');
    try {
      await page.waitForSelector('text=업무담당자', { timeout: 10000 });
      console.log('업무담당자 appeared in DOM');
    } catch (e) {
      console.log('업무담당자 did not appear, retrying click...');
      // Try clicking 선생님 again with different approach
      await page.evaluate(() => {
        const allText = document.body.innerText;
        console.log('Page has 업무담당자:', allText.includes('업무담당자'));
      });
    }
    await page.waitForTimeout(1000);

    // Step 2: Click 업무담당자 subcategory to expand
    console.log('Opening 업무담당자 directory...');

    let staffCategoryClicked = false;

    // Try Playwright's text locator first
    try {
      const staffLocator = page.locator('text=업무담당자').first();
      if (await staffLocator.isVisible()) {
        await staffLocator.click();
        staffCategoryClicked = true;
        console.log('업무담당자 clicked via locator');
      }
    } catch (e) {
      console.log('Locator click failed:', e.message);
    }

    // Fallback: use evaluate
    if (!staffCategoryClicked) {
      staffCategoryClicked = await page.evaluate(() => {
        const allLis = Array.from(document.querySelectorAll('ul li'));

        for (const li of allLis) {
          const text = li.textContent || '';
          // 업무담당자 should appear after clicking 선생님
          if (text.includes('업무담당자') && !text.includes('민수정')) {
            console.log('Found 업무담당자, clicking...');
            li.click();
            return true;
          }
        }
        return false;
      });
    }

    if (!staffCategoryClicked) {
      // Last resort: try getByText
      try {
        await page.getByText('업무담당자').first().click();
        staffCategoryClicked = true;
      } catch (e) {
        console.log('Could not find 업무담당자 category');
      }
    }

    console.log('업무담당자 category clicked:', staffCategoryClicked);

    // Wait for 민수정 to appear
    if (staffCategoryClicked) {
      try {
        await page.waitForSelector('text=민수정', { timeout: 10000 });
        console.log('민수정 appeared in DOM');
      } catch (e) {
        console.log('민수정 did not appear after clicking 업무담당자');
      }
    }
    await page.waitForTimeout(1000);

    // Step 3: Find and check 민수정 checkbox
    console.log('Finding and selecting 민수정...');
    let found = false;

    // Try finding the checkbox by looking at the DOM structure
    // After expanding 업무담당자, there should be a list of teachers including 민수정
    found = await page.evaluate(() => {
      const allLis = Array.from(document.querySelectorAll('ul li'));

      for (const li of allLis) {
        const text = li.textContent || '';
        // Find the specific li for 민수정 (it's a teacher, not a category)
        if (text.includes('민수정') && !text.includes('1학년부') && !text.includes('2학년부')) {
          const checkbox = li.querySelector('input[type="checkbox"]');
          if (checkbox) {
            if (!checkbox.checked) {
              checkbox.click();
            }
            console.log('민수정 checkbox clicked');
            return true;
          }
        }
      }
      return false;
    });

    // If still not found, try role-based approach
    if (!found) {
      try {
        const checkbox = page.getByRole('checkbox', { name: '민수정' });
        if (await checkbox.count() > 0) {
          await checkbox.check();
          found = true;
          console.log('민수정 checkbox found via role');
        }
      } catch (e) {
        console.log('Role-based checkbox not found');
      }
    }

    // Last resort: scroll and retry
    if (!found) {
      for (let i = 0; i < 5; i++) {
        // Scroll the list
        await page.evaluate(() => {
          const lists = document.querySelectorAll('ul');
          for (const list of lists) {
            if (list.scrollHeight > list.clientHeight) {
              list.scrollTop += 200;
            }
          }
        });
        await page.waitForTimeout(500);

        found = await page.evaluate(() => {
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

        if (found) break;
      }
    }

    if (!found) {
      // Debug: log what we can see
      const visibleItems = await page.evaluate(() => {
        const items = Array.from(document.querySelectorAll('ul li'));
        return items.slice(0, 20).map(li => li.textContent?.substring(0, 50));
      });
      console.log('Visible items:', visibleItems);
      throw new Error('민수정 선생님을 찾을 수 없습니다');
    }
    console.log('민수정 selected');

    // Step 4: Select 선생님 as recipient type
    console.log('Selecting 선생님 as recipient...');

    // First, let's debug what recipient checkboxes exist on the page
    const recipientDebug = await page.evaluate(() => {
      // Find the recipient type area
      const recipTypeDiv = document.querySelector('.recip_type');
      const checkboxes = document.querySelectorAll('input[type="checkbox"]');
      const recipientCheckboxes = [];

      for (const cb of checkboxes) {
        if (cb.id?.startsWith('to_') || cb.name?.startsWith('to_')) {
          recipientCheckboxes.push({
            id: cb.id,
            name: cb.name,
            checked: cb.checked,
            visible: cb.offsetParent !== null,
            parentTag: cb.parentElement?.tagName,
            grandparentClass: cb.parentElement?.parentElement?.className
          });
        }
      }

      return {
        hasRecipTypeDiv: !!recipTypeDiv,
        recipientCheckboxes: recipientCheckboxes,
        totalCheckboxes: checkboxes.length
      };
    });
    console.log('Recipient debug info:', JSON.stringify(recipientDebug));

    // The recipient checkboxes structure:
    // <label class="check">
    //   <input type="checkbox" id="to_teacher">
    //   <span class="ico1"></span>
    //   <span class="txt">선생님</span>
    // </label>
    let recipientSelected = false;

    // Method 1: Click on the "선생님" span inside the recipient area (not the address book one)
    try {
      // The recipient area has class "recip_type" - find the 선생님 text within that specific area
      const result = await page.evaluate(() => {
        // Find the recipient type container
        const recipTypeDiv = document.querySelector('.recip_type');
        if (!recipTypeDiv) {
          console.log('recip_type div not found');
          return { found: false, error: 'recip_type not found' };
        }

        // Find the label that contains "선생님" text within this container
        const labels = recipTypeDiv.querySelectorAll('label.check');
        for (const label of labels) {
          const txtSpan = label.querySelector('span.txt');
          if (txtSpan && txtSpan.textContent?.includes('선생님')) {
            // Found the correct label - click it
            label.click();
            console.log('Clicked label with 선생님');

            // Also directly check the checkbox
            const checkbox = label.querySelector('input[type="checkbox"]');
            if (checkbox) {
              checkbox.checked = true;
              checkbox.dispatchEvent(new Event('change', { bubbles: true }));
              return { found: true, checkboxId: checkbox.id, checked: checkbox.checked };
            }
            return { found: true, labelClicked: true };
          }
        }

        // Fallback: Try to find by ID directly within recip_type
        const teacherCb = recipTypeDiv.querySelector('#to_teacher');
        if (teacherCb) {
          teacherCb.checked = true;
          teacherCb.click();
          teacherCb.dispatchEvent(new Event('change', { bubbles: true }));
          return { found: true, checkboxId: 'to_teacher', checked: teacherCb.checked };
        }

        return { found: false, error: 'Teacher checkbox not found in recip_type' };
      });

      console.log('Recipient selection result:', JSON.stringify(result));
      recipientSelected = result.found;
    } catch (e) {
      console.log('Page evaluate method failed:', e.message);
    }

    // Method 2: If still not selected, try clicking via Playwright with specific selector
    if (!recipientSelected) {
      try {
        // Try clicking the span with "선생님" text inside recip_type div
        await page.locator('.recip_type span.txt:has-text("선생님")').click({ force: true });
        console.log('Clicked .recip_type span.txt with 선생님');
        recipientSelected = true;
      } catch (e) {
        console.log('Span click method failed:', e.message);
      }
    }

    // Method 3: Try clicking label.check inside recip_type
    if (!recipientSelected) {
      try {
        const labels = page.locator('.recip_type label.check');
        const count = await labels.count();
        console.log('Found', count, 'labels in recip_type');

        for (let i = 0; i < count; i++) {
          const label = labels.nth(i);
          const text = await label.textContent();
          if (text?.includes('선생님')) {
            await label.click({ force: true });
            console.log('Clicked label with text:', text);
            recipientSelected = true;
            break;
          }
        }
      } catch (e) {
        console.log('Label iteration method failed:', e.message);
      }
    }

    // Final verification
    const finalCheckState = await page.evaluate(() => {
      const cb = document.querySelector('#to_teacher');
      const cbInRecipType = document.querySelector('.recip_type #to_teacher');
      return {
        global: cb ? cb.checked : 'not found',
        inRecipType: cbInRecipType ? cbInRecipType.checked : 'not found in recip_type'
      };
    });
    console.log('Final teacher checkbox state:', JSON.stringify(finalCheckState));

    await page.waitForTimeout(500);

    // Step 5: Enter title and message
    console.log('Entering title...');
    await page.evaluate((title) => {
      const titleInput = document.querySelector('input[name="btitle"]');
      if (titleInput) {
        titleInput.value = title;
        titleInput.dispatchEvent(new Event('input', { bubbles: true }));
        console.log('Title entered:', title);
      }
    }, SMS_TITLE);
    await page.waitForTimeout(300);

    console.log('Entering message...');
    const messageBox = page.getByRole('textbox', { name: /메시지를 입력/ });
    if (await messageBox.count() > 0) {
      await messageBox.fill(SMS_MESSAGE);
    } else {
      await page.evaluate((msg) => {
        const textarea = document.querySelector('textarea');
        if (textarea) {
          textarea.value = msg;
          textarea.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }, SMS_MESSAGE);
    }
    await page.waitForTimeout(500);

    // Step 6: Select SMS type - ensure "모두 문자" (SMS to all) is selected, not app
    console.log('Selecting SMS type (모두 문자)...');

    // Debug: Check what SMS type options exist
    const smsTypeInfo = await page.evaluate(() => {
      const radios = document.querySelectorAll('input[type="radio"][name="sms_chk"]');
      return Array.from(radios).map(r => ({
        id: r.id,
        value: r.value,
        checked: r.checked,
        label: r.parentElement?.textContent?.trim()
      }));
    });
    console.log('SMS type options:', JSON.stringify(smsTypeInfo));

    // Select "모두 문자" option
    await page.evaluate(() => {
      // Look for radio buttons with different values
      const radios = document.querySelectorAll('input[type="radio"][name="sms_chk"]');
      for (const radio of radios) {
        const label = radio.parentElement?.textContent?.trim() || '';
        // Select "모두 문자" which sends SMS to all recipients
        if (label.includes('모두 문자') || radio.value === 'allsms' || radio.id === 'allsms') {
          radio.checked = true;
          radio.click();
          radio.dispatchEvent(new Event('change', { bubbles: true }));
          console.log('Selected SMS type:', label);
          return true;
        }
      }
      // Fallback: try to find and click the specific radio
      const allSmsRadio = document.querySelector('#allsms');
      if (allSmsRadio) {
        allSmsRadio.checked = true;
        allSmsRadio.click();
        console.log('Selected #allsms');
        return true;
      }
      return false;
    });
    await page.waitForTimeout(500);

    // Step 7: Enter password for sending
    console.log('Entering password...');
    console.log('Password to enter length:', CNSA_PW?.length);

    // Use page.evaluate to directly set the value - avoids any character escaping
    await page.evaluate((pw) => {
      const input = document.querySelector('input[name="admin_pass"]');
      if (input) {
        // Clear existing value
        input.value = '';
        // Set the new value directly
        input.value = pw;
        // Dispatch events to ensure form recognizes the change
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        console.log('Password set via evaluate, length:', pw.length);
      } else {
        console.log('Password input not found by name');
        // Try alternative selector
        const altInput = document.querySelector('input[type="password"]');
        if (altInput) {
          altInput.value = pw;
          altInput.dispatchEvent(new Event('input', { bubbles: true }));
          altInput.dispatchEvent(new Event('change', { bubbles: true }));
          console.log('Password set via type="password" selector');
        }
      }
    }, CNSA_PW);
    console.log('Password entered via evaluate');

    // Verify password was entered correctly
    const enteredPw = await page.evaluate(() => {
      const input = document.querySelector('input[name="admin_pass"]');
      return input ? { value: input.value, length: input.value.length } : 'not found';
    });
    console.log('Password verification:', JSON.stringify(enteredPw));
    await page.waitForTimeout(500);

    // Step 8: Click send button and handle confirmation dialog
    console.log('Clicking send button...');

    // Take screenshot before clicking send
    const screenshotBefore = await page.screenshot();
    console.log('Screenshot before send, size:', screenshotBefore.length, 'bytes');

    // Set up network request logging to see what happens when we submit
    const networkRequests = [];
    const responseBodyPromises = [];

    page.on('request', (request) => {
      if (request.url().includes('sms') || request.method() === 'POST') {
        const postData = request.postData();
        networkRequests.push({
          url: request.url(),
          method: request.method(),
          postData: postData?.substring(0, 2000), // Increased limit
          hasToTeacher: postData?.includes('to_teacher'),
          hasMessage: postData?.includes('이 메시지는')
        });
        console.log('Network request:', request.method(), request.url());
        console.log('POST data preview:', postData?.substring(0, 500));
      }
    });

    let apiResponse = null;
    page.on('response', async (response) => {
      if (response.url().includes('sms') && response.request().method() === 'POST') {
        console.log('Network response:', response.status(), response.url());
        try {
          const responseText = await response.text();
          console.log('Response body (full):', responseText);

          // Try to parse as JSON
          try {
            const jsonResponse = JSON.parse(responseText);
            apiResponse = jsonResponse;
            console.log('Parsed JSON response:', JSON.stringify(jsonResponse));
            if (jsonResponse.code) {
              console.log('Response code:', jsonResponse.code);
            }
            if (jsonResponse.msg) {
              console.log('Response message:', jsonResponse.msg);
            }
          } catch (parseError) {
            // Not JSON, check for HTML/text indicators
            if (responseText.includes('성공') || responseText.includes('발송 완료')) {
              console.log('SUCCESS indicator found in response');
            }
            if (responseText.includes('실패') || responseText.includes('오류')) {
              console.log('ERROR indicator found in response');
            }
          }
        } catch (e) {
          console.log('Could not read response body:', e.message);
        }
      }
    });

    // Set up dialog handling - handle multiple dialogs (MMS confirmation + send confirmation)
    let dialogCount = 0;
    let dialogMessages = [];

    // Handle all dialogs that appear (accept them all)
    page.on('dialog', async (dialog) => {
      dialogCount++;
      const msg = dialog.message();
      dialogMessages.push(msg);
      console.log(`Dialog #${dialogCount} appeared:`, msg);
      await dialog.accept();
      console.log(`Dialog #${dialogCount} accepted`);
    });

    // Create a promise that waits for the first dialog
    const dialogPromise = new Promise((resolve) => {
      const checkDialog = () => {
        if (dialogCount > 0) {
          resolve(true);
        }
      };
      // Check every 500ms
      const interval = setInterval(checkDialog, 500);

      // Timeout fallback - if no dialog appears within 15 seconds
      setTimeout(() => {
        clearInterval(interval);
        if (dialogCount === 0) {
          console.log('No dialog appeared within timeout');
          resolve(false);
        } else {
          resolve(true);
        }
      }, 15000);
    });

    let dialogMessage = '';

    // Debug: Check what the send button does when clicked
    const buttonInfo = await page.evaluate(() => {
      const btn = document.querySelector('button');
      const sendBtn = Array.from(document.querySelectorAll('button, input[type="button"], input[type="submit"]'))
        .find(b => b.textContent?.includes('발송') || b.value?.includes('발송'));
      return sendBtn ? {
        tagName: sendBtn.tagName,
        type: sendBtn.type,
        onclick: sendBtn.onclick?.toString()?.substring(0, 200),
        form: sendBtn.form?.id || sendBtn.form?.action
      } : null;
    });
    console.log('Send button info:', JSON.stringify(buttonInfo));

    // Click the send button
    try {
      await page.getByRole('button', { name: '메시지 발송' }).click();
      console.log('Send button clicked');
    } catch (e) {
      console.log('Role-based button click failed, trying fallback...');
      await page.evaluate(() => {
        const buttons = document.querySelectorAll('button');
        for (const btn of buttons) {
          if (btn.textContent?.includes('발송')) {
            btn.click();
            return;
          }
        }
      });
    }

    // Wait for dialog to be handled
    console.log('Waiting for confirmation dialog...');
    const wasDialogHandled = await dialogPromise;

    // Log any network requests made
    console.log('Network requests summary:', networkRequests.map(r => ({
      url: r.url,
      method: r.method,
      hasToTeacher: r.hasToTeacher,
      hasMessage: r.hasMessage
    })));

    if (wasDialogHandled) {
      console.log('Dialogs handled:', dialogCount, 'messages:', dialogMessages);
      dialogMessage = dialogMessages.join(' | ');
    } else {
      console.log('Warning: No confirmation dialog detected');
    }

    // Wait for all dialogs and form submission to complete
    console.log('Waiting for form submission and additional dialogs...');
    await page.waitForTimeout(5000);

    // Log final dialog count
    console.log('Final dialog count:', dialogCount);
    console.log('All dialog messages:', dialogMessages);

    // Log network requests again after waiting
    console.log('All network requests:', JSON.stringify(networkRequests));

    // Check if page URL changed (might redirect after successful send)
    const urlAfterSend = page.url();
    console.log('URL after send:', urlAfterSend);

    // Wait for the success message to appear after dialog
    await page.waitForTimeout(3000);

    // Check for any second confirmation dialog or result messages
    let secondDialogMessage = '';
    const secondDialogPromise = new Promise((resolve) => {
      const handler = async (dialog) => {
        secondDialogMessage = dialog.message();
        console.log('Second dialog appeared:', secondDialogMessage);
        await dialog.accept();
        console.log('Second dialog accepted');
        resolve(true);
      };
      page.once('dialog', handler);
      setTimeout(() => resolve(false), 3000);
    });

    const hadSecondDialog = await secondDialogPromise;
    console.log('Had second dialog:', hadSecondDialog);

    // Wait a bit more for the page to update
    await page.waitForTimeout(2000);

    // Take screenshot after send
    const screenshotAfter = await page.screenshot();
    console.log('Screenshot after send, size:', screenshotAfter.length, 'bytes');

    // Check for success indicator - more comprehensive check
    const result = await page.evaluate(() => {
      const bodyText = document.body.innerText;
      // Look for various success indicators
      const hasSuccess = bodyText.includes('발송 완료') || bodyText.includes('성공') || bodyText.includes('발송되었습니다');
      const hasError = bodyText.includes('실패') || bodyText.includes('오류') || bodyText.includes('에러');
      const match = bodyText.match(/발송[^\n]{0,100}/g);

      // Also check for any visible alerts or error messages
      const alerts = Array.from(document.querySelectorAll('.alert, .error, .message, .result'))
        .map(el => el.textContent?.substring(0, 100));

      return {
        success: hasSuccess,
        hasError: hasError,
        message: match ? match.join(', ') : 'No success indicator found',
        bodyLength: bodyText.length,
        alerts: alerts,
        currentUrl: window.location.href
      };
    });

    console.log('Send result:', JSON.stringify(result));
    console.log('Test SMS completed');
    console.log('API response was:', JSON.stringify(apiResponse));
    return {
      status: apiResponse?.code === 0 ? 'success' : (result.hasError ? 'error' : 'unknown'),
      message: 'Test SMS sent to 민수정 선생님',
      dialogHandled: wasDialogHandled,
      dialogMessage: dialogMessage,
      secondDialog: hadSecondDialog ? secondDialogMessage : null,
      apiResponse: apiResponse,
      pageResult: result
    };

  } catch (err) {
    console.error('Error:', err);
    throw err;
  } finally {
    await browser.close();
  }
}

// Production SMS sending to students
// recipientType: 'student_and_parent' | 'parent_only' | 'student_only'
async function sendAbsentSMS(absentStudents, recipientType = 'student_and_parent') {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const results = [];

  try {
    const context = await browser.newContext();
    const page = await context.newPage();

    // Login
    await loginToRiroschool(page);

    // Navigate to SMS page
    await page.goto('https://cnsa.riroschool.kr/sms.php?action=send', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(3000);
    console.log('Navigated to SMS page');

    for (const student of absentStudents) {
      try {
        const { grade, classNum, number } = parseStudentId(student.studentId);
        console.log(`Processing student: ${student.name} (${grade}학년 ${classNum}반 ${number}번)`);

        // Clear previous selections
        await page.evaluate(() => {
          const checkboxes = document.querySelectorAll('input[type="checkbox"]:checked');
          checkboxes.forEach(cb => cb.click());
        });
        await page.waitForTimeout(500);

        // Click 학생 directory
        await page.evaluate(() => {
          const items = document.querySelectorAll('li');
          for (const item of items) {
            const text = item.textContent || '';
            if (text.includes('학생') && !text.includes('학생(본인)')) {
              item.click();
              break;
            }
          }
        });
        await page.waitForTimeout(800);

        // Click grade (학년)
        await page.evaluate((g) => {
          const items = document.querySelectorAll('li');
          for (const item of items) {
            if (item.textContent.includes(`${g}학년`)) {
              item.click();
              break;
            }
          }
        }, grade);
        await page.waitForTimeout(800);

        // Click class (반) - classNum is like '108', need to show as '108반'
        await page.evaluate((c) => {
          const items = document.querySelectorAll('li');
          for (const item of items) {
            if (item.textContent.includes(`${c}반`)) {
              item.click();
              break;
            }
          }
        }, classNum);
        await page.waitForTimeout(800);

        // Find student by number and name
        let studentFound = false;
        for (let i = 0; i < 10; i++) {
          studentFound = await page.evaluate((num, name) => {
            const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
            while (walker.nextNode()) {
              const text = walker.currentNode.textContent;
              if (text.includes(name) || text.includes(`${num}번`)) {
                const parent = walker.currentNode.parentElement;
                const listItem = parent.closest('li');
                if (listItem) {
                  const checkbox = listItem.querySelector('input[type="checkbox"]');
                  if (checkbox) {
                    checkbox.click();
                    return true;
                  }
                }
              }
            }
            return false;
          }, number, student.name);

          if (studentFound) break;

          // Scroll
          await page.evaluate(() => {
            const lists = document.querySelectorAll('ul');
            for (const list of lists) {
              if (list.scrollHeight > list.clientHeight) {
                list.scrollTop += 300;
              }
            }
          });
          await page.waitForTimeout(500);
        }

        if (!studentFound) {
          console.log(`Student ${student.name} not found`);
          results.push({ student: student.name, status: 'error', message: 'Student not found' });
          continue;
        }

        // Select recipients based on recipientType
        await page.evaluate((recType) => {
          const labels = document.querySelectorAll('label');
          for (const label of labels) {
            const text = label.textContent || '';
            let shouldSelect = false;

            if (recType === 'student_and_parent') {
              // 학생(본인) + 어머니
              shouldSelect = text.includes('학생(본인)') || text.includes('어머니');
            } else if (recType === 'parent_only') {
              // 어머니만
              shouldSelect = text.includes('어머니');
            } else if (recType === 'student_only') {
              // 학생(본인)만
              shouldSelect = text.includes('학생(본인)');
            }

            if (shouldSelect) {
              const checkbox = label.querySelector('input[type="checkbox"]') ||
                              document.getElementById(label.getAttribute('for'));
              if (checkbox && !checkbox.checked) {
                checkbox.click();
              }
            }
          }
        }, recipientType);
        await page.waitForTimeout(500);

        // Enter title if available
        await page.evaluate((title) => {
          const titleInput = document.querySelector('input[name="title"], input[placeholder*="제목"]');
          if (titleInput) {
            titleInput.value = title;
            titleInput.dispatchEvent(new Event('input', { bubbles: true }));
          }
        }, SMS_TITLE);

        // Enter message
        await page.evaluate((msg) => {
          const textarea = document.querySelector('textarea');
          if (textarea) {
            textarea.value = msg;
            textarea.dispatchEvent(new Event('input', { bubbles: true }));
          }
        }, SMS_MESSAGE);
        await page.waitForTimeout(500);

        // Select 모두 문자
        await page.evaluate(() => {
          const allSmsRadio = document.querySelector('#allsms');
          if (allSmsRadio) allSmsRadio.click();
        });
        await page.waitForTimeout(500);

        // Enter password
        await page.evaluate((pw) => {
          const pwInput = document.querySelector('input[type="password"]');
          if (pwInput) {
            pwInput.value = pw;
            pwInput.dispatchEvent(new Event('input', { bubbles: true }));
          }
        }, CNSA_PW);
        await page.waitForTimeout(500);

        // Click send button and handle confirmation dialog
        let dialogHandled = false;
        const dialogPromise = new Promise((resolve) => {
          const handler = async (dialog) => {
            console.log(`Dialog for ${student.name}:`, dialog.message());
            await dialog.accept();
            dialogHandled = true;
            resolve(true);
          };
          page.once('dialog', handler);
          setTimeout(() => {
            if (!dialogHandled) resolve(false);
          }, 10000);
        });

        await page.evaluate(() => {
          const buttons = document.querySelectorAll('button, input[type="button"], input[type="submit"]');
          for (const btn of buttons) {
            if (btn.textContent?.includes('발송') || btn.value?.includes('발송')) {
              btn.click();
              return;
            }
          }
        });

        // Wait for dialog to be handled
        const wasDialogHandled = await dialogPromise;
        console.log(`Dialog handled for ${student.name}:`, wasDialogHandled);
        await page.waitForTimeout(3000);

        console.log(`SMS sent to ${student.name}`);
        results.push({ student: student.name, status: 'success', message: 'SMS sent to 학생 + 어머니', dialogHandled: wasDialogHandled });

      } catch (err) {
        console.error(`Error sending SMS to ${student.name}:`, err.message);
        results.push({ student: student.name, status: 'error', message: err.message });
      }
    }

  } finally {
    await browser.close();
  }

  return results;
}

// API Endpoints
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    mode: isProductionMode() ? 'production' : 'test',
    productionStartDate: PRODUCTION_START_DATE.toISOString()
  });
});

// Test endpoint - sends to 민수정 선생님
app.post('/api/test-sms', async (req, res) => {
  if (!CNSA_ID || !CNSA_PW) {
    return res.status(500).json({ error: 'CNSA credentials not configured' });
  }

  try {
    console.log('Sending test SMS to 민수정 선생님...');
    const result = await sendTestSMS();
    res.json(result);
  } catch (err) {
    console.error('Test SMS error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Main endpoint - behavior depends on date
// recipientType: 'student_and_parent' | 'parent_only' | 'student_only'
app.post('/api/send-absent-sms', async (req, res) => {
  const { absentStudents, recipientType = 'student_and_parent' } = req.body;

  if (!CNSA_ID || !CNSA_PW) {
    return res.status(500).json({ error: 'CNSA credentials not configured' });
  }

  // Before production date: send test to 민수정
  if (!isProductionMode()) {
    console.log('Test mode: sending to 민수정 instead of students');
    try {
      const result = await sendTestSMS();
      res.json({
        mode: 'test',
        message: '테스트 모드: 민수정 선생님에게 발송됨 (2026-01-07 이후 학생에게 발송)',
        absentStudentsReceived: absentStudents?.length || 0,
        recipientType,
        result
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
    return;
  }

  // Production mode: send to students
  if (!absentStudents || !Array.isArray(absentStudents) || absentStudents.length === 0) {
    return res.status(400).json({
      error: 'absentStudents array is required',
      example: [{ studentId: '10823', name: '홍길동' }],
      recipientTypes: ['student_and_parent', 'parent_only', 'student_only']
    });
  }

  // Validate recipientType
  const validTypes = ['student_and_parent', 'parent_only', 'student_only'];
  if (!validTypes.includes(recipientType)) {
    return res.status(400).json({
      error: 'Invalid recipientType',
      validTypes
    });
  }

  try {
    console.log(`Sending SMS to ${absentStudents.length} students (recipientType: ${recipientType})...`);
    const results = await sendAbsentSMS(absentStudents, recipientType);

    const successful = results.filter(r => r.status === 'success').length;
    const failed = results.filter(r => r.status === 'error').length;

    res.json({
      mode: 'production',
      recipientType,
      message: `SMS sending completed: ${successful} success, ${failed} failed`,
      results
    });
  } catch (err) {
    console.error('SMS sending error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Discord webhook for reporting
const DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/1414838907299692626/JFA44m5Pf_iw3BILrS1rgY9vs0Mg_ajZDrMODKtScpjqmyz3znEFxr7hXbOPoKYGilig';

// Google Spreadsheet URL
const SPREADSHEET_URL = 'https://docs.google.com/spreadsheets/d/1gVFE9dxJ-tl6f4KFqe5z2XDZ2B5mVgzpFAj7s-XrLAs/edit';

// Capture Google Sheet screenshot
async function captureSheetScreenshot(sheetName) {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const context = await browser.newContext({
      viewport: { width: 1400, height: 900 }
    });
    const page = await context.newPage();

    // Navigate to the specific sheet
    const sheetUrl = `${SPREADSHEET_URL}#gid=0`;
    console.log('Opening spreadsheet:', sheetUrl);

    await page.goto(sheetUrl, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(3000);

    // Try to find and click the specific sheet tab
    try {
      const sheetTab = page.locator(`text=${sheetName}`).first();
      if (await sheetTab.isVisible()) {
        await sheetTab.click();
        console.log(`Clicked on sheet tab: ${sheetName}`);
        await page.waitForTimeout(2000);
      }
    } catch (e) {
      console.log('Could not click sheet tab:', e.message);
    }

    // Hide unnecessary UI elements for cleaner screenshot
    await page.evaluate(() => {
      // Hide toolbar and other UI elements
      const elementsToHide = [
        '#docs-toolbar-wrapper',
        '#docs-chrome',
        '.docs-sheet-tab-bar',
        '#docs-editor-container > div:first-child'
      ];
      elementsToHide.forEach(selector => {
        const el = document.querySelector(selector);
        if (el) el.style.display = 'none';
      });
    });

    // Take screenshot of the sheet area
    const screenshot = await page.screenshot({
      type: 'png',
      clip: {
        x: 0,
        y: 0,
        width: 1200,
        height: 600
      }
    });

    console.log('Screenshot captured, size:', screenshot.length, 'bytes');
    return screenshot;

  } finally {
    await browser.close();
  }
}

// Send message and image to Discord with embed
async function sendToDiscord(message, imageBuffer, embedData = null) {
  const FormData = require('form-data');
  const fetch = require('node-fetch');

  const formData = new FormData();

  // 임베드와 버튼이 있는 payload
  const payload = {
    content: message
  };

  // 임베드 추가 (있는 경우)
  if (embedData) {
    payload.embeds = [{
      title: embedData.title || '📋 면학 출결 현황',
      description: embedData.description,
      color: 0x5865F2, // Discord 블루
      fields: embedData.fields || [],
      timestamp: new Date().toISOString(),
      footer: {
        text: 'VIC 출결관리 시스템'
      }
    }];

    // 링크 버튼 추가
    payload.components = [{
      type: 1, // Action Row
      components: [{
        type: 2, // Button
        style: 5, // Link
        label: '📊 스프레드시트 열기',
        url: SPREADSHEET_URL
      }]
    }];
  }

  formData.append('payload_json', JSON.stringify(payload));

  if (imageBuffer) {
    formData.append('file', imageBuffer, {
      filename: 'attendance_report.png',
      contentType: 'image/png'
    });
  }

  const response = await fetch(DISCORD_WEBHOOK_URL, {
    method: 'POST',
    body: formData
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Discord webhook failed: ${response.status} - ${errorText}`);
  }

  return { success: true };
}

// Discord report endpoint
app.post('/api/send-discord-report', async (req, res) => {
  const { date, sheetName, grade1Count, grade2Count, message } = req.body;

  if (!date || !sheetName) {
    return res.status(400).json({
      error: 'date and sheetName are required',
      example: { date: '2026-01-07', sheetName: '260107', grade1Count: 3, grade2Count: 2 }
    });
  }

  try {
    console.log(`Capturing sheet ${sheetName} and sending to Discord...`);

    // Capture screenshot
    let screenshot = null;
    try {
      screenshot = await captureSheetScreenshot(sheetName);
    } catch (e) {
      console.error('Screenshot capture failed:', e.message);
      // Continue without screenshot
    }

    // Format date for message
    const dateObj = new Date(date + 'T00:00:00+09:00');
    const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
    const formattedDate = `${dateObj.getMonth() + 1}월 ${dateObj.getDate()}일(${weekdays[dateObj.getDay()]})`;

    // 임베드 데이터
    const embedData = {
      title: `📋 ${formattedDate} 면학 출결 현황`,
      description: `시트: **${sheetName}**`,
      fields: [
        {
          name: '1학년 결석',
          value: `${grade1Count || 0}명`,
          inline: true
        },
        {
          name: '2학년 결석',
          value: `${grade2Count || 0}명`,
          inline: true
        },
        {
          name: '총 결석',
          value: `${(grade1Count || 0) + (grade2Count || 0)}명`,
          inline: true
        }
      ]
    };

    // 부장님께 보낼 메시지 (클립보드 복사용)
    const clipboardMessage = message || `안녕하세요, 이현경 부장님.
${formattedDate} 겨울방학 방과후학교 조간면학 출결현황 보내드립니다.
총 ${(grade1Count || 0) + (grade2Count || 0)}명의 학생 및 학부모님께 알림 발송 완료했습니다.
[VIC 조간면학일지 스프레드시트] ${SPREADSHEET_URL}?usp=sharing
감사합니다.`;

    // Send to Discord with embed
    await sendToDiscord(clipboardMessage, screenshot, embedData);

    res.json({
      success: true,
      message: 'Discord 전송 완료',
      sheetName,
      hasScreenshot: !!screenshot
    });

  } catch (err) {
    console.error('Discord report error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`VIC SMS Server running on port ${PORT}`);
  console.log(`Mode: ${isProductionMode() ? 'PRODUCTION' : 'TEST'}`);
  console.log(`Production starts: ${PRODUCTION_START_DATE.toISOString()}`);
});
