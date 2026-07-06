// Bidirectional Preview Protocol V2

export type PreviewMessage = 
  | { type: 'ROSMARIUM_FIELD_UPDATE'; payload: { field: string; value: unknown; path?: string } }
  | { type: 'ROSMARIUM_SECTION_ADD'; payload: { section: unknown; index: number } }
  | { type: 'ROSMARIUM_SECTION_REORDER'; payload: { sourceIndex: number; destinationIndex: number } }
  | { type: 'ROSMARIUM_ELEMENT_CLICK'; payload: { fieldId: string; componentId?: string } }
  | { type: 'ROSMARIUM_INIT'; payload: { initialData: unknown; locale: string } };

export class PreviewV2Client {
  private listeners: Set<(msg: PreviewMessage) => void> = new Set();
  
  constructor(private isParent: boolean = false) {
    if (typeof window !== 'undefined') {
      window.addEventListener('message', this.handleMessage);
    }
  }

  private handleMessage = (event: MessageEvent) => {
    // Basic security check - in production you'd verify origins
    if (event.data && typeof event.data === 'object' && 'type' in event.data) {
      if ((event.data.type as string).startsWith('ROSMARIUM_')) {
        this.listeners.forEach(listener => listener(event.data as PreviewMessage));
      }
    }
  };

  public subscribe(callback: (msg: PreviewMessage) => void) {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  public sendMessage(msg: PreviewMessage, targetWindow?: Window) {
    if (typeof window === 'undefined') return;
    
    const target = targetWindow || (this.isParent ? null : window.parent);
    if (target && target !== window) {
      target.postMessage(msg, '*');
    }
  }

  public cleanup() {
    if (typeof window !== 'undefined') {
      window.removeEventListener('message', this.handleMessage);
    }
    this.listeners.clear();
  }
}
