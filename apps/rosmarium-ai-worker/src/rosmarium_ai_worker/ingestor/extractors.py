from __future__ import annotations

import abc
import json
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from typing import AsyncGenerator

from .models import CrawledPage, IngestorConfig
from .crawler import RosmaCrawler


class BaseExtractor(abc.ABC):
    """Base class for all data source extractors."""
    
    def __init__(self, config: IngestorConfig) -> None:
        self._config = config
        self._source = getattr(config, "source", config)
    
    @abc.abstractmethod
    async def extract(self) -> AsyncGenerator[CrawledPage, None]:
        """Yield extracted content."""
        yield  # type: ignore


class WebExtractor(BaseExtractor):
    """Extractor for web crawling."""
    
    async def extract(self) -> AsyncGenerator[CrawledPage, None]:
        crawler = RosmaCrawler(self._config)
        async for page in crawler.crawl():
            yield page


class FileExtractor(BaseExtractor):
    """Extractor for local file systems."""
    
    async def extract(self) -> AsyncGenerator[CrawledPage, None]:
        path = getattr(self._source, "path", "")
        format_ = getattr(self._source, "format", "json")
        
        try:
            with open(path, "r", encoding="utf-8") as f:
                content = f.read()
                
            items = []
            if format_ == "json":
                data = json.loads(content)
                if isinstance(data, list):
                    items = data
                else:
                    items = [data]
            elif format_ == "xml":
                root = ET.fromstring(content)
                items = [{"xml_node": ET.tostring(child, encoding='unicode')} for child in root]
            else:
                # Text or CSV format
                items = [{"text": line.strip()} for line in content.splitlines() if line.strip()]

            for idx, item in enumerate(items):
                item_str = json.dumps(item, default=str) if isinstance(item, dict) else str(item)
                yield CrawledPage(
                    url=f"file://{path}#{idx}",
                    title=f"File: {path.split('/')[-1]} - Record {idx}",
                    markdown=item_str,
                    html=item_str,
                    language="en",
                    contentType=None,
                    crawledAt=datetime.now(timezone.utc),
                    depth=0,
                )
        except Exception as e:
            # Emulate an error if file doesn't exist
            pass


class DatabaseExtractor(BaseExtractor):
    """Extractor for databases like PostgreSQL and MongoDB."""
    
    async def extract(self) -> AsyncGenerator[CrawledPage, None]:
        provider = getattr(self._source, "provider", "postgres")
        conn_str = getattr(self._source, "connectionString", "")
        query = getattr(self._source, "queryOrCollection", "")
        
        if provider == "postgres":
            import asyncpg
            try:
                conn = await asyncpg.connect(conn_str)
                rows = await conn.fetch(query)
                for idx, row in enumerate(rows):
                    data = dict(row)
                    yield CrawledPage(
                        url=f"db://{provider}/{idx}",
                        title=f"DB Record {idx}",
                        markdown=json.dumps(data, default=str),
                        html=json.dumps(data, default=str),
                        language="en",
                        contentType=None,
                        crawledAt=datetime.now(timezone.utc),
                        depth=0,
                    )
            except Exception:
                pass
            finally:
                if 'conn' in locals():
                    await conn.close()
                    
        elif provider == "mongo":
            from motor.motor_asyncio import AsyncIOMotorClient
            try:
                client = AsyncIOMotorClient(conn_str)
                db = client.get_default_database()
                collection = db[query]
                cursor = collection.find({})
                idx = 0
                async for document in cursor:
                    document["_id"] = str(document["_id"])
                    yield CrawledPage(
                        url=f"db://{provider}/{idx}",
                        title=f"Mongo Document {idx}",
                        markdown=json.dumps(document, default=str),
                        html=json.dumps(document, default=str),
                        language="en",
                        contentType=None,
                        crawledAt=datetime.now(timezone.utc),
                        depth=0,
                    )
                    idx += 1
            except Exception:
                pass
        else:
            raise ValueError(f"Unsupported database provider: {provider}")


class CloudExtractor(BaseExtractor):
    """Extractor for Cloud storage like S3 or MinIO."""
    
    async def extract(self) -> AsyncGenerator[CrawledPage, None]:
        import aioboto3
        import botocore
        
        bucket = getattr(self._source, "bucket", "")
        prefix = getattr(self._source, "prefix", "")
        endpoint = getattr(self._source, "endpoint", None)
        
        # Ensure we use anonymous requests if keys are not configured, or pass them if they are.
        # But for now, we'll assume the environment has AWS credentials or MinIO local works without them.
        session = aioboto3.Session()
        
        # Boto3 uses UNSIGNED config for public buckets if we don't have credentials
        config = botocore.config.Config(signature_version=botocore.UNSIGNED)
        
        # For simplicity, we just use the default configured credentials
        async with session.client("s3", endpoint_url=endpoint) as s3:
            paginator = s3.get_paginator('list_objects_v2')
            try:
                async for page in paginator.paginate(Bucket=bucket, Prefix=prefix):
                    for obj in page.get('Contents', []):
                        key = obj['Key']
                        if key.endswith('/'):
                            continue
                            
                        resp = await s3.get_object(Bucket=bucket, Key=key)
                        body = await resp['Body'].read()
                        content = body.decode('utf-8', errors='ignore')
                        
                        yield CrawledPage(
                            url=f"s3://{bucket}/{key}",
                            title=f"S3 Object: {key}",
                            markdown=content,
                            html=content,
                            language="en",
                            contentType=None,
                            crawledAt=datetime.now(timezone.utc),
                            depth=0,
                        )
            except Exception:
                pass


class ExtractorFactory:
    """Factory to instantiate the appropriate extractor based on source config."""
    
    @staticmethod
    def get_extractor(config: IngestorConfig) -> BaseExtractor:
        source_type = getattr(config.source, "type", "web")
        
        if source_type == "web":
            return WebExtractor(config)
        elif source_type == "file":
            return FileExtractor(config)
        elif source_type == "database":
            return DatabaseExtractor(config)
        elif source_type == "cloud":
            return CloudExtractor(config)
        else:
            raise ValueError(f"Unknown source type: {source_type}")
