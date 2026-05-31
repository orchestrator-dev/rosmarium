export type FieldConditionOperator = 'eq' | 'neq' | 'contains' | 'gt' | 'lt' | 'exists' | 'empty';

export interface FieldCondition {
  field: string;
  operator: FieldConditionOperator;
  value?: unknown;
  logic?: 'and' | 'or';
}
