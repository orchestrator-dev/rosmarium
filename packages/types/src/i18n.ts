export interface LocaleConfig {
  defaultLocale: string;
  locales: LocaleDefinition[];
  fallbackChain: Record<string, string[]>;
}

export interface LocaleDefinition {
  code: string;
  name: string;
  direction: 'ltr' | 'rtl';
  isDefault: boolean;
}
