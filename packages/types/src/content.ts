import type { FieldCondition } from "./field-conditions.js";

export interface FieldDefinition {
  name: string;
  type: string;
  label: string;
  required: boolean;
  unique?: boolean;
  localised?: boolean;
  conditions?: FieldCondition[];
  // Type specific
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  integer?: boolean;
  options?: {label: string, value: string}[];
  targetContentType?: string;
  many?: boolean;
  generatedFrom?: string;
  // Group / Component / Blocks
  fields?: FieldDefinition[];
  allowedComponents?: string[];
  minBlocks?: number;
  maxBlocks?: number;
  // Custom plugins
  [key: string]: unknown;
}

export interface ContentTypeSettings {
  ai?: {
    enabled: boolean;
    operations: string[];
    taxonomy: string[];
  };
  graph?: {
    enabled: boolean;
    edgeTypes: { name: string; label: string; bidirectional: boolean }[];
    autoInferNer: boolean;
    autoInferSimilarity: boolean;
    similarityThreshold: number;
  };
  previewUrl?: string;
  [key: string]: unknown;
}

export interface ContentType {
  id: string;
  name: string;
  displayName: string;
  description: string | null;
  fields: FieldDefinition[];
  settings: ContentTypeSettings;
  isComponent?: boolean;
  isSystem: boolean;
  createdAt: string | Date;
  updatedAt?: string | Date;
  archivedAt?: string | Date | null;
  createdBy?: string | null;
  entriesCount?: number;
}

export interface ContentEntry {
  id: string;
  contentTypeId: string;
  locale: string;
  status: 'draft' | 'published' | 'archived';
  data: Record<string, unknown>;
  publishedAt: string | Date | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  createdBy: string | null;
  updatedBy: string | null;
}
