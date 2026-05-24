"""Unit tests for reference_inference._extract_slugs (pure, no DB required).
Integration tests for infer_from_references require a live DB via testcontainers.
"""

from __future__ import annotations

from rosmarium_ai_worker.graph.reference_inference import _extract_slugs


def test_extracts_wiki_links() -> None:
    text = "See [[my-great-article]] for more details."
    slugs = _extract_slugs(text)
    assert slugs == ["my-great-article"]


def test_extracts_url_path_references() -> None:
    text = "Read more at /content/intro-to-rosmarium."
    slugs = _extract_slugs(text)
    assert slugs == ["intro-to-rosmarium"]


def test_extracts_multiple_references() -> None:
    text = "See [[article-one]] and [[article-two]] and /content/article-three."
    slugs = _extract_slugs(text)
    assert len(slugs) == 3
    assert "article-one" in slugs
    assert "article-two" in slugs
    assert "article-three" in slugs


def test_deduplicates_references() -> None:
    text = "[[same-slug]] and [[same-slug]] again."
    slugs = _extract_slugs(text)
    assert slugs.count("same-slug") == 1


def test_empty_text_returns_empty_list() -> None:
    slugs = _extract_slugs("")
    assert slugs == []


def test_no_reference_patterns_returns_empty() -> None:
    text = "Just a normal sentence with no special links."
    slugs = _extract_slugs(text)
    assert slugs == []
