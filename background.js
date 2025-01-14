chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'downloadFile') {
      chrome.downloads.download({
        url: request.url,
        filename: request.filename,
        saveAs: true
      }, (downloadId) => {
        if (chrome.runtime.lastError) {
          console.error('Download failed:', chrome.runtime.lastError.message);
          sendResponse({ success: false });
        } else {
          console.log('Download initiated:', downloadId);
          sendResponse({ success: true });
        }
      });
      return true; // Keep the message channel open for async response
    }
  });
  