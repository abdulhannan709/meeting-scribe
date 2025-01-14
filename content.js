class MeetingTranscriber {
    constructor() {
      this.isRecording = false;
      this.mediaRecorder = null;
      this.audioContext = null;
      this.transcript = [];
      this.recognition = null;
      this.currentSpeaker = 'Speaker 1';
      this.setupMessageListener();
      console.log('MeetingTranscriber initialized');
    }
  
    setupMessageListener() {
      chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        console.log('Received message:', request.action);
        switch (request.action) {
          case 'startRecording':
            this.startRecording()
              .then(() => sendResponse({ success: true }))
              .catch(error => {
                console.error('Start recording failed:', error);
                sendResponse({ success: false, error: error.message });
              });
            break;
          case 'stopRecording':
            this.stopRecording()
              .then(() => sendResponse({ success: true }))
              .catch(error => {
                console.error('Stop recording failed:', error);
                sendResponse({ success: false, error: error.message });
              });
            break;
          case 'getStatus':
            sendResponse({ isRecording: this.isRecording });
            break;
        }
        return true;
      });
    }
  
    async startRecording() {
      if (this.isRecording) {
        console.log('Recording already in progress');
        return;
      }
  
      try {
        console.log('Requesting microphone permission...');
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        this.recognition = new webkitSpeechRecognition();
        this.setupSpeechRecognition();
        
        this.audioContext = new AudioContext();
        const source = this.audioContext.createMediaStreamSource(stream);
        const analyzer = this.audioContext.createAnalyser();
        source.connect(analyzer);
        
        this.isRecording = true;
        this.recognition.start();
        
        console.log('Recording started successfully');
      } catch (error) {
        console.error('Error starting recording:', error);
        this.handleError('Failed to start recording: ' + error.message);
        throw error;
      }
    }
  
    setupSpeechRecognition() {
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = 'en-US';
  
      this.recognition.onresult = (event) => {
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            console.log('New transcript entry:', transcript);
            this.addToTranscript(transcript);
          }
        }
      };
  
      this.recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        this.handleError('Speech recognition error: ' + event.error);
      };
  
      this.recognition.onend = () => {
        if (this.isRecording) {
          console.log('Restarting speech recognition...');
          this.recognition.start();
        } else {
          console.log('Speech recognition ended (not restarting)');
        }
      };
    }
  
    async addToTranscript(text) {
      const entry = {
        timestamp: new Date().toISOString(),
        speaker: this.currentSpeaker,
        text: text
      };
      
      this.transcript.push(entry);
      await this.saveTranscript();
    }
  
    async saveTranscript() {
      try {
        await chrome.storage.local.set({ currentTranscript: this.transcript });
        console.log('Transcript saved, current length:', this.transcript.length);
      } catch (error) {
        console.error('Error saving transcript:', error);
        throw error;
      }
    }
  
    async stopRecording() {
      if (!this.isRecording) {
        console.log('No recording in progress');
        return;
      }
  
      console.log('Stopping recording...');
      
      try {
        // Create a promise that resolves when the recognition actually stops
        const finalTranscriptPromise = new Promise((resolve) => {
          if (this.recognition) {
            // Add one-time listener for the final end event
            this.recognition.onend = () => {
              console.log('Speech recognition ended');
              resolve();
            };
            
            // Stop the recognition
            this.recognition.stop();
          } else {
            resolve();
          }
        });
        
        // Wait a short moment for any final transcripts to be processed
        await finalTranscriptPromise;
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Now safe to cleanup
        this.isRecording = false;
        
        if (this.audioContext) {
          await this.audioContext.close();
        }

        console.log('Final transcript length before generating file:', this.transcript.length);
        await this.generateTranscriptFile();
        
      } catch (error) {
        console.error('Error in stopRecording:', error);
        this.handleError('Failed to stop recording: ' + error.message);
        throw error;
      }
    }
  
    async generateTranscriptFile() {
      try {
        if (!this.transcript || this.transcript.length === 0) {
          console.warn('Transcript is empty, nothing to download.');
          return;
        }

        console.log('Generating transcript file with entries:', this.transcript.length);
        
        let content = '# Meeting Transcript\n\n';
        content += `Date: ${new Date().toLocaleDateString()}\n\n`;
      
        this.transcript.forEach(entry => {
          content += `[${new Date(entry.timestamp).toLocaleTimeString()}] ${entry.speaker}:\n${entry.text}\n\n`;
        });
      
        const blob = new Blob([content], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const filename = `meeting-transcript-${new Date().toISOString().slice(0, 10)}.md`;
      
        // Send download request and wait for response
        const response = await new Promise((resolve) => {
          chrome.runtime.sendMessage({
            action: 'downloadFile',
            url: url,
            filename: filename
          }, resolve);
        });

        URL.revokeObjectURL(url);

        if (response?.success) {
          console.log('Download successful, clearing transcript data');
          await this.clearTranscriptData();
        } else {
          throw new Error('Download failed');
        }
      } catch (error) {
        console.error('Error generating transcript file:', error);
        this.handleError('Failed to generate transcript: ' + error.message);
        throw error;
      }
    }

    async clearTranscriptData() {
      try {
        this.transcript = [];
        await chrome.storage.local.remove('currentTranscript');
        console.log('Transcript data cleared successfully');
      } catch (error) {
        console.error('Error clearing transcript data:', error);
        throw error;
      }
    }
  
    handleError(message) {
      console.error('Error:', message);
      chrome.runtime.sendMessage({
        type: 'error',
        message: message
      });
    }
}
  
// Initialize transcriber when content script loads
const transcriber = new MeetingTranscriber();
  