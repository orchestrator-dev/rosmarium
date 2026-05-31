export interface FieldDefinition {
  name: string;
  type: string;
  label: string;
  required: boolean;
  unique?: boolean;
  localised?: boolean;
  conditions?: unknown[];
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
  createdAt: string;
  entriesCount?: number;
}

export interface ContentTypeInput {
  name: string;
  displayName: string;
  description: string;
  fields: FieldDefinition[];
  settings: ContentTypeSettings;
  isComponent?: boolean;
}
