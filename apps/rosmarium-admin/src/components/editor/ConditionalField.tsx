import React from 'react';
import { useFieldConditions, type FieldCondition } from '../../hooks/useFieldConditions';

export interface ConditionalFieldProps {
  conditions?: unknown[]; // Type as unknown to avoid strict importing from backend if not available in frontend yet
  formData?: Record<string, unknown>;
  children: React.ReactNode;
}

export const ConditionalField: React.FC<ConditionalFieldProps> = ({ conditions, formData, children }) => {
  const isVisible = useFieldConditions(conditions as FieldCondition[], formData);
  if (!isVisible) return null;
  return <>{children}</>;
};
