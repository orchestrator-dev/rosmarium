"""Abstract base classes for chunking strategies."""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field


@dataclass
class Chunk:
    """A single text chunk with position and metadata."""

    text: str
    chunk_index: int
    char_start: int
    char_end: int
    metadata: dict = field(default_factory=dict)  # type: ignore[type-arg]


class ChunkingStrategy(ABC):
    """Abstract base for all chunking implementations."""

    @abstractmethod
    def chunk(self, text: str, metadata: dict | None = None) -> list[Chunk]:  # type: ignore[type-arg]
        """Split *text* into a list of Chunk objects.

        Args:
            text: The raw text to chunk.
            metadata: Optional dict merged into every chunk's metadata.

        Returns:
            Ordered list of Chunk objects; empty list for empty input.
        """
        ...
