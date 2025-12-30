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
const CNSA_PW = process.env.CNSA_PW;

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
const SMS_MESSAGE = `안녕하세요. 충남삼성고등학교입니다.

본 메시지는 금일 08:30 면학실 출석 확인이 되지 않은 학생을 대상으로 자동 발송됩니다.
면학실 출석 확인은 08:30부터 면학실에서 진행되오니,
해당 학생은 출석 확인 후 방과후 교실로 이동해 주시기 바랍니다.

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

    // Handle dialogs
    page.on('dialog', async dialog => {
      console.log('Dialog:', dialog.message());
      await dialog.accept();
    });

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
    try {
      // The recipient section has separate checkboxes for 학생(본인), 어머니, 아버지, 선생님
      const recipientCheckbox = page.locator('text=선생님').last();
      await recipientCheckbox.click();
    } catch (e) {
      await page.evaluate(() => {
        // Find the recipient selection area (수신자 선택)
        const divs = document.querySelectorAll('div');
        for (const div of divs) {
          if (div.textContent?.includes('수신자 선택')) {
            const parent = div.parentElement || div;
            const items = parent.querySelectorAll('div[cursor="pointer"], span');
            for (const item of items) {
              if (item.textContent?.trim() === '선생님') {
                item.click();
                return;
              }
            }
          }
        }
      });
    }
    await page.waitForTimeout(500);

    // Step 5: Enter message
    console.log('Entering message...');
    const messageBox = page.getByRole('textbox', { name: /메시지를 입력/ });
    if (await messageBox.count() > 0) {
      await messageBox.fill(TEST_MESSAGE);
    } else {
      await page.evaluate((msg) => {
        const textarea = document.querySelector('textarea');
        if (textarea) {
          textarea.value = msg;
          textarea.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }, TEST_MESSAGE);
    }
    await page.waitForTimeout(500);

    // Step 6: Make sure 모두 문자 is selected (should be default)
    console.log('Ensuring 모두 문자 is selected...');
    try {
      const allSmsRadio = page.getByRole('radio', { name: '모두 문자' });
      if (await allSmsRadio.count() > 0 && !(await allSmsRadio.isChecked())) {
        await allSmsRadio.click();
      }
    } catch (e) {
      // Already selected or not needed
    }
    await page.waitForTimeout(500);

    // Step 7: Enter password for sending
    console.log('Entering password...');
    const pwInput = page.getByRole('textbox', { name: '로그인 비밀번호 입력' });
    if (await pwInput.count() > 0) {
      await pwInput.fill(CNSA_PW);
    } else {
      await page.evaluate((pw) => {
        const input = document.querySelector('input[type="password"], input[placeholder*="비밀번호"]');
        if (input) {
          input.value = pw;
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }, CNSA_PW);
    }
    await page.waitForTimeout(500);

    // Step 8: Click send button
    console.log('Clicking send button...');
    try {
      await page.getByRole('button', { name: '메시지 발송' }).click();
    } catch (e) {
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
    await page.waitForTimeout(3000);

    console.log('Test SMS sent successfully');
    return { status: 'success', message: 'Test SMS sent to 민수정 선생님' };

  } catch (err) {
    console.error('Error:', err);
    throw err;
  } finally {
    await browser.close();
  }
}

// Production SMS sending to students
async function sendAbsentSMS(absentStudents) {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const results = [];

  try {
    const context = await browser.newContext();
    const page = await context.newPage();

    // Handle dialogs
    page.on('dialog', async dialog => {
      console.log('Dialog:', dialog.message());
      await dialog.accept();
    });

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

        // Select recipients: 학생(본인) + 어머니
        await page.evaluate(() => {
          const labels = document.querySelectorAll('label');
          for (const label of labels) {
            const text = label.textContent || '';
            if (text.includes('학생(본인)') || text.includes('어머니')) {
              const checkbox = label.querySelector('input[type="checkbox"]') ||
                              document.getElementById(label.getAttribute('for'));
              if (checkbox && !checkbox.checked) {
                checkbox.click();
              }
            }
          }
        });
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

        // Click send button
        await page.evaluate(() => {
          const buttons = document.querySelectorAll('button, input[type="button"], input[type="submit"]');
          for (const btn of buttons) {
            if (btn.textContent?.includes('발송') || btn.value?.includes('발송')) {
              btn.click();
              return;
            }
          }
        });
        await page.waitForTimeout(3000);

        console.log(`SMS sent to ${student.name}`);
        results.push({ student: student.name, status: 'success', message: 'SMS sent to 학생 + 어머니' });

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
app.post('/api/send-absent-sms', async (req, res) => {
  const { absentStudents } = req.body;

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
      example: [{ studentId: '10823', name: '홍길동' }]
    });
  }

  try {
    console.log(`Sending SMS to ${absentStudents.length} absent students...`);
    const results = await sendAbsentSMS(absentStudents);

    const successful = results.filter(r => r.status === 'success').length;
    const failed = results.filter(r => r.status === 'error').length;

    res.json({
      mode: 'production',
      message: `SMS sending completed: ${successful} success, ${failed} failed`,
      results
    });
  } catch (err) {
    console.error('SMS sending error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`VIC SMS Server running on port ${PORT}`);
  console.log(`Mode: ${isProductionMode() ? 'PRODUCTION' : 'TEST'}`);
  console.log(`Production starts: ${PRODUCTION_START_DATE.toISOString()}`);
});
