// Background Service Worker for Twitter Blocker

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'openRedirectURL') {
    const senderTab = sender.tab;

    // If we cannot determine the sender tab, skip opening
    if (!senderTab) {
      sendResponse({ success: true, message: 'No sender tab; skipping redirect' });
      return; // synchronous response
    }

    // Only proceed if the sender tab is the active tab in its window
    if (!senderTab.active) {
      sendResponse({ success: true, message: 'Sender tab not active; skipping redirect' });
      return; // synchronous response
    }

    // Ensure the sender tab is also the active tab of the last-focused window
    chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
      if (chrome.runtime.lastError) {
        console.error('Error querying tabs:', chrome.runtime.lastError);
        sendResponse({ success: false, error: chrome.runtime.lastError.message });
        return;
      }

      const activeTabInFocusedWindow = tabs && tabs[0];
      if (!activeTabInFocusedWindow || activeTabInFocusedWindow.id !== senderTab.id) {
        sendResponse({ success: true, message: 'Sender tab not in focused window; skipping redirect' });
        return;
      }

      // Get the redirect URL from storage
      chrome.storage.sync.get(['redirectURL'], (result) => {
        const redirectURL = result.redirectURL;

        if (redirectURL && redirectURL.trim() !== '') {
          // Validate URL
          try {
            // Throws if invalid
            new URL(redirectURL);

            // Create a new tab with the redirect URL
            chrome.tabs.create({ url: redirectURL }, (tab) => {
              if (chrome.runtime.lastError) {
                console.error('Error creating tab:', chrome.runtime.lastError);
                sendResponse({ success: false, error: chrome.runtime.lastError.message });
              } else {
                console.log('Redirect tab created:', tab.id);
                sendResponse({ success: true });
              }
            });
          } catch (error) {
            console.error('Invalid URL:', redirectURL);
            sendResponse({ success: false, error: 'Invalid URL format' });
          }
        } else {
          // No redirect URL set, just respond
          sendResponse({ success: true, message: 'No redirect URL configured' });
        }
      });
    });

    // Return true to indicate that we will send a response asynchronously
    return true;
  }
});

// Log when the service worker is installed
chrome.runtime.onInstalled.addListener(() => {
  console.log('Twitter Blocker service worker installed');
});