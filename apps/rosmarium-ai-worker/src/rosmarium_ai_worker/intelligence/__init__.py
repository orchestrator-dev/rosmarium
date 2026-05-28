"""Intelligence package — auto-tagging, NER, summarization, duplicate detection."""

from .duplicate_detector import (
    DuplicateCandidate,
    DuplicateDetector,
    duplicate_detector,
)
from .ner import Entity, NERExtractor, ner_extractor
from .summarizer import ContentSummarizer, SummaryResult, content_summarizer
from .tagger import AutoTagger, TagResult, auto_tagger

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
