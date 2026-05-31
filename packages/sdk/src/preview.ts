export interface InitPreviewOptions {
  /** Callback fired when a specific field is updated in the Admin UI */
  onUpdate: (path: string, value: unknown) => void;
  /** Callback fired when the initial preview data is received */
  onReady?: (data: { token: string; entryId: string; data: unknown }) => void;
}

/**
 * Initializes the live preview messaging protocol.
 * Call this in your frontend application (e.g. inside a useEffect).
 * 
 * @returns A cleanup function to remove the event listener.
 */
export function initPreview(options: InitPreviewOptions): () => void {
  if (typeof window === 'undefined') {
    return () => {}; // No-op in SSR environments
  }

  const handleMessage = (event: MessageEvent) => {
    if (!event.data || typeof event.data !== 'object') return;
    
    if (event.data.type === 'preview') {
      if (options.onReady) {
        options.onReady({
          token: event.data.token,
          entryId: event.data.entryId,
          data: event.data.data,
        });
      }
      
      // Acknowledge readiness
      event.source?.postMessage({ type: 'ready' }, { targetOrigin: event.origin });
    } else if (event.data.type === 'update') {
      options.onUpdate(event.data.path, event.data.value);
    }
  };

  window.addEventListener('message', handleMessage);
  
  return () => {
    window.removeEventListener('message', handleMessage);
  };
}
