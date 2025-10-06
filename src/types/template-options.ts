/**
 * Template options
 */
export interface TemplateOptions {
  format: "markdown" | "html" | "xml" | "json" | "custom";
  template?: string;
  variables?: Record<string, unknown>;
}

