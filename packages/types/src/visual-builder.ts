export interface ComponentDefinition {
  id: string;
  name: string;
  category: string;
  description: string;
  thumbnail?: string;
  props: ComponentProp[];
  defaultProps: Record<string, unknown>;
  variants?: ComponentVariant[];
  framework: 'react' | 'vue' | 'astro' | 'html';
  source: string;
}

export interface ComponentProp {
  name: string;
  type: 'text' | 'richText' | 'image' | 'number' | 'boolean' | 'select' | 'color' | 'relation' | 'federated';
  label: string;
  required: boolean;
  defaultValue?: unknown;
  dataBinding?: {
    source: string;
    query: string;
    variableMapping: Record<string, string>;
  };
}

export interface ComponentVariant {
  name: string;
  props: Record<string, unknown>;
}

export interface PageDefinition {
  id: string;
  slug: string;
  title: string;
  locale: string;
  template?: string;
  sections: PageSection[];
  seo: {
    title: string;
    description: string;
    ogImage?: string;
  };
  personalization?: PersonalizationRule[];
}

export interface PageSection {
  id: string;
  componentId: string;
  props: Record<string, unknown>;
  conditions?: PersonalizationCondition[];
  order: number;
}

export interface PersonalizationRule {
  segmentId: string;
  variants: PageSection[];
}

export interface PersonalizationCondition {
  trait: string;
  operator: 'eq' | 'neq' | 'in' | 'gt' | 'lt' | 'contains' | 'regex';
  value: unknown;
}
