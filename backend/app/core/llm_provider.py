from abc import ABC, abstractmethod
from typing import AsyncIterator

class LLMProvider(ABC):
    @abstractmethod
    async def generate(self, prompt: str, system: str = "") -> str:
        pass

    @abstractmethod
    async def generate_stream(self, prompt: str, system: str = "") -> AsyncIterator[str]:
        pass

    @abstractmethod
    async def generate_vision(self, prompt: str, image_base64: str, system: str = "") -> str:
        pass