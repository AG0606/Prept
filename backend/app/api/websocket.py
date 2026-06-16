from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import asyncio
import json

router = APIRouter()

@router.websocket("/ws/session/{session_id}")
async def session_websocket(websocket: WebSocket, session_id: str):
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_text()
            msg = json.loads(data)
            msg_type = msg.get("type")

            if msg_type == "audio_chunk":
                # STT: faster-whisper processes audio chunk
                text = await transcribe_audio(msg["audio_base64"])
                await websocket.send_json({"type": "transcription", "text": text})

                # Process through interview engine
                engine = get_interview_engine()
                response = await engine.process_audio_answer(session_id, text)

                # TTS: Kokoro generates audio
                audio = await synthesize_speech(response["text"])
                await websocket.send_json({
                    "type": "audio_response",
                    "audio_base64": audio,
                    "text": response["text"],
                    "next_question": response.get("next_question"),
                })

            elif msg_type == "ping":
                await websocket.send_json({"type": "pong"})

    except WebSocketDisconnect:
        print(f"Client disconnected from session {session_id}")
    except Exception as e:
        print(f"WebSocket error: {e}")

async def transcribe_audio(base64_audio: str) -> str:
    from ..services.speech_service import SpeechService
    service = SpeechService()
    return await service.transcribe(base64_audio)

async def synthesize_speech(text: str) -> str:
    from ..services.speech_service import SpeechService
    service = SpeechService()
    return await service.synthesize(text)

def get_interview_engine():
    from ..services.interview_engine import InterviewEngine
    from sqlalchemy.ext.asyncio import AsyncSession
    return InterviewEngine(None)  # Replaced with proper DI in production