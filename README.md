# WebRP_LogExport
Allows exporting of chat logs to Markdown format via Tampermonkey.

**Main Features:**

Ctrl+Alt+E - Automatically clicks each message and opens its edit mode (showing the markdown)
Ctrl+Alt+H - Highlights all messages with a green outline (useful to see what will be processed/debugging stuff probably won't need to use this)

**What the script does:**

Finds all visible messages in the chat
Clicks each message to select it (makes the toolbar bubble appear)
Clicks the pencil/edit button in the toolbar
Moves to the next message
All messages end up in edit mode showing their markdown formatting

Now you can easily copy the markdown from all messages! The console will show the progress as it processes each message, and you'll see a summary at the end showing how many were successfully opened.

Once everything is opened, ctrl A and copy/paste to your preferred markdown editor. It'll grab some garbage but its easy enough to clean up.

If you ever need to adjust the timing (if it's going too fast or slow), you can modify these values at the top of the script:

APPEAR_DELAY - How long to wait for the toolbar to appear (currently 500ms)
BETWEEN_MESSAGE_DELAY - Pause between processing messages (currently 200ms)
