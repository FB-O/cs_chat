# The server: Listens for and accepts connections
import datetime
import io
import json 
import logging
import os
import tempfile

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import whisper

whisper_model = whisper.load_model('tiny')

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# FastAPI app
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

audio_buffers = {}


@app.get("/")
async def root():
    return {"message": "Audio Streaming Server is running"}

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    active_connections.add(websocket)
    audio_buffers[websocket] = []
    logger.info(f"New WebSocket connection. Total connections: {len(active_connections)}")
    
    try:
        while True:
            message = await websocket.receive()

            if "bytes" in message:
                audio_data = message["bytes"]
                audio_buffers[websocket].append(audio_data)
                logger.info(f"Buffered audio chunk: {len(audio_data)} bytes")

            elif "text" in message:
                try:
                    msg = json.loads(message["text"])
                    if msg.get("type") == "audio_end":
                        await handle_audio_complete(websocket)
                except json.JSONDecodeError:
                    logger.warning("Received invalid JSON message")

            # # Receive audio data
            # audio_data = await websocket.receive_bytes()
            # logger.info(f"Received audio chunk: {len(audio_data)} bytes")
            
            # # Process the audio data here
            # await process_audio_chunk(audio_data, websocket)
            
    except WebSocketDisconnect:
        logger.info("WebSocket connection closed by client")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
    finally:
        active_connections.discard(websocket)
        if websocket in audio_buffers:
            del audio_buffers[websocket]
        logger.info(f"Connection removed. Total connections: {len(active_connections)}")

async def handle_audio_complete(websocket: WebSocket):
    if websocket not in audio_buffers or not audio_buffers[websocket]:
        logger.warning("No audio chunks to process")
        return
    
    chunks = audio_buffers[websocket]
    complete_audio = b''.join(chunks)
    logger.info(f"Complete audio ready: {len(complete_audio)} bytes from {len(chunks)} chunks.")

    await process_complete_audio(complete_audio, websocket)
    audio_buffers[websocket] = []

async def process_complete_audio(audio_data: bytes, websocket: WebSocket):
    try:
        logger.info(f"Processing complete audio: {len(audio_data)} bytes.")
        filename = datetime.datetime.now()
        filename = str(filename).replace('-', '_').replace(' ', '-').replace(':', '_').split('.')[0]

        # save the audio file for whisper model to transcribe
        # with tempfile.NamedTemporaryFile(delete=False, suffix='.webm') as temp_file:
        with open(os.path.join('../audios', str(filename+'.webm')), 'wb') as temp_file:
            temp_file.write(audio_data)
            # temp_file_path = temp_file.name
        
        # transcribe
        logger.info("Transcribing ...")
        # result = whisper_model.transcribe(temp_file_path)
        result = whisper_model.transcribe(os.path.join('../audios', str(filename+'.webm')))
        transcribed_text = result['text'].strip()
        logger.info(f"Transcribed: {transcribed_text}")

        # # clear up temp file
        # os.unlink(temp_file_path)

        filename = datetime.datetime.now()
        filename = str(filename).replace('-', '_').replace(' ', '-').replace(':', '_')
        with open(os.path.join('../transcriptions', str(filename+'.txt')), 'w') as f:
            f.write(transcribed_text)

        response = {
            'type': 'transcription_response', 
            'text': transcribed_text, 
        }

        # with open(os.path.join('../audios', str(filename+'.webm')), 'wb') as f:
        #     f.write(audio_data)

        # response = {
        #     'type': 'audio_response', 
        #     'message': f'Processed audio of {len(audio_data)} bytes.', 
        # }

        await websocket.send_text(json.dumps(response))

    except Exception as e:
        logger.error(f"Error processing complete audio: {e}")

# async def process_audio_chunk(audio_data: bytes, websocket: WebSocket):
#     """
#     Process incoming audio chunk.
#     Replace this with your actual audio processing logic.
#     """
#     try:
#         # Example: Just log the chunk size
#         logger.info(f"Processing audio chunk of {len(audio_data)} bytes")
        
#         # Example: Send acknowledgment back to client
#         await websocket.send_text(f"Processed {len(audio_data)} bytes")
        
#         # Your audio processing code would go here:
#         # - Convert bytes to audio format
#         # - Apply ML models, filters, etc.
#         # - Store or forward processed data
        
#     except Exception as e:
#         logger.error(f"Error processing audio: {e}")

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
