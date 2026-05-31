"""Glossary management for AI translation."""

from __future__ import annotations

import structlog

logger = structlog.get_logger(__name__)

class GlossaryManager:
    """Manages brand glossary rules for translation."""
    
    def __init__(self) -> None:
        # In a real implementation this might fetch from PostgreSQL/Redis
        # For now, it's a simple mapping.
        self._glossary: dict[str, dict[str, str]] = {}
        
    def add_term(self, tenant_id: str, source: str, target: str) -> None:
        """Add a term to the tenant's glossary."""
        if tenant_id not in self._glossary:
            self._glossary[tenant_id] = {}
        self._glossary[tenant_id][source] = target
        
    def get_rules(self, tenant_id: str) -> dict[str, str]:
        """Get the glossary rules for a tenant."""
        return self._glossary.get(tenant_id, {})

glossary_manager = GlossaryManager()
