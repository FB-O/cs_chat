# The server: Listens for and accepts connections

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Audio Streaming Server")

# Enable CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Store active connections
active_connections = set()

@app.get("/")
async def root():
    return {"message": "Audio Streaming Server is running"}

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    active_connections.add(websocket)
    logger.info(f"New WebSocket connection. Total connections: {len(active_connections)}")
    
    try:
        while True:
            # Receive audio data
            audio_data = await websocket.receive_bytes()
            logger.info(f"Received audio chunk: {len(audio_data)} bytes")
            
            # Process the audio data here
            await process_audio_chunk(audio_data, websocket)
            
    except WebSocketDisconnect:
        logger.info("WebSocket connection closed by client")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
    finally:
        active_connections.discard(websocket)
        logger.info(f"Connection removed. Total connections: {len(active_connections)}")

async def process_audio_chunk(audio_data: bytes, websocket: WebSocket):
    """
    Process incoming audio chunk.
    Replace this with your actual audio processing logic.
    """
    try:
        # Example: Just log the chunk size
        logger.info(f"Processing audio chunk of {len(audio_data)} bytes")
        
        # Example: Send acknowledgment back to client
        await websocket.send_text(f"Processed {len(audio_data)} bytes")
        
        # Your audio processing code would go here:
        # - Convert bytes to audio format
        # - Apply ML models, filters, etc.
        # - Store or forward processed data
        
    except Exception as e:
        logger.error(f"Error processing audio: {e}")

@app.get("/status")
async def get_status():
    """Health check endpoint"""
    return {
        "status": "running",
        "active_connections": len(active_connections)
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
