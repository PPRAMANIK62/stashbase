import fs from 'node:fs';
import path from 'node:path';

export type CodexJsonObject = Record<string, unknown>;

export interface CodexMcpToolApproval {
  toolUseId: string;
  name: string;
  title: string;
  input: CodexJsonObject;
}

export function approvalTitle(reason: unknown, detail: unknown, fallback: string): string {
  const normalizedReason = stringValue(reason);
  if (normalizedReason) return normalizedReason;
  const normalizedDetail = stringValue(detail);
  return normalizedDetail ? `${fallback} ${normalizedDetail}` : fallback;
}

export function commandApprovalInput(params: CodexJsonObject): CodexJsonObject {
  return {
    command: stringValue(params.command),
    cwd: stringValue(params.cwd),
    reason: stringValue(params.reason),
    commandActions: params.commandActions ?? [],
  };
}

export function fileChangeApprovalInput(params: CodexJsonObject): CodexJsonObject {
  return {
    itemId: stringValue(params.itemId),
    reason: stringValue(params.reason),
    grantRoot: stringValue(params.grantRoot),
  };
}

export function mcpToolApprovalFromElicitation(
  params: CodexJsonObject,
): CodexMcpToolApproval | null {
  const meta = objectValue(params._meta);
  const kind = stringValue(meta.codex_approval_kind) || stringValue(meta.approval_kind);
  const tool = stringValue(meta.tool_name)
    || stringValue(meta.toolName)
    || stringValue(meta.tool)
    || stringValue(params.tool_name)
    || stringValue(params.toolName)
    || stringValue(params.tool);
  if (kind !== 'mcp_tool_call' && !tool) return null;

  const server = stringValue(meta.connector_name)
    || stringValue(meta.server_name)
    || stringValue(meta.server)
    || stringValue(params.server_name)
    || stringValue(params.server);
  const toolTitle = stringValue(meta.tool_title) || stringValue(meta.title);
  const name = [server, toolTitle || tool].filter(Boolean).join(':') || 'MCP tool';
  const prompt = protocolNoticeFromParams(params);
  const toolUseId = stringValue(meta.codex_mcp_tool_call_id)
    || stringValue(meta.codex_call_id)
    || stringValue(meta.call_id)
    || stringValue(params.itemId)
    || stringValue(params.item_id)
    || stringValue(params.toolUseId)
    || stringValue(params.tool_use_id);
  const args = objectValue(meta.tool_params);

  return {
    toolUseId,
    name,
    title: prompt || `Allow Codex to use ${name}?`,
    input: {
      server,
      tool,
      arguments: args,
      prompt,
      requestedSchema: params.requestedSchema ?? params.requested_schema ?? null,
    },
  };
}

export function requestedPermissions(params: CodexJsonObject | undefined): CodexJsonObject {
  const permissions = objectValue(params?.permissions);
  const granted: CodexJsonObject = {};
  if (permissions.network) granted.network = permissions.network;
  if (permissions.fileSystem) granted.fileSystem = permissions.fileSystem;
  return granted;
}

export function codexAccessOptions(mode: string | undefined): {
  approvalPolicy: string;
  approvalsReviewer: string;
  sandbox: string;
} {
  switch (mode) {
    case 'acceptEdits':
      return { approvalPolicy: 'on-request', approvalsReviewer: 'user', sandbox: 'workspace-write' };
    case 'plan':
      return { approvalPolicy: 'on-request', approvalsReviewer: 'user', sandbox: 'read-only' };
    case 'auto':
      return { approvalPolicy: 'on-request', approvalsReviewer: 'auto', sandbox: 'workspace-write' };
    case 'default':
    default:
      return { approvalPolicy: 'on-request', approvalsReviewer: 'user', sandbox: 'workspace-write' };
  }
}

/** Whether a file-change grant remains entirely inside the opened folder. */
export function isWorkspaceFileChange(
  params: CodexJsonObject | undefined,
  cwd: string | null,
): boolean {
  return isPathWithinWorkspace(stringValue(params?.grantRoot), cwd);
}

/** Edit mode accepts only ordinary StashBase write/edit tools in the folder. */
export function isStashbaseWorkspaceEdit(
  approval: { input: CodexJsonObject },
  cwd: string | null,
): boolean {
  const tool = stringValue(approval.input.tool);
  const args = objectValue(approval.input.arguments);
  return stringValue(approval.input.server).toLowerCase() === 'stashbase'
    && (tool === 'write_file' || tool === 'edit_file')
    && isPathWithinWorkspace(stringValue(args.path), cwd);
}

function isPathWithinWorkspace(candidate: string, cwd: string | null): boolean {
  if (!cwd || !candidate) return false;
  const workspace = resolvedExistingPath(cwd);
  const target = resolvedExistingPath(candidate);
  if (!workspace || !target) return false;
  const relative = path.relative(workspace, target);
  return relative === ''
    || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

function resolvedExistingPath(candidate: string): string | null {
  const absolute = path.resolve(candidate);
  let existing = absolute;
  while (!fs.existsSync(existing)) {
    const parent = path.dirname(existing);
    if (parent === existing) return null;
    existing = parent;
  }
  try {
    return path.resolve(fs.realpathSync.native(existing), path.relative(existing, absolute));
  } catch {
    return null;
  }
}

function protocolNoticeFromParams(params: CodexJsonObject): string {
  return notificationMessage(params)
    || stringValue(params.prompt)
    || stringValue(params.message);
}

function notificationMessage(params: CodexJsonObject): string {
  const direct = stringValue(params.message);
  if (direct) return direct;
  const error = objectValue(params.error);
  return stringValue(error.message);
}

function objectValue(value: unknown): CodexJsonObject {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as CodexJsonObject
    : {};
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

