export type {
  FieldDefinition,
  ContentTypeSettings,
  ContentType,
} from "@orchestrator.dev/types";

export interface ContentTypeInput {
  name: string;
  displayName: string;
  description: string;
  fields: import("@orchestrator.dev/types").FieldDefinition[];
  settings: import("@orchestrator.dev/types").ContentTypeSettings;
  isComponent?: boolean;
}
