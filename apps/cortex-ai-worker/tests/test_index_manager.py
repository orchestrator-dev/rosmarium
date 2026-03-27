"""Tests for the VectorIndexManager."""

from unittest.mock import AsyncMock

import pytest

from rosmarium_ai_worker.vector.index_manager import VectorIndexManager


@pytest.fixture
def manager() -> VectorIndexManager:
    return VectorIndexManager()


class TestEnsureTable:
    """Tests for ensure_table."""

    async def test_creates_table_and_indexes(
        self, manager: VectorIndexManager, mock_conn: AsyncMock
    ) -> None:
        await manager.ensure_table("article", 768, mock_conn)
        # Should call execute 3 times: CREATE TABLE, CREATE INDEX (HNSW), CREATE INDEX (entry)
        assert mock_conn.execute.call_count == 3

    async def test_table_name_follows_convention(
        self, manager: VectorIndexManager, mock_conn: AsyncMock
    ) -> None:
        await manager.ensure_table("product", 1024, mock_conn)
        first_call_sql = mock_conn.execute.call_args_list[0][0][0]
        assert "rosmarium_product_embeddings" in first_call_sql

    async def test_dimensions_in_create_statement(
        self, manager: VectorIndexManager, mock_conn: AsyncMock
    ) -> None:
        await manager.ensure_table("article", 768, mock_conn)
        first_call_sql = mock_conn.execute.call_args_list[0][0][0]
        assert "vector(768)" in first_call_sql

    async def test_hnsw_params(
        self, manager: VectorIndexManager, mock_conn: AsyncMock
    ) -> None:
        await manager.ensure_table("article", 768, mock_conn)
        hnsw_call_sql = mock_conn.execute.call_args_list[1][0][0]
        assert "m = 16" in hnsw_call_sql
        assert "ef_construction = 64" in hnsw_call_sql


class TestDeleteEmbeddings:
    """Tests for delete_embeddings."""

    async def test_deletes_by_content_entry_id(
        self, manager: VectorIndexManager, mock_conn: AsyncMock
    ) -> None:
        await manager.delete_embeddings("article", "entry-123", mock_conn)
        mock_conn.execute.assert_called_once()
        call_args = mock_conn.execute.call_args[0]
        assert "DELETE FROM rosmarium_article_embeddings" in call_args[0]
        assert call_args[1] == "entry-123"


class TestSearch:
    """Tests for search."""

    async def test_raises_without_connection(
        self, manager: VectorIndexManager
    ) -> None:
        with pytest.raises(RuntimeError, match="Database connection is required"):
            await manager.search("article", [0.1, 0.2, 0.3], conn=None)

    async def test_search_with_allowed_ids(
        self, manager: VectorIndexManager, mock_conn: AsyncMock
    ) -> None:
        mock_conn.fetch.return_value = []
        await manager.search(
            "article",
            [0.1] * 768,
            limit=5,
            allowed_entry_ids=["id-1", "id-2"],
            conn=mock_conn,
        )
        call_sql = mock_conn.fetch.call_args[0][0]
        assert "ANY($2)" in call_sql

    async def test_search_without_allowed_ids(
        self, manager: VectorIndexManager, mock_conn: AsyncMock
    ) -> None:
        mock_conn.fetch.return_value = []
        await manager.search(
            "article",
            [0.1] * 768,
            limit=10,
            conn=mock_conn,
        )
        call_sql = mock_conn.fetch.call_args[0][0]
        assert "ANY" not in call_sql
