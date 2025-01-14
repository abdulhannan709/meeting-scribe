let isRecording = false;

document.getElementById('startBtn').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  if (tab) {
    try {
      await chrome.tabs.sendMessage(tab.id, { action: 'startRecording' });
      updateUI(true);
    } catch (error) {
      console.error('Error starting recording:', error);
      document.getElementById('status').textContent = 'Error: Could not start recording';
    }
  }
});

document.getElementById('stopBtn').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  if (tab) {
    try {
      await chrome.tabs.sendMessage(tab.id, { action: 'stopRecording' });
      updateUI(false);
    } catch (error) {
      console.error('Error stopping recording:', error);
      document.getElementById('status').textContent = 'Error: Could not stop recording';
    }
  }
});

function updateUI(recording) {
  isRecording = recording;
  document.getElementById('startBtn').disabled = recording;
  document.getElementById('stopBtn').disabled = !recording;
  
  const status = document.getElementById('status');
  status.textContent = recording ? 'Recording in progress...' : 'Ready to record';
  status.className = `status ${recording ? 'recording' : 'ready'}`;
}

// Check recording status when popup opens
chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
  if (tabs[0]) {
    try {
      const response = await chrome.tabs.sendMessage(tabs[0].id, { action: 'getStatus' });
      updateUI(response.isRecording);
    } catch (error) {
      console.log('No recording in progress');
    }
  }
});