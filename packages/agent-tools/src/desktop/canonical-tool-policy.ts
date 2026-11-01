import type { RuntimeTool } from '@mavis/agent-core/tools';

import { MatrixWebSearchToolDef } from '../cloud/matrix-tools/tool-defs.js';
import { isCanonicalSubagentRole } from './subagent-roles.js';

/**
 * Starting a task and continuing one are the same delegation entry point, so
 * `task_append` is gated with `task` rather than with the read-only handles.
 */
export const DELEGATION_TOOL_NAMES: ReadonlySet<string> = new Set(['task', 'task_append']);
const READ_ONLY_CANONICAL_BLOCKED_TOOL_NAMES = new Set([
  'write',
  'edit',
  'website_deploy',
  'todowrite',
  'task',
  'task_append',
  'memory',
  'ask_user',
  'request_feature_enable',
]);

/**
 * Computer-use tools are registered under two namespaces:
 *
 * - `computer_*` — the V2 native catalog (local-runtime-v2 `service/computer-use/tools.ts`)
 * - `desktop_*`  — the V1 runtime (`packages/local-runtime/src/cu`)
 *
 * A check that knows only one prefix silently lets the other namespace escape
 * the read-only role ceiling and the computer-use availability gate, so both
 * prefixes are covered here and this list stays the single source of truth for
 * every consumer.
 */
export const COMPUTER_USE_TOOL_NAME_PREFIXES: readonly string[] = [
  'computer_',
  'desktop_',
];

/** True for any tool name owned by a computer-use runtime (V1 or V2). */
export function isComputerUseRuntimeToolName(name: string): boolean {
  return COMPUTER_USE_TOOL_NAME_PREFIXES.some((prefix) => name.startsWith(prefix));
}

/**
 * Apply the canonical built-in role ceiling to an already capability-filtered
 * native tool list. This helper is intentionally pure so V1 and V2 catalog
 * owners cannot drift on Explore/Verifier/Worker semantics.
 */
export function filterCanonicalNativeToolCeiling<T extends RuntimeTool>(
  tools: readonly T[],
  canonicalRole?: string,
  builtinAgent = false,
): T[] {
  if (!builtinAgent || !canonicalRole || !isCanonicalSubagentRole(canonicalRole)) {
    return [...tools];
  }
  if (canonicalRole === 'worker') {
    return tools.filter((tool) => !DELEGATION_TOOL_NAMES.has(tool.def.name));
  }
  return tools.filter(
    (tool) =>
      !READ_ONLY_CANONICAL_BLOCKED_TOOL_NAMES.has(tool.def.name) &&
      !isComputerUseRuntimeToolName(tool.def.name) &&
      (canonicalRole !== 'explore' ||
        !['task_query', 'task_output', 'task_stop'].includes(tool.def.name)),
  );
}

/**
 * Apply the canonical builtin role MCP ceiling to source-tagged entries.
 * Explore and Verifier retain only Matrix web search; Worker and custom or
 * untrusted agents retain the configured entry set.
 */
export function filterCanonicalBuiltinMcpEntries<
  T extends { readonly source: string; readonly tool: RuntimeTool },
>(entries: readonly T[], canonicalRole?: string, builtinAgent?: boolean): T[] {
  if (
    builtinAgent !== true ||
    canonicalRole === undefined ||
    !isCanonicalSubagentRole(canonicalRole) ||
    (canonicalRole !== 'explore' && canonicalRole !== 'verifier')
  ) {
    return [...entries];
  }
  return entries.filter(
    (entry) =>
      entry.source === 'builtin-matrix' && entry.tool.def.name === MatrixWebSearchToolDef.name,
  );
}

export function isCanonicalBuiltinTurn(canonicalRole?: string, builtinAgent?: boolean): boolean {
  return (
    builtinAgent === true && canonicalRole !== undefined && isCanonicalSubagentRole(canonicalRole)
  );
}
