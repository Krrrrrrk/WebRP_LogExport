# RP Chat Extractor for OurDream.ai

A Tampermonkey userscript that extracts and copies all messages from RP chat sessions on OurDream.ai, preserving markdown formatting and clearly labeling who said what.

## ⚠️ Support Notice

**I do not provide support for Tampermonkey installation or usage.** This script assumes you already know how to use Tampermonkey or can figure it out on your own. For Tampermonkey help, please refer to [Tampermonkey's documentation](https://www.tampermonkey.net/documentation.php) or online tutorials.

## Features

- 📝 **Extracts all messages** from your RP chat session
- 🏷️ **Custom character names** - name the AI character (e.g., [Maddie] instead of [AI])
- 📋 **Automatic clipboard copy** - no manual copying needed
- ✨ **Preserves markdown formatting** - keeps all *italics*, **bold**, and other formatting
- 🎯 **Visual highlighting** - preview which messages will be extracted
- ⚡ **Keyboard shortcuts** for quick access

## Installation

### Step 1: Install Tampermonkey

1. Install the Tampermonkey browser extension:
   - [Chrome/Edge/Brave](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo)
   - [Firefox](https://addons.mozilla.org/en-US/firefox/addon/tampermonkey/)
   - [Safari](https://apps.apple.com/us/app/tampermonkey/id1482490089)

### Step 2: Install the Script

1. Click the Tampermonkey icon in your browser toolbar
2. Select "Create a new script..."
3. Delete any default code that appears
4. Copy and paste the entire script code from `rp-chat-extractor.user.js`
5. Press `Ctrl+S` (or `Cmd+S` on Mac) to save
6. The script will automatically activate on OurDream.ai

## Usage

### ⚠️ IMPORTANT: Before Extracting

**Always scroll to the top of your chat first!** 
- The script only processes messages that are currently loaded on the page
- OurDream.ai uses lazy loading, so older messages might not be visible
- Scroll all the way up to ensure all messages are loaded before extraction

### Extracting Messages

1. **Navigate to your RP chat** on OurDream.ai
2. **Scroll to the top** of the conversation to load all messages
3. **Press `Ctrl+Alt+E`** to start extraction
4. **Enter character name** when prompted (e.g., "Maddie" or "Susan") or leave blank for default "[AI]"
5. **Wait for completion** - keep the tab active (see notes below)
6. **Check the alert** - it will confirm how many messages were extracted
7. **Paste anywhere** - your clipboard now contains all formatted messages!

### Keyboard Shortcuts

- **`Ctrl+Alt+E`** - Extract all messages and copy to clipboard
- **`Ctrl+Alt+H`** - Highlight/unhighlight messages (preview mode)

## Output Format

The extracted text will look like this (with custom character name):

```
──────────────────────────────────────────────────
[Officer Bosch]
*She walks up to your window with a notepad.* Officer Bosch, LAPD. License and registration please!

──────────────────────────────────────────────────
[You]
*I hand over my documents nervously.* Here you go, officer. Was I speeding?

──────────────────────────────────────────────────
[Officer Bosch]
*She examines your license carefully.* You ran a stop sign back there...
```

Or with default labels if you don't enter a custom name:

```
──────────────────────────────────────────────────
[AI]
*She walks up to your window...*

──────────────────────────────────────────────────
[You]
*I hand over my documents...*
```

## Important Notes

### Keep the Tab Active
- ⚠️ **Don't switch tabs** while the script is running
- ⚠️ **Don't switch to other applications** 
- ✅ You CAN minimize the entire browser window
- ✅ You CAN resize the browser to a corner
- The extraction typically takes 10-30 seconds depending on message count

### Browser Compatibility
- **Tested and confirmed working on Chrome**
- Should work on Edge, Brave, and Firefox (but untested)
- Requires Tampermonkey extension
- JavaScript must be enabled
- Pop-ups should be allowed for clipboard access alerts

⚠️ **Note:** This script has only been thoroughly tested on Chrome. While it should work on other browsers with Tampermonkey support, your mileage may vary.

## Troubleshooting

### Messages aren't being extracted
- Make sure you've scrolled to the top to load all messages
- Check that the tab is active and visible
- Look at the browser console (`F12`) for error messages
- Verify Tampermonkey is enabled

### Some messages are missing
- The site might be using pagination - scroll up further
- Wait a moment after scrolling for messages to fully load
- Try refreshing the page and scrolling up again

### Clipboard isn't working
- Grant clipboard permissions if prompted
- Try using a different browser
- Check if other extensions are blocking clipboard access
- The extracted text is also logged to console as a fallback

### Script isn't activating
- Verify you're on `https://ourdream.ai/*`
- Check Tampermonkey dashboard to ensure script is enabled
- Try refreshing the page
- Make sure no other userscripts are conflicting

## How It Works

1. **Finds all visible messages** in the chat
2. **Clicks each message** to select it
3. **Clicks the edit button** to open markdown view
4. **Extracts the markdown text** from the textarea
5. **Identifies the sender** using `data-role` attributes
6. **Closes edit mode** and moves to the next message
7. **Formats everything** with labels and separators
8. **Copies to clipboard** automatically

## Privacy & Security

- **This script runs entirely in your browser**
- **NO impact on OurDream.ai servers** - only processes data already loaded on your machine
- **No additional server requests** - works entirely with existing page content
- **No data is sent anywhere** - everything stays local
- **Only accesses content you can already see** - doesn't bypass any restrictions
- **Clipboard data stays on your device** - no external transmission

## License

This script is provided as-is for personal use. Feel free to modify and share!

## Contributing

Found a bug or want to add a feature? Feel free to:
- Open an issue describing the problem or suggestion
- Fork and submit a pull request with improvements
- Share feedback on what's working or what could be better

## Changelog

### Version 2.1
- Added custom character name prompt
- Can now rename [AI] to any character name (e.g., [Maddie], [Susan], [Officer Bosch])
- Cancel prompt to abort extraction

### Version 2.0
- Added automatic text extraction from edit mode
- Implemented role detection ([AI] vs [You])
- Added clipboard copy functionality
- Improved textarea detection to avoid duplicates
- Enhanced error handling and logging

### Version 1.0
- Initial release with edit mode opening
- Basic message selection and navigation
- Highlight preview feature

---

**Note:** This script is not affiliated with OurDream.ai. Use at your own discretion and respect the platform's terms of service.
