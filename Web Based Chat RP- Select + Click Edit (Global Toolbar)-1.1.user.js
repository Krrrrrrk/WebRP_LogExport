// ==UserScript==
// @name         RP Chat: Extract & Copy All Messages
// @namespace    https://example.com
// @version      2.1
// @description  Ctrl+Alt+E: Extract all messages with custom character names and copy to clipboard. Ctrl+Alt+H: highlight targets.
// @match        https://ourdream.ai/*
// @run-at       document-idle
// @grant        GM_setClipboard
// @grant        GM.setClipboard
// ==/UserScript==

(function () {
  'use strict';

  // Your message container selector
  const MESSAGE_SELECTOR = 'div.min-w-0.flex.flex-col.gap-4.px-3.py-2';

  // Updated toolbar selectors - user messages have bg-pink-500, AI messages have bg-secondary
  const TOOLBAR_SELECTORS = [
    'div.absolute.bg-pink-500',  // User message toolbars
    'div.absolute.bg-secondary'   // AI message toolbars
  ];

  // The pencil SVG path that identifies the edit button
  const PENCIL_SVG_PATH = 'M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z';

  // Timing tweaks
  const CLICK_DELAY = 100;
  const APPEAR_DELAY = 500;
  const MAX_SEARCH_MS = 3000;
  const SCROLL_BEHAVIOR = 'instant';
  const BETWEEN_MESSAGE_DELAY = 300; // Increased to ensure proper cleanup
  const TEXTAREA_WAIT = 500; // Wait for textarea to appear after edit click

  // Storage for collected messages
  let collectedMessages = [];

  // Global variables for labels
  let globalAILabel = '[AI]';
  let globalUserLabel = '[You]';

  const wait = (ms) => new Promise(r => setTimeout(r, ms));

  const isVisible = (el) => {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);

    const isHidden = cs.visibility === 'hidden' ||
                     cs.display === 'none' ||
                     (r.width === 0 && r.height === 0);

    return !isHidden;
  };

  const fullClick = (el) => {
    const o = { bubbles: true, cancelable: true, composed: true };
    try {
      el.dispatchEvent(new PointerEvent('pointerdown', o));
      el.dispatchEvent(new PointerEvent('pointerup', o));
      el.dispatchEvent(new MouseEvent('click', o));
    } catch(e) {
      console.error('[RP-Extract] Click error:', e);
    }
  };

  function isPencilButton(btn) {
    if (!btn) return false;

    const svgs = btn.querySelectorAll('svg');
    for (const svg of svgs) {
      const svgHTML = svg.outerHTML || svg.innerHTML || '';
      if (svgHTML.includes('M17 3a2.828') ||
          svgHTML.includes('L7.5 20.5 2 22') ||
          svgHTML.includes('pencil')) {
        return true;
      }
    }

    const btnHTML = btn.outerHTML || '';
    if (btnHTML.includes('M17 3a2.828') ||
        btnHTML.includes('L7.5 20.5 2 22')) {
      return true;
    }

    return false;
  }

  function findAllToolbars() {
    const allToolbars = [];

    for (const selector of TOOLBAR_SELECTORS) {
      const toolbars = document.querySelectorAll(selector);
      toolbars.forEach(tb => {
        if (isVisible(tb)) {
          allToolbars.push(tb);
        }
      });
    }

    const bubbles = document.querySelectorAll('div.absolute.rounded-full');
    bubbles.forEach(b => {
      if (isVisible(b) && b.querySelector('button')) {
        if (!allToolbars.includes(b)) {
          allToolbars.push(b);
        }
      }
    });

    return allToolbars;
  }

  function findEditButton(toolbars) {
    for (const tb of toolbars) {
      const allButtons = tb.querySelectorAll('button');
      const visibleButtons = Array.from(allButtons).filter(isVisible);

      for (const btn of visibleButtons) {
        if (btn.hasAttribute('aria-haspopup')) {
          continue;
        }

        if (isPencilButton(btn)) {
          return btn;
        }
      }

      const nonMenuBtn = visibleButtons.find(b => !b.hasAttribute('aria-haspopup'));
      if (nonMenuBtn) {
        return nonMenuBtn;
      }
    }

    return null;
  }

  async function waitForEditButton(timeoutMs) {
    const t0 = performance.now();

    return await new Promise(resolve => {
      const checkInterval = setInterval(() => {
        const toolbars = findAllToolbars();
        if (toolbars.length > 0) {
          const btn = findEditButton(toolbars);
          if (btn) {
            clearInterval(checkInterval);
            resolve(btn);
            return;
          }
        }

        if (performance.now() - t0 >= timeoutMs) {
          clearInterval(checkInterval);
          resolve(null);
        }
      }, 50);
    });
  }

  async function hideExistingToolbars() {
    const toolbars = findAllToolbars();
    const body = document.body;
    fullClick(body);

    // Also try to close any open edit modes
    const cancelBtns = document.querySelectorAll('button');
    const visibleCancel = Array.from(cancelBtns).find(btn =>
      btn.textContent && btn.textContent.trim() === 'Cancel' && isVisible(btn)
    );
    if (visibleCancel) {
      console.log('[RP-Extract] Closing existing edit mode');
      fullClick(visibleCancel);
      await wait(300); // Use fixed wait time
    }
  }

  // Track processed textareas to avoid duplicates
  let processedTextareas = new Set();

  async function waitForTextarea(messageElement, timeoutMs) {
    const t0 = performance.now();
    console.log(`[RP-Extract] Waiting for new textarea... Already processed: ${processedTextareas.size}`);

    let logCounter = 0;
    return await new Promise(resolve => {
      const checkInterval = setInterval(() => {
        // Look for all textareas
        const allTextareas = document.querySelectorAll('textarea');

        // Log only occasionally to avoid spam
        if (logCounter++ % 10 === 0) {
          console.log(`[RP-Extract] Checking ${allTextareas.length} textareas...`);
        }

        // Find a textarea that:
        // 1. Is visible
        // 2. Hasn't been processed yet
        // 3. Has content (not empty)
        for (const ta of allTextareas) {
          const isVis = isVisible(ta);
          const isProcessed = processedTextareas.has(ta);
          const hasContent = ta.value.trim() !== '';

          if (!isVis) continue;
          if (isProcessed) {
            console.log(`[RP-Extract] Skipping already processed textarea`);
            continue;
          }
          if (!hasContent) continue;

          // Mark this textarea as processed and return it
          console.log(`[RP-Extract] Found new textarea with ${ta.value.length} chars, preview: "${ta.value.substring(0, 50)}..."`);
          processedTextareas.add(ta);
          clearInterval(checkInterval);
          resolve(ta);
          return;
        }

        if (performance.now() - t0 >= timeoutMs) {
          clearInterval(checkInterval);
          console.warn('[RP-Extract] Timeout waiting for textarea');
          // Last resort: find ANY visible textarea with content that we haven't processed
          const fallback = Array.from(allTextareas).find(ta =>
            isVisible(ta) && ta.value.trim() !== '' && !processedTextareas.has(ta)
          );
          if (fallback) {
            console.log('[RP-Extract] Using fallback textarea');
            processedTextareas.add(fallback);
          }
          resolve(fallback || null);
        }
      }, 50);
    });
  }

  function getMessageRole(msg) {
    // Look for parent with data-role attribute
    let element = msg;
    let maxDepth = 15; // Increased search depth

    while (element && maxDepth > 0) {
      if (element.hasAttribute && element.hasAttribute('data-role')) {
        const role = element.getAttribute('data-role');
        console.log(`[RP-Extract] Found data-role="${role}" on element`);
        return role;
      }
      element = element.parentElement;
      maxDepth--;
    }

    // Alternative: check for the group/message div with data-role
    const messageContainer = document.querySelector('div.group\\/message[data-role]');
    if (messageContainer && msg.contains(messageContainer)) {
      const role = messageContainer.getAttribute('data-role');
      console.log(`[RP-Extract] Found data-role="${role}" via group/message selector`);
      return role;
    }

    // Fallback: check toolbar color if still visible
    const toolbar = findAllToolbars()[0];
    if (toolbar) {
      if (toolbar.className.includes('bg-pink-500')) {
        console.log('[RP-Extract] Determined role as "user" from pink toolbar');
        return 'user';
      } else if (toolbar.className.includes('bg-secondary')) {
        console.log('[RP-Extract] Determined role as "assistant" from secondary toolbar');
        return 'assistant';
      }
    }

    console.warn('[RP-Extract] Could not determine message role');
    return 'unknown';
  }

  async function processMessage(msg, index, total) {
    console.log(`[RP-Extract] Processing message ${index + 1}/${total}`);

    try {
      // Scroll to message
      msg.scrollIntoView({ behavior: SCROLL_BEHAVIOR, block: 'center' });
      await wait(CLICK_DELAY);

      // Get the role before we click (easier to find)
      const role = getMessageRole(msg);
      console.log(`[RP-Extract] Message role: ${role}`);

      // Hide any existing toolbars
      await hideExistingToolbars();
      await wait(50);

      // Click the message to select it
      fullClick(msg);
      const contentArea = msg.querySelector('.prose') || msg.querySelector('div');
      if (contentArea && contentArea !== msg) {
        await wait(50);
        fullClick(contentArea);
      }

      await wait(APPEAR_DELAY);

      // Wait for and find the edit button
      const btn = await waitForEditButton(MAX_SEARCH_MS);

      if (btn) {
        // Click the edit button
        console.log('[RP-Extract] Clicking edit button...');
        fullClick(btn);

        // Wait for textarea to appear
        await wait(TEXTAREA_WAIT);

        const textarea = await waitForTextarea(msg, 2000);

        if (textarea) {
          const text = textarea.value;
          console.log(`[RP-Extract] Extracted ${text.length} characters from ${role} message`);
          console.log(`[RP-Extract] Preview: "${text.substring(0, 50)}..."`);

          // Store the message with custom role label
          const label = role === 'assistant' ? globalAILabel : role === 'user' ? globalUserLabel : '[Unknown]';
          collectedMessages.push({
            role: role,
            label: label,
            text: text,
            index: index
          });

          // Click Cancel button to close edit mode
          const cancelBtns = document.querySelectorAll('button');
          const cancelBtn = Array.from(cancelBtns).find(btn =>
            btn.textContent && btn.textContent.trim() === 'Cancel' && isVisible(btn)
          );
          if (cancelBtn) {
            console.log('[RP-Extract] Clicking Cancel to close edit mode');
            fullClick(cancelBtn);
            await wait(300); // Wait after cancel
          } else {
            console.warn('[RP-Extract] No Cancel button found, continuing anyway');
          }

          return true;
        } else {
          console.warn('[RP-Extract] No textarea found after clicking edit');
          return false;
        }
      } else {
        console.warn('[RP-Extract] No edit button found for this message');
        return false;
      }
    } catch (e) {
      console.error('[RP-Extract] Error processing message:', e);
      return false;
    }
  }

  function formatCollectedMessages() {
    // Format all collected messages
    let formatted = '';

    for (const msg of collectedMessages) {
      // Add separator
      formatted += '\n' + '─'.repeat(50) + '\n';

      // Add label and text
      formatted += `${msg.label}\n${msg.text}\n`;
    }

    // Add final separator
    formatted += '\n' + '═'.repeat(50) + '\n';
    formatted += `\nExtracted ${collectedMessages.length} messages from RP chat\n`;

    return formatted;
  }

  function copyToClipboard(text) {
    // Try multiple methods to ensure compatibility

    // Method 1: GM_setClipboard (if available)
    if (typeof GM_setClipboard !== 'undefined') {
      GM_setClipboard(text);
      return true;
    }

    // Method 2: GM.setClipboard (newer API)
    if (typeof GM !== 'undefined' && GM.setClipboard) {
      GM.setClipboard(text);
      return true;
    }

    // Method 3: Modern Clipboard API
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        console.log('[RP-Extract] Copied to clipboard using Clipboard API');
      }).catch(err => {
        console.error('[RP-Extract] Clipboard API failed:', err);
        fallbackCopy(text);
      });
      return true;
    }

    // Method 4: Fallback using textarea
    return fallbackCopy(text);
  }

  function fallbackCopy(text) {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.top = '0';
      textarea.style.left = '0';
      textarea.style.width = '2px';
      textarea.style.height = '2px';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      console.log('[RP-Extract] Copied to clipboard using fallback method');
      return true;
    } catch (e) {
      console.error('[RP-Extract] Fallback copy failed:', e);
      return false;
    }
  }

  async function runExtraction() {
    // Try to get custom AI character name (optional)
    try {
      const aiName = prompt('Enter the AI character name (e.g., "Maddie", "Susan"):\n\nLeave blank for "AI", Cancel for default "[AI]"', '');
      if (aiName !== null && aiName.trim()) {
        globalAILabel = `[${aiName.trim()}]`;
      }
    } catch (e) {
      console.log('[RP-Extract] Could not show prompt, using default labels');
    }

    console.log(`[RP-Extract] Using labels: AI="${globalAILabel}", User="${globalUserLabel}"`);

    // Reset collected messages and processed textareas
    collectedMessages = [];
    processedTextareas = new Set();

    const messages = Array.from(document.querySelectorAll(MESSAGE_SELECTOR)).filter(isVisible);
    console.log(`[RP-Extract] Found ${messages.length} messages to process`);

    if (messages.length === 0) {
      console.warn('[RP-Extract] No messages found');
      alert('No messages found to extract!');
      return;
    }

    let extracted = 0, failed = 0;

    for (let i = 0; i < messages.length; i++) {
      const success = await processMessage(messages[i], i, messages.length);

      if (success) {
        extracted++;
      } else {
        failed++;
      }

      await wait(BETWEEN_MESSAGE_DELAY);
    }

    console.log(`[RP-Extract] ✅ Extraction complete! Extracted ${extracted}/${messages.length} messages`);
    if (failed > 0) {
      console.log(`[RP-Extract] ⚠️ Failed to extract ${failed} message(s)`);
    }

    // Format and copy to clipboard
    if (collectedMessages.length > 0) {
      const formatted = formatCollectedMessages();
      console.log('[RP-Extract] Formatted text preview:', formatted.substring(0, 500) + '...');

      if (copyToClipboard(formatted)) {
        const userCount = collectedMessages.filter(m => m.role === 'user').length;
        const aiCount = collectedMessages.filter(m => m.role === 'assistant').length;
        alert(`✅ Successfully extracted and copied ${collectedMessages.length} messages to clipboard!\n\n` +
              `${userCount} from ${globalUserLabel}\n` +
              `${aiCount} from ${globalAILabel}`);
      } else {
        console.error('[RP-Extract] Failed to copy to clipboard');
        alert('Extraction complete but failed to copy to clipboard. Check console for the text.');
        console.log('[RP-Extract] Full extracted text:', formatted);
      }
    } else {
      alert('No messages were successfully extracted. Check the console for errors.');
    }
  }

  // Highlight support
  const HILITE_CLASS = '__rp_edit_targets';
  const style = document.createElement('style');
  style.textContent = `.${HILITE_CLASS}{outline:3px solid #2b6;outline-offset:2px;border-radius:8px;background-color:rgba(34,187,102,0.05);}`;
  document.documentElement.appendChild(style);

  let highlightOn = false;
  function toggleHighlight() {
    highlightOn = !highlightOn;
    document.querySelectorAll('.' + HILITE_CLASS).forEach(n => n.classList.remove(HILITE_CLASS));

    if (highlightOn) {
      const messages = Array.from(document.querySelectorAll(MESSAGE_SELECTOR)).filter(isVisible);
      messages.forEach(n => n.classList.add(HILITE_CLASS));
      console.log(`[RP-Extract] Highlighted ${messages.length} messages`);
    } else {
      console.log('[RP-Extract] Highlighting disabled');
    }
  }

  // Hotkeys
  window.addEventListener('keydown', (e) => {
    if (!e.ctrlKey || !e.altKey) return;
    const k = e.key.toLowerCase();

    if (k === 'h') {
      e.preventDefault();
      toggleHighlight();
    } else if (k === 'e') {
      e.preventDefault();
      console.log('[RP-Extract] Starting extraction...');
      runExtraction();
    }
  });

  console.log('[RP-Extract] Script loaded. Use Ctrl+Alt+E to extract (with custom character names), Ctrl+Alt+H to highlight.');
})();
