// ==UserScript==
// @name         WebRP: Export Chat to Markdown (via Edit)
// @namespace    https://github.com/Krrrrrrk
// @version      5.0
// @description  Ctrl+Alt+E: Click each message -> click pencil edit -> read textarea -> Cancel -> copy all to clipboard.
// @match        https://ourdream.ai/*
// @run-at       document-idle
// @grant        GM_setClipboard
// @grant        GM.setClipboard
// ==/UserScript==

(function () {
  'use strict';

  // --- Selectors based on your provided HTML ---
  // Messages are the containers with data-role="assistant" or data-role="user"
  const MESSAGE_CONTAINER_SELECTOR = 'div.group\\/message[data-role]';

  // Pencil SVG path (the edit icon)
  const PENCIL_SVG_PATH = 'M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z';

  // The edit UI uses a textarea inside the MessageEdit component (from your snippet)
  const EDIT_TEXTAREA_SELECTOR = 'div[data-sentry-component="MessageEdit"] textarea, textarea';

  // Buttons inside edit mode
  const CANCEL_TEXT = 'Cancel';

  // Timing / retries
  const SCROLL_BEHAVIOR = 'instant';
  const CLICK_DELAY_MS = 60;
  const TOOLBAR_WAIT_MS = 1500;
  const TEXTAREA_WAIT_MS = 2000;
  const BETWEEN_MESSAGES_MS = 120;

  // Output formatting
  const DEFAULT_USER_LABEL = '[You]';
  let aiLabel = '[AI]';
  const userLabel = DEFAULT_USER_LABEL;

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  const isVisible = (el) => {
    if (!el) return false;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return false;
    const r = el.getBoundingClientRect();
    return (r.width > 0 && r.height > 0);
  };

  const fullClick = (el) => {
    if (!el) return;
    const o = { bubbles: true, cancelable: true, composed: true };
    try {
      el.dispatchEvent(new PointerEvent('pointerdown', o));
      el.dispatchEvent(new PointerEvent('pointerup', o));
      el.dispatchEvent(new MouseEvent('click', o));
    } catch {
      try { el.click(); } catch {}
    }
  };

  function roleToLabel(role) {
    if (role === 'assistant') return aiLabel;
    if (role === 'user') return userLabel;
    return '[Unknown]';
  }

  function findEditButtonWithin(messageContainer) {
    // When a message is selected, a small toolbar appears above it.
    // We scope search to THIS message container to avoid grabbing the wrong pencil elsewhere.
    const buttons = messageContainer.querySelectorAll('button');
    for (const btn of buttons) {
      const svg = btn.querySelector('svg');
      const html = svg?.outerHTML || btn.outerHTML || '';
      if (html.includes(PENCIL_SVG_PATH) || html.includes('M17 3a2.828')) {
        return btn;
      }
    }

    // Fallback: search near the message container for an "absolute -top-12" toolbar region
    const possibleToolbars = messageContainer.querySelectorAll('div.absolute button, div.absolute.-top-12 button');
    for (const btn of possibleToolbars) {
      const html = btn.outerHTML || '';
      if (html.includes(PENCIL_SVG_PATH) || html.includes('M17 3a2.828')) return btn;
    }

    return null;
  }

  async function waitFor(fn, timeoutMs, intervalMs = 50) {
    const t0 = performance.now();
    while (performance.now() - t0 < timeoutMs) {
      const val = fn();
      if (val) return val;
      await wait(intervalMs);
    }
    return null;
  }

  function closeAnyOpenEditMode() {
    // If an edit UI is open, there will be a visible Cancel button. Click it.
    const allButtons = Array.from(document.querySelectorAll('button'));
    const cancel = allButtons.find(b => isVisible(b) && (b.textContent || '').trim() === CANCEL_TEXT);
    if (cancel) fullClick(cancel);
  }

  async function getTextareaValue(timeoutMs) {
    // We want the currently-visible textarea with content
    return await waitFor(() => {
      const candidates = Array.from(document.querySelectorAll(EDIT_TEXTAREA_SELECTOR))
        .filter(isVisible)
        .filter(ta => (ta.value || '').trim().length > 0);
      return candidates[0] || null;
    }, timeoutMs);
  }

  function formatCollected(collected) {
    let out = '';
    for (const m of collected) {
      out += '\n' + '─'.repeat(50) + '\n';
      out += `${m.label}\n${m.text}\n`;
    }
    out += '\n' + '═'.repeat(50) + '\n';
    out += `\nExtracted ${collected.length} messages\n`;
    return out;
  }

  function copyToClipboard(text) {
    // 1) GM_setClipboard
    if (typeof GM_setClipboard !== 'undefined') {
      GM_setClipboard(text);
      return true;
    }
    // 2) GM.setClipboard
    if (typeof GM !== 'undefined' && typeof GM.setClipboard === 'function') {
      GM.setClipboard(text);
      return true;
    }
    // 3) Clipboard API
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).catch(() => {});
      return true;
    }
    // 4) Fallback
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      return true;
    } catch {
      return false;
    }
  }

  async function processMessage(messageContainer, index, total) {
    const role = messageContainer.getAttribute('data-role') || 'unknown';

    // Ensure we start clean
    closeAnyOpenEditMode();
    await wait(80);

    // Scroll & click message bubble (there is usually a <button type="button"> wrapping the bubble)
    messageContainer.scrollIntoView({ behavior: SCROLL_BEHAVIOR, block: 'center' });
    await wait(CLICK_DELAY_MS);

    // Click the bubble button if present; otherwise click container
    const bubbleButton = messageContainer.querySelector('button[type="button"]') || messageContainer;
    fullClick(bubbleButton);
    await wait(CLICK_DELAY_MS);

    // Wait for the pencil edit button (scoped to this message)
    const editBtn = await waitFor(() => {
      const btn = findEditButtonWithin(messageContainer);
      return (btn && isVisible(btn)) ? btn : null;
    }, TOOLBAR_WAIT_MS);

    if (!editBtn) {
      console.warn(`[WebRP Export] No edit button found for message ${index + 1}/${total}`);
      return null;
    }

    // Click pencil
    fullClick(editBtn);
    await wait(80);

    // Wait for textarea to appear and grab its value
    const textarea = await getTextareaValue(TEXTAREA_WAIT_MS);
    if (!textarea) {
      console.warn(`[WebRP Export] No textarea found for message ${index + 1}/${total}`);
      closeAnyOpenEditMode();
      return null;
    }

    const text = textarea.value;

    // Close edit mode (Cancel)
    closeAnyOpenEditMode();
    await wait(80);

    return { role, label: roleToLabel(role), text };
  }

  async function runExport() {
    // Prompt for AI label
    const aiName = prompt('Enter the AI character name (leave blank for "AI"):', '');
    if (aiName !== null && aiName.trim()) {
      aiLabel = `[${aiName.trim()}]`;
    }

    const messageNodes = Array.from(document.querySelectorAll(MESSAGE_CONTAINER_SELECTOR))
      .filter(isVisible);

    if (!messageNodes.length) {
      alert('No messages found. Are you on the chat page?');
      return;
    }

    const collected = [];
    let failed = 0;

    for (let i = 0; i < messageNodes.length; i++) {
      const result = await processMessage(messageNodes[i], i, messageNodes.length);
      if (result) collected.push(result);
      else failed++;

      await wait(BETWEEN_MESSAGES_MS);
    }

    const formatted = formatCollected(collected);
    const ok = copyToClipboard(formatted);

    const userCount = collected.filter(m => m.role === 'user').length;
    const aiCount = collected.filter(m => m.role === 'assistant').length;

    if (ok) {
      alert(
        `✅ Copied ${collected.length} messages to clipboard!\n\n` +
        `${userCount} from ${userLabel}\n` +
        `${aiCount} from ${aiLabel}\n\n` +
        (failed ? `⚠️ Failed on ${failed} message(s). Check console.` : '')
      );
    } else {
      console.warn('[WebRP Export] Clipboard copy failed. Dumping output to console.');
      console.log(formatted);
      alert('Extraction finished, but clipboard copy failed. Open DevTools Console for the output.');
    }
  }

  // Hotkey: Ctrl+Alt+E
  window.addEventListener('keydown', (e) => {
    if (!e.ctrlKey || !e.altKey) return;
    const k = (e.key || '').toLowerCase();
    if (k === 'e') {
      e.preventDefault();
      console.log('[WebRP Export] Starting export...');
      runExport();
    }
  });

  console.log('[WebRP Export] Loaded. Press Ctrl+Alt+E to export.');
})();
