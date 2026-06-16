import base64
import os
import io
import wave
import numpy as np

class SpeechService:
    def __init__(self):
        pass

    async def transcribe(self, audio_base64: str) -> str:
        return "This is a transcribed answer from the candidate."

    async def synthesize(self, text: str) -> str:
        return ""\n