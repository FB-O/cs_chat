// The client: Initiates the WebSocket connection

// Global variables
let websocket = null;
let mediaRecorder = null;
let audioStream = null;
let isStreaming = false;

// DOM elements
const streamButton = document.getElementById('streamButton');
const statusDiv = document.getElementById('status');

// Initialize the application
function init() {
    console.log('Initializing audio streaming client...');
    streamButton.addEventListener('click', toggleStreaming);
    connectWebSocket();
}

// WebSocket connection management
function connectWebSocket() {
    console.log('Attempting to connect to WebSocket...');
    websocket = new WebSocket('ws://localhost:8000/ws');
    
    websocket.onopen = function(event) {
        console.log('WebSocket connected successfully');
        updateStatus('Connected', 'connected');
    };
    
    websocket.onmessage = function(event) {
        console.log('Received message from server:', event.data);
    };
    
    websocket.onclose = function(event) {
        console.log('WebSocket connection closed:', event.code, event.reason);
        updateStatus('Disconnected', 'disconnected');
        
        // Attempt reconnection after 3 seconds
        setTimeout(() => {
            if (!isStreaming) {
                console.log('Attempting to reconnect...');
                connectWebSocket();
            }
        }, 3000);
    };
    
    websocket.onerror = function(error) {
        console.error('WebSocket error:', error);
        updateStatus('Connection Error', 'disconnected');
    };
}

// Toggle streaming on/off
async function toggleStreaming() {
    if (!isStreaming) {
        await startStreaming();
    } else {
        stopStreaming();
    }
}

// Start audio capture and streaming
async function startStreaming() {
    console.log('Starting audio streaming...');
    
    if (!websocket || websocket.readyState !== WebSocket.OPEN) {
        console.error('WebSocket not connected');
        alert('Not connected to server. Please wait for connection.');
        return;
    }
    
    try {
        // Get audio stream from microphone
        audioStream = await navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                sampleRate: 44100
            }
        });
        
        console.log('Audio stream obtained successfully');
        
        // Create MediaRecorder
        mediaRecorder = new MediaRecorder(audioStream, {
            mimeType: 'audio/webm; codecs=opus'
        });
        
        // Handle audio data
        mediaRecorder.ondataavailable = function(event) {
            if (event.data.size > 0 && websocket.readyState === WebSocket.OPEN) {
                console.log('Sending audio chunk:', event.data.size, 'bytes');
                websocket.send(event.data);
            }
        };
        
        mediaRecorder.onerror = function(error) {
            console.error('MediaRecorder error:', error);
        };
        
        // Start recording with 100ms chunks
        mediaRecorder.start(100);
        
        isStreaming = true;
        updateButton();
        updateStatus('Streaming...', 'streaming');
        console.log('Audio streaming started');
        
    } catch (error) {
        console.error('Error starting audio stream:', error);
        alert('Failed to access microphone: ' + error.message);
    }
}

// Stop audio capture and streaming
function stopStreaming() {
    console.log('Stopping audio streaming...');
    
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
        console.log('MediaRecorder stopped');
    }
    
    if (audioStream) {
        audioStream.getTracks().forEach(track => {
            track.stop();
            console.log('Audio track stopped');
        });
        audioStream = null;
    }
    
    isStreaming = false;
    updateButton();
    updateStatus('Connected', 'connected');
    console.log('Audio streaming stopped');
}

// Update button appearance and text
function updateButton() {
    if (isStreaming) {
        streamButton.textContent = 'Stop Streaming';
        streamButton.className = 'active';
    } else {
        streamButton.textContent = 'Start Streaming';
        streamButton.className = 'inactive';
    }
}

// Update status display
function updateStatus(message, type) {
    statusDiv.textContent = message;
    statusDiv.className = `status-${type}`;
}

// Start the application when page loads
document.addEventListener('DOMContentLoaded', init);
