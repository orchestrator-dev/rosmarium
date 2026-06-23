export interface AudienceSegment {
  id: string;
  name: string;
  description: string;
  conditions: SegmentCondition[];
  logic: 'and' | 'or';
  priority: number;
}

export interface SegmentCondition {
  trait: string;
  operator: 'eq' | 'neq' | 'in' | 'gt' | 'lt' | 'contains' | 'regex';
  value: unknown;
}

export interface ContentVariant {
  id: string;
  baseEntryId: string;
  segmentId: string;
  overrides: Record<string, unknown>;
  metrics: {
    impressions: number;
    clicks: number;
    conversions: number;
  };
}
