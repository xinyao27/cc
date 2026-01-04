/**
 * Claude Code settings.json structure
 */
export interface ClaudeSettings {
  $schema?: string;
  env?: Record<string, string>;
  alwaysThinkingEnabled?: boolean;
  enabledPlugins?: Record<string, boolean>;
  feedbackSurveyState?: Record<string, unknown>;
  hooks?: Record<string, unknown>;
  model?: string;
  permissions?: Record<string, unknown>;
  statusLine?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * Provider config - inspired by cc-switch's settingsConfig design
 * Stores complete Claude settings snapshot, not just apiKey/baseUrl
 */
export interface Provider {
  id: string;
  name: string;
  /** Complete Claude settings snapshot */
  settingsConfig: ClaudeSettings;
  description?: string;
  /** Provider type: subscription or api (API key) */
  category?: "subscription" | "api";
  createdAt?: number;
  icon?: string;
  iconColor?: string;
}

export interface ProvidersConfig {
  providers: Provider[];
  /** Current provider id */
  currentProviderId?: string;
}
