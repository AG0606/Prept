from groq import AsyncGroq
from .config import settings
from .llm_provider import LLMProvider

class GroqProvider(LLMProvider):
    def __init__(self):
        self.client = AsyncGroq(api_key=settings.groq_api_key)
        self.model = settings.groq_model

    async def generate(self, prompt: str, system: str = ""):
        response = await self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": prompt},
            ],
        )
        return response.choices[0].message.content

    async def generate_stream(self, prompt: str, system: str = ""):
        stream = await self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": prompt},
            ],
            stream=True,
        )
        async for chunk in stream:
            delta = chunk.choices[0].delta.content
            if delta:
                yield delta

    async def generate_vision(self, prompt: str, image_base64: str, system: str = ""):
        response = await self.client.chat.completions.create(
            model="llama-3.2-90b-vision-preview",
            messages=[
                {"role": "system", "content": system},
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {
                            "type": "image_url",
                            "image_url": {"url": f"data:image/png;base64,{image_base64}"},
                        },
                    ],
                },
            ],
        )
        return response.choices[0].message.content