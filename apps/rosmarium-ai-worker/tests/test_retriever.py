import pytest
from unittest.mock import patch, MagicMock
from rosmarium_ai_worker.rag.retriever import (
    RosmariumRetriever,
    _parse_db_name,
    _parse_db_host,
    _parse_db_port,
    _parse_db_user,
    _parse_db_password
)

def test_parse_db_url():
    url = "postgres://usr:pwd@host.com:1234/database_name?sslmode=require"
    assert _parse_db_name(url) == "database_name"
    assert _parse_db_host(url) == "host.com"
    assert _parse_db_port(url) == "1234"
    assert _parse_db_user(url) == "usr"
    assert _parse_db_password(url) == "pwd"
    
    url_no_port = "postgres://usr@host.com/database_name"
    assert _parse_db_port(url_no_port) == "5432"
    assert _parse_db_password(url_no_port) == ""

@pytest.mark.asyncio
async def test_rosmarium_retriever():
    retriever = RosmariumRetriever("article", top_k=5)
    
    # Test error before build
    with pytest.raises(RuntimeError):
        retriever.as_retriever()
        
    with patch("rosmarium_ai_worker.rag.retriever.get_provider") as mock_get_provider, \
         patch("rosmarium_ai_worker.rag.retriever.PGVectorStore") as mock_pg, \
         patch("rosmarium_ai_worker.rag.retriever.VectorStoreIndex") as mock_index:
         
        mock_provider = MagicMock()
        mock_provider.dimensions = 768
        mock_get_provider.return_value = mock_provider
        
        mock_index_instance = MagicMock()
        mock_index.from_vector_store.return_value = mock_index_instance
        
        await retriever.build()
        
        # Test as_retriever
        ret = retriever.as_retriever()
        mock_index_instance.as_retriever.assert_called_once_with(similarity_top_k=5)
