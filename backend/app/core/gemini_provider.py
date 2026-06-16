from google import genai
from google.genai import types
from .config import settings
from .llm_provider import LLMProvider

class GeminiProvider(LLMProvider):
    def __init__(self):
        self.client = genai.Client(api_key=settings.gemini_api_key)
        self.model = settings.gemini_model

    async def generate(self, prompt: str, system: str = "") -> str:
        response = self.client.models.generate_content(
            model=self.model,
            contents=prompt,
            config=types.GenerateContentConfig(system_instruction=system),
        )
        return response.text

    async def generate_stream(self, prompt: str, system: str = ""):
        response = self.client.models.generate_content_stream(
            model=self.model,
            contents=prompt,
            config=types.GenerateContentConfig(system_instruction=system),
        )
        for chunk in response:
            if chunk.text:
                yield chunk.text

    async def generate_vision(self, prompt: str, image_base64: str, system: str = ""):
        response = self.client.models.generate_content(
            model=self.model,
            contents=[
                prompt,
                types.Part.from_bytes(data=image_base64.encode(), mime_type="image/png"),
            ],
            config=types.GenerateContentConfig(system_instruction=system),
        )
        return response.text