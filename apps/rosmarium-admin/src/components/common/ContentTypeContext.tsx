import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import type { ContentType } from '@orchestrator.dev/types';
import { apiClient } from '../../api/client';

interface ContentTypeContextState {
  contentTypes: ContentType[];
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

const ContentTypeContext = createContext<ContentTypeContextState | undefined>(undefined);

export function ContentTypeProvider({ children }: { children: ReactNode }) {
  const [contentTypes, setContentTypes] = useState<ContentType[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchContentTypes = async () => {
    setLoading(true);
    try {
      const json = await apiClient.get<{ data: ContentType[] }>('/api/content-types');
      setContentTypes(json.data || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch content types'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchContentTypes();
  }, []);

  return (
    <ContentTypeContext.Provider value={{ contentTypes, loading, error, refresh: fetchContentTypes }}>
      {children}
    </ContentTypeContext.Provider>
  );
}

export function useContentTypes() {
  const context = useContext(ContentTypeContext);
  if (context === undefined) {
    throw new Error('useContentTypes must be used within a ContentTypeProvider');
  }
  return context;
}
