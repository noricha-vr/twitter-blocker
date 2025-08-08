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

            // Try to reuse an existing tab for this URL to avoid tab clutter
            chrome.storage.local.get(['redirectTabMap'], (mapResult) => {
              const redirectTabMap = mapResult.redirectTabMap || {};
              const existingTabId = redirectTabMap[redirectURL];

              if (existingTabId !== undefined) {
                chrome.tabs.get(existingTabId, (existingTab) => {
                  if (chrome.runtime.lastError || !existingTab) {
                    // The stored tab no longer exists; create a new one
                    chrome.tabs.create({ url: redirectURL }, (tab) => {
                      if (chrome.runtime.lastError) {
                        console.error('Error creating tab:', chrome.runtime.lastError);
                        sendResponse({ success: false, error: chrome.runtime.lastError.message });
                      } else {
                        redirectTabMap[redirectURL] = tab.id;
                        chrome.storage.local.set({ redirectTabMap }, () => {
                          console.log('Redirect tab created:', tab.id);
                          sendResponse({ success: true, reused: false, tabId: tab.id });
                        });
                      }
                    });
                  } else {
                    // Reuse existing tab: activate and focus its window
                    chrome.windows.update(existingTab.windowId, { focused: true }, () => {
                      chrome.tabs.update(existingTab.id, { active: true }, () => {
                        if (chrome.runtime.lastError) {
                          console.error('Error focusing existing tab:', chrome.runtime.lastError);
                          sendResponse({ success: false, error: chrome.runtime.lastError.message });
                        } else {
                          sendResponse({ success: true, reused: true, tabId: existingTab.id });
                        }
                      });
                    });
                  }
                });
              } else {
                // No stored tab; create a new one and remember it
                chrome.tabs.create({ url: redirectURL }, (tab) => {
                  if (chrome.runtime.lastError) {
                    console.error('Error creating tab:', chrome.runtime.lastError);
                    sendResponse({ success: false, error: chrome.runtime.lastError.message });
                  } else {
                    redirectTabMap[redirectURL] = tab.id;
                    chrome.storage.local.set({ redirectTabMap }, () => {
                      console.log('Redirect tab created:', tab.id);
                      sendResponse({ success: true, reused: false, tabId: tab.id });
                    });
                  }
                });
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

// Cleanup mapping when a stored redirect tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  chrome.storage.local.get(['redirectTabMap'], (mapResult) => {
    const redirectTabMap = mapResult.redirectTabMap || {};
    let changed = false;
    for (const [url, storedId] of Object.entries(redirectTabMap)) {
      if (storedId === tabId) {
        delete redirectTabMap[url];
        changed = true;
      }
    }
    if (changed) {
      chrome.storage.local.set({ redirectTabMap });
    }
  });
});