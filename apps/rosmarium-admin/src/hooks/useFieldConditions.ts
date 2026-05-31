import { useMemo } from 'react';
export type FieldConditionOperator = 'eq' | 'neq' | 'contains' | 'gt' | 'lt' | 'exists' | 'empty';

export interface FieldCondition {
  field: string;
  operator: FieldConditionOperator;
  value?: unknown;
  logic?: 'and' | 'or';
}

export function evaluateConditions(conditions: FieldCondition[], data: Record<string, unknown>): boolean {
    if (!conditions || conditions.length === 0) return true;

    let result = true;
    for (let i = 0; i < conditions.length; i++) {
        const cond = conditions[i];
        if (!cond) continue;
        const value = data[cond.field];
        
        let currentMet = false;
        switch (cond.operator) {
            case 'eq': currentMet = value === cond.value; break;
            case 'neq': currentMet = value !== cond.value; break;
            case 'contains': 
                if (Array.isArray(value)) currentMet = value.includes(cond.value);
                else if (typeof value === 'string') currentMet = value.includes(String(cond.value));
                break;
            case 'gt': currentMet = typeof value === 'number' && typeof cond.value === 'number' && value > cond.value; break;
            case 'lt': currentMet = typeof value === 'number' && typeof cond.value === 'number' && value < cond.value; break;
            case 'exists': currentMet = value !== undefined && value !== null; break;
            case 'empty': currentMet = value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0); break;
        }

        if (i === 0) {
            result = currentMet;
        } else {
            if (cond.logic === 'or') {
                result = result || currentMet;
            } else {
                result = result && currentMet;
            }
        }
    }
    return result;
}

export function useFieldConditions(conditions?: FieldCondition[], formData?: Record<string, unknown>): boolean {
  return useMemo(() => {
    if (!conditions || conditions.length === 0) return true;
    if (!formData) return true;
    return evaluateConditions(conditions, formData);
  }, [conditions, formData]);
}
