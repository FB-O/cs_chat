// The client: Initiates the WebSocket connection

// Global variables
let websocket = null;
let mediaRecorder = null;
let audioStream = null;
let isStreaming = false;

// VAD-specific variables
let vadModel = null;
let vadAudioContext = null;
let vadAnalyser = null;
let vadProcessor = null;
let vadEnabled = false;

// DOM elements
const statusDiv = document.getElementById('status');

// Initialize the application
function init() {
    console.log('Initializing audio streaming client...');
    connectWebSocket();
    initVAD();
}

// Initialize VAD
async function initVAD() {
    try {
        console.log('Initializing Silero VAD...');
        
        // Wait for vad global to be available
        if (typeof vad === 'undefined') {
            console.error('VAD library not loaded');
            updateStatus('VAD Library Error', 'disconnected');
            return;
        }
        
        vadModel = await vad.MicVAD.new({
            onSpeechStart: () => {
                console.log('Speech detected - starting stream');
                if (!isStreaming) {
                    startStreaming();
                }
            },
            onSpeechEnd: (audio) => {
                console.log('Speech ended - stopping stream');
                if (isStreaming) {
                    stopStreaming();
                }
            }
        });
        
        console.log('VAD model loaded successfully');
        updateStatus('VAD Ready - Auto-detecting speech...', 'connected');
        startVAD();
        
    } catch (error) {
        console.error('Error initializing VAD:', error);
        updateStatus('VAD Error', 'disconnected');
    }
}

// Start VAD monitoring
async function startVAD() {
    if (!vadModel) {
        console.error('VAD model not loaded');
        return;
    }
    
    try {
        console.log('Starting VAD monitoring...');
        await vadModel.start();
        vadEnabled = true;
        updateStatus('Listening for speech...', 'vad-active');
        
    } catch (error) {
        console.error('Error starting VAD:', error);
        updateStatus('VAD Start Error', 'disconnected');
    }
}

// Stop VAD monitoring
function stopVAD() {
    if (vadModel) {
        console.log('Stopping VAD monitoring...');
        vadModel.pause();
        vadEnabled = false;
        
        // Stop any active streaming
        if (isStreaming) {
            stopStreaming();
        }
        
        updateVADButton();
        updateStatus('VAD Stopped', 'connected');
    }
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
        // Get audio stream from microphone (only if we don't have one)
        if (!audioStream) {
            audioStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    sampleRate: 44100
                }
            });
        }
        
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
        updateStatus('Streaming (VAD Active)...', 'streaming');
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
    
    // Don't stop audioStream if VAD is active (it needs continuous access)
    if (!vadEnabled && audioStream) {
        audioStream.getTracks().forEach(track => {
            track.stop();
            console.log('Audio track stopped');
        });
        audioStream = null;
    }
    
    isStreaming = false;
    updateStatus('Listening for speech...', 'vad-active');
    console.log('Audio streaming stopped');
}

// Update status display
function updateStatus(message, type) {
    statusDiv.textContent = message;
    statusDiv.className = `status-${type}`;
    
    // Update activity circle
    const circle = document.getElementById('activity-circle');
    circle.className = '';
    
    if (type === 'vad-active' || type === 'connected') {
        circle.className = 'listening';
    } else if (type === 'streaming') {
        circle.className = 'streaming';
    }
}

// Start the application when page loads
document.addEventListener('DOMContentLoaded', init);
