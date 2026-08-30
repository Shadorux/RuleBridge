export type AgentId = 'codex' | 'claude' | 'cursor' | 'copilot';

export type RuleScope = {
  globs: string[];
};

export type NormalizedRule = {
  id: string;
  sourceAgent: AgentId;
  sourcePath: string;
  title?: string;
  description?: string;
  scope?: RuleScope;
  alwaysApply: boolean;
  content: string;
};

export type ImportedRules = {
  version: 1;
  generatedAt: string;
  root: string;
  rules: NormalizedRule[];
};
