# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Twitter Blocker is a Chrome extension (Manifest V3) that blocks access to Twitter/X.com by default and allows temporary unblocking through a user-specified timer. The extension tracks usage history and displays it as a chart on the blocking overlay.

## Architecture

### Core Components

1. **Content Script (contentScript.js)**
   - Manages the blocking overlay that covers Twitter/X.com pages
   - Updates blocking state every 10 seconds
   - Displays usage history chart on the overlay
   - Responds to messages from popup to update overlay state
   - Sends message to background worker when block is activated for redirect

2. **Popup (popup.html/popup.js)**
   - Provides UI for setting temporary unblock duration
   - Saves usage history with user's local timezone
   - Stores default unblock duration for convenience
   - Sends messages to content script to update overlay
   - Allows setting redirect URL with validation

3. **Options Page (options.html/options.js)**
   - Currently stores start/end time settings (feature appears incomplete)
   - Located at chrome-extension://[id]/options.html

4. **Background Service Worker (background.js)**
   - Handles redirect URL functionality
   - Opens new tab with configured URL when Twitter is blocked
   - Validates URLs before opening

### Data Storage

Uses Chrome Storage Sync API for:
- `unblockUntil`: Timestamp when blocking should resume
- `defaultMinutes`: Last used unblock duration
- `usageHistory`: Object mapping dates (YYYY-MM-DD) to minutes used
- `startTime`/`endTime`: Time-based blocking settings (incomplete feature)
- `redirectURL`: URL to open when Twitter is blocked

### Key Implementation Details

- Uses `sv-SE` locale for date formatting (YYYY-MM-DD format)
- History is kept for 30 days with automatic cleanup
- Chart displays usage for last 30 days with bar visualization
- Overlay has highest z-index (999999) to ensure visibility
- Checks blocking state every 10 seconds

## Commands

### Building and Packaging
```bash
# Create deployment package (excludes git files, store assets, knowledge folder)
zip -r twitter-blocker.zip . -x "*.git*" -x "store-assets/*" -x "twitter-blocker.zip" -x "*.DS_Store" -x "knowledge/*" -x "icon/twitter-blocker.png" -x "icon/icon.png"
```

### Testing
```bash
# No automated tests currently - manual testing required
# 1. Load unpacked extension in Chrome
# 2. Navigate to twitter.com or x.com
# 3. Verify overlay appears
# 4. Test unblock functionality via popup
# 5. Wait for timer expiration and verify re-blocking
# 6. Test redirect URL functionality:
#    - Set a redirect URL in popup
#    - Wait for block to activate
#    - Verify new tab opens with configured URL
```

### Development
```bash
# Load unpacked extension:
# 1. Open chrome://extensions
# 2. Enable Developer mode
# 3. Click "Load unpacked"
# 4. Select project directory

# Reload extension after changes:
# Click reload button in chrome://extensions
```

## Chrome Web Store Deployment
- Deploy at: https://chrome.google.com/webstore/devconsole/
- Use generated zip file from build command
- Store assets are in `store-assets/` directory

## Important Notes

1. **Manifest V3 Constraints**
   - No persistent background pages
   - Content scripts run in isolated context
   - Limited access to Chrome APIs from content scripts

2. **Permissions**
   - `storage`: For saving settings and usage history
   - `tabs`: For creating new tabs with redirect URL
   - Host permissions for `*://x.com/*` and `*://twitter.com/*`

3. **Future Considerations**
   - Options page has time-based blocking UI but no implementation
   - Usage statistics could be enhanced with more detailed analytics
   - Consider implementing service worker for advanced features

4. **Localization**
   - All user-facing text is in Japanese
   - Date formatting uses Swedish locale for ISO format
   - Consider i18n support for broader audience