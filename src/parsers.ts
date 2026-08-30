import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { DiscoveredRuleSource } from './discovery.js';
import type { NormalizedRule } from './types.js';

function parseScalar(value: string) {
  const trimmed = value.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseList(value: string) {
  const trimmed = value.trim();
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    return trimmed
      .slice(1, -1)
      .split(',')
      .map((item) => parseScalar(item))
      .filter(Boolean);
  }

  return trimmed
    .split(',')
    .map((item) => parseScalar(item))
    .filter(Boolean);
}

function splitFrontmatter(raw: string) {
  if (!raw.startsWith('---\n') && !raw.startsWith('---\r\n')) {
    return { attributes: new Map<string, string>(), content: raw.trim() };
  }

  const normalized = raw.replaceAll('\r\n', '\n');
  const end = normalized.indexOf('\n---\n', 4);
  if (end === -1) {
    return { attributes: new Map<string, string>(), content: raw.trim() };
  }

  const frontmatter = normalized.slice(4, end);
  const content = normalized.slice(end + 5).trim();
  const attributes = new Map<string, string>();

  for (const line of frontmatter.split('\n')) {
    const separator = line.indexOf(':');
    if (separator === -1) continue;
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    if (key) attributes.set(key, value);
  }

  return { attributes, content };
}

function makeId(source: DiscoveredRuleSource, content: string) {
  return createHash('sha256')
    .update(`${source.agent}\0${source.relativePath}\0${content}`)
    .digest('hex')
    .slice(0, 12);
}

export async function parseRuleSource(root: string, source: DiscoveredRuleSource): Promise<NormalizedRule> {
  const raw = await readFile(path.join(root, source.relativePath), 'utf8');
  const { attributes, content } = splitFrontmatter(raw);

  const description = attributes.get('description');
  const globsValue = attributes.get('globs') ?? attributes.get('applyTo');
  const alwaysApplyValue = attributes.get('alwaysApply');

  const globs = globsValue ? parseList(globsValue) : [];
  const alwaysApply = alwaysApplyValue
    ? alwaysApplyValue.toLowerCase() === 'true'
    : globs.length === 0;

  return {
    id: makeId(source, content),
    sourceAgent: source.agent,
    sourcePath: source.relativePath,
    title: source.relativePath.split('/').at(-1),
    description: description ? parseScalar(description) : undefined,
    scope: globs.length > 0 ? { globs } : undefined,
    alwaysApply,
    content,
  };
}
