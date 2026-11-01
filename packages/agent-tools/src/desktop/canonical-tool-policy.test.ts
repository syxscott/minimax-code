import { describe, expect, it } from 'vitest';

import type { RuntimeTool } from '@mavis/agent-core/tools';

import {
  COMPUTER_USE_TOOL_NAME_PREFIXES,
  filterCanonicalNativeToolCeiling,
  isComputerUseRuntimeToolName,
} from './canonical-tool-policy.js';

/**
 * Minimal runtime tool stub: the policy helpers only read `def.name`.
 */
function tool(name: string): RuntimeTool {
  return { def: { name } } as unknown as RuntimeTool;
}

const V1_CU_TOOLS = ['desktop_screenshot', 'desktop_screenshot_region', 'desktop_zoom'];
const V2_CU_TOOLS = [
  'computer_app_list',
  'computer_window_list',
  'computer_display_list',
  'computer_window_set_frame',
  'computer_desktop_state',
  'computer_app_launch',
  'computer_app_activate',
  'computer_app_state',
  'computer_click',
  'computer_drag',
  'computer_type',
  'computer_set_value',
  'computer_select_text',
  'computer_key',
  'computer_scroll',
  'computer_secondary_action',
  'computer_verify_state',
];

describe('computer-use tool namespace', () => {
  it('recognises both the V1 desktop_* and the V2 computer_* namespaces', () => {
    for (const name of [...V1_CU_TOOLS, ...V2_CU_TOOLS]) {
      expect(isComputerUseRuntimeToolName(name), name).toBe(true);
    }
  });

  it('does not claim unrelated tools', () => {
    for (const name of [
      'read',
      'write',
      'edit',
      'bash',
      'browser',
      'computer',
      'desktop',
      'my_computer_click',
    ]) {
      expect(isComputerUseRuntimeToolName(name), name).toBe(false);
    }
  });

  it('over-claims in the safe direction rather than under-claiming', () => {
    // Prefix matching intentionally treats any `computer_*` / `desktop_*` name as
    // computer-use owned. The exact V2 catalog is not part of this distribution,
    // so an exact-name list would silently miss tools; over-claiming only costs
    // an extra tool being withheld from a read-only role.
    expect(isComputerUseRuntimeToolName('computer_use')).toBe(true);
    expect(isComputerUseRuntimeToolName('computer_use_not_registered_yet')).toBe(true);
  });

  it('keeps both namespaces in the shared prefix list', () => {
    expect(COMPUTER_USE_TOOL_NAME_PREFIXES).toContain('computer_');
    expect(COMPUTER_USE_TOOL_NAME_PREFIXES).toContain('desktop_');
  });
});

describe('canonical role ceiling', () => {
  it.each(['explore', 'verifier'] as const)(
    'drops computer-use tools from the read-only %s role',
    (role) => {
      const tools = [...V1_CU_TOOLS, ...V2_CU_TOOLS, 'read', 'bash'].map(tool);
      const kept = filterCanonicalNativeToolCeiling(tools, role, true).map((t) => t.def.name);
      expect(kept).toEqual(['read', 'bash']);
    },
  );

  it('drops the V2 computer_* tools from the read-only roles', () => {
    const kept = filterCanonicalNativeToolCeiling([tool('computer_click'), tool('read')], 'explore', true)
      .map((t) => t.def.name);
    expect(kept).toEqual(['read']);
  });

  it('keeps the V1 desktop_* tools excluded as well', () => {
    const kept = filterCanonicalNativeToolCeiling([tool('desktop_screenshot')], 'verifier', true).map(
      (t) => t.def.name,
    );
    expect(kept).toEqual([]);
  });

  it('leaves the worker role with computer-use tools', () => {
    const kept = filterCanonicalNativeToolCeiling(
      [tool('computer_click'), tool('desktop_screenshot')],
      'worker',
      true,
    ).map((t) => t.def.name);
    expect(kept).toEqual(['computer_click', 'desktop_screenshot']);
  });

  it('does not apply the ceiling to non-builtin agents', () => {
    const kept = filterCanonicalNativeToolCeiling([tool('computer_click')], 'explore', false).map(
      (t) => t.def.name,
    );
    expect(kept).toEqual(['computer_click']);
  });
});
