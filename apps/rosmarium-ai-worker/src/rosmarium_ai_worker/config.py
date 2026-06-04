"""Rosmarium AI Worker configuration — Pydantic Settings with environment variable loading."""

from typing import Literal

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Server
    port: int = 8001
    host: str = "0.0.0.0"  # noqa: S104
    environment: Literal["development", "production", "test"] = "development"
    worker_secret: str = "change-this-in-production"
    rosmarium_server_url: str | None = None

    # Database
    database_url: str = "postgresql://rosmarium:rosmarium@localhost:5432/rosmarium"

    # Redis
    redis_url: str = "redis://localhost:6379"

    # Embedding
    embedding_provider: Literal[
        "openai", "ollama", "cohere", "huggingface", "openai-compatible", "local"
    ] = "local"
    embedding_model: str = "all-MiniLM-L6-v2"
    embedding_dimensions: int = 768
    embedding_batch_size: int = 32
    embedding_queue_concurrency: int = 4

    # Provider API keys — masked in logs via repr=False
    openai_api_key: str | None = None
    cohere_api_key: str | None = None
    hf_api_key: str | None = None
    ollama_base_url: str = "http://localhost:11434"

    # Chunking
    chunking_default_strategy: Literal["fixed", "sentence", "section", "semantic"] = "sentence"
    chunking_chunk_size: int = 512
    chunking_chunk_overlap: int = 50

    # Intelligence
    tagging_model: str = "cross-encoder/nli-MiniLM2-L6-H768"
    summarization_model: str = "llama3.2"
    duplicate_threshold: float = 0.92

    # Graph inference
    graph_inference_enabled: bool = True
    graph_similarity_threshold: float = 0.85
    graph_max_similarity_edges: int = 5

    # Observability
    otel_exporter_otlp_endpoint: str | None = None
    otel_service_name: str = "rosmarium-ai-worker"


    @field_validator("database_url")
    @classmethod
    def validate_db_url(cls, v: str) -> str:
        """Normalise PostgreSQL URL scheme for asyncpg compatibility."""
        if v.startswith("postgresql://"):
            return v.replace("postgresql://", "postgres://", 1)
        return v

    @field_validator("worker_secret")
    @classmethod
    def validate_worker_secret(cls, v: str, info) -> str:
        if info.data.get("environment") == "production" and v == "change-this-in-production":
            raise ValueError("worker_secret must be changed in production")
        return v


settings = Settings()
