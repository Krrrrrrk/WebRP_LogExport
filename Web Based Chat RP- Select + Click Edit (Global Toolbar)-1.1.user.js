// ==UserScript==
// @name         Web Based Chat RP: Select + Click Edit (Global Toolbar)
// @namespace    https://example.com
// @version      1.1
// @description  Ctrl+Alt+E: select each message, then click its Edit (pencil) button. Ctrl+Alt+H: highlight targets.
// @match        https://ourdream.ai/*
// @run-at       document-idle
// @grant        none
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
  const APPEAR_DELAY = 300; // Longer wait for toolbar
  const MAX_SEARCH_MS = 2000;
  const SCROLL_BEHAVIOR = 'instant';
  const BETWEEN_MESSAGE_DELAY = 200;
  const AFTER_EDIT_DELAY = 500; // Wait after clicking edit to ensure it opens

  const wait = (ms) => new Promise(r => setTimeout(r, ms));

  const isVisible = (el) => {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);

    // More lenient visibility check
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
      console.error('[RP-Edit] Click error:', e);
    }
  };

  function isPencilButton(btn) {
    if (!btn) return false;

    // Check for the pencil SVG path
    const paths = btn.querySelectorAll('svg path');
    for (const path of paths) {
      const d = path.getAttribute('d');
      if (d && d.includes('M17 3a2.828')) {
        return true;
      }
    }

    return false;
  }

  function findAllToolbars() {
    // Search the entire document for toolbars
    const allToolbars = [];

    for (const selector of TOOLBAR_SELECTORS) {
      const toolbars = document.querySelectorAll(selector);
      toolbars.forEach(tb => {
        if (isVisible(tb)) {
          allToolbars.push(tb);
        }
      });
    }

    // Also check for any rounded-full toolbar bubbles
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
      console.log('[RP-Edit] Checking toolbar:', tb);

      // Get all buttons in this toolbar
      const allButtons = tb.querySelectorAll('button');
      console.log(`[RP-Edit] Found ${allButtons.length} total buttons in toolbar`);

      const visibleButtons = Array.from(allButtons).filter(isVisible);
      console.log(`[RP-Edit] ${visibleButtons.length} are visible`);

      // Debug: log all buttons
      visibleButtons.forEach((btn, idx) => {
        console.log(`[RP-Edit] Button ${idx}:`, {
          hasAriahaspopup: btn.hasAttribute('aria-haspopup'),
          dataState: btn.getAttribute('data-state'),
          innerHTML: btn.innerHTML.substring(0, 100),
          isPencil: isPencilButton(btn)
        });
      });

      // Look for the pencil button
      for (const btn of visibleButtons) {
        // Skip if it has aria-haspopup (menu/trash button)
        if (btn.hasAttribute('aria-haspopup')) {
          console.log('[RP-Edit] Skipping button with aria-haspopup');
          continue;
        }

        if (isPencilButton(btn)) {
          console.log('[RP-Edit] ✅ Found pencil button!');
          return btn;
        }
      }

      // Fallback: first non-menu button
      const nonMenuBtn = visibleButtons.find(b => !b.hasAttribute('aria-haspopup'));
      if (nonMenuBtn) {
        console.log('[RP-Edit] ✅ Found non-menu button (likely edit)');
        return nonMenuBtn;
      }
    }

    console.log('[RP-Edit] ❌ No suitable button found in any toolbar');
    return null;
  }

  async function waitForEditButton(timeoutMs) {
    const t0 = performance.now();

    return await new Promise(resolve => {
      const checkInterval = setInterval(() => {
        const toolbars = findAllToolbars();
        if (toolbars.length > 0) {
          console.log(`[RP-Edit] Found ${toolbars.length} toolbar(s)`);
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

  function hideExistingToolbars() {
    // Hide any existing toolbars before clicking a new message
    const toolbars = findAllToolbars();
    toolbars.forEach(tb => {
      tb.style.opacity = '0';
      tb.style.pointerEvents = 'none';
    });
  }

  async function processMessage(msg, index, total) {
    console.log(`[RP-Edit] Processing message ${index + 1}/${total}`);

    try {
      // Scroll to message
      msg.scrollIntoView({ behavior: SCROLL_BEHAVIOR, block: 'center' });
      await wait(CLICK_DELAY);

      // Hide any existing toolbars
      hideExistingToolbars();
      await wait(50);

      // Click the message to select it
      console.log('[RP-Edit] Clicking message to select...');
      fullClick(msg);

      // Also try clicking the content area if it exists
      const contentArea = msg.querySelector('.prose') || msg.querySelector('div');
      if (contentArea && contentArea !== msg) {
        await wait(50);
        fullClick(contentArea);
      }

      await wait(APPEAR_DELAY);

      // Wait for and find the edit button
      console.log('[RP-Edit] Looking for edit button...');
      const btn = await waitForEditButton(MAX_SEARCH_MS);

      if (btn) {
        // Check current state
        const currentState = btn.getAttribute('data-state');
        console.log(`[RP-Edit] Found edit button with state: ${currentState}`);

        // Click the edit button
        console.log('[RP-Edit] Clicking edit button...');
        fullClick(btn);

        // Wait to ensure edit mode opens
        await wait(AFTER_EDIT_DELAY);

        // Check if state changed
        const newState = btn.getAttribute('data-state');
        if (newState !== currentState) {
          console.log(`[RP-Edit] Edit opened (state: ${currentState} → ${newState})`);
          return true;
        } else if (currentState === 'instant-open' || currentState === 'open') {
          console.log('[RP-Edit] Edit was already open');
          return true;
        } else {
          console.log('[RP-Edit] Edit might have opened (state unchanged)');
          return true; // Assume success
        }
      } else {
        console.warn('[RP-Edit] No edit button found for this message');

        // Debug: show what toolbars were found
        const toolbars = findAllToolbars();
        if (toolbars.length === 0) {
          console.warn('[RP-Edit] No toolbars found at all after clicking');
        } else {
          console.log(`[RP-Edit] Found ${toolbars.length} toolbar(s) but no edit button`);
        }

        return false;
      }
    } catch (e) {
      console.error('[RP-Edit] Error processing message:', e);
      return false;
    }
  }

  async function runPass() {
    const messages = Array.from(document.querySelectorAll(MESSAGE_SELECTOR)).filter(isVisible);
    console.log(`[RP-Edit] Found ${messages.length} messages to process`);

    if (messages.length === 0) {
      console.warn('[RP-Edit] No messages found. Check the MESSAGE_SELECTOR');
      return;
    }

    let opened = 0, failed = 0;

    for (let i = 0; i < messages.length; i++) {
      const success = await processMessage(messages[i], i, messages.length);

      if (success) {
        opened++;
      } else {
        failed++;
      }

      // Wait between messages
      await wait(BETWEEN_MESSAGE_DELAY);
    }

    console.log(`[RP-Edit] ✅ Complete! Successfully opened ${opened}/${messages.length} messages`);
    if (failed > 0) {
      console.log(`[RP-Edit] ⚠️ Failed to open edit for ${failed} message(s)`);
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
      console.log(`[RP-Edit] Highlighted ${messages.length} messages`);
    } else {
      console.log('[RP-Edit] Highlighting disabled');
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
      console.log('[RP-Edit] Starting edit pass...');
      runPass();
    }
  });

  console.log('[RP-Edit] Script loaded. Use Ctrl+Alt+E to edit all, Ctrl+Alt+H to highlight.');
})();