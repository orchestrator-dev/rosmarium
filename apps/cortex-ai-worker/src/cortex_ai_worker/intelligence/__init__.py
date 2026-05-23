"""Intelligence package — auto-tagging, NER, summarization, duplicate detection."""

from .tagger import AutoTagger, TagResult, auto_tagger
from .ner import Entity, NERExtractor, ner_extractor
from .summarizer import ContentSummarizer, SummaryResult, content_summarizer
from .duplicate_detector import (
    DuplicateCandidate,
    DuplicateDetector,
    duplicate_detector,
)

__all__ = [
    "AutoTagger",
    "ContentSummarizer",
    "DuplicateCandidate",
    "DuplicateDetector",
    "Entity",
    "NERExtractor",
    "SummaryResult",
    "TagResult",
    "auto_tagger",
    "content_summarizer",
    "duplicate_detector",
    "ner_extractor",
]
