/** Calling a tool over the loopback MCP endpoint, the way an external client
 *  would. Tests that exercise a tool end to end share this rather than each
 *  spelling the JSON-RPC envelope and the text-content unwrap again. */
export async function callTool<Result = Record<string, unknown>>(
  base: string,
  token: string,
  name: string,
  args: Record<string, unknown>,
): Promise<Result> {
  const response = await fetch(`${base}/mcp`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      accept: 'application/json, text/event-stream',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: `${name}-${Date.now()}`,
      method: 'tools/call',
      params: { name, arguments: args },
    }),
  });
  const body = await response.json() as { error?: unknown; result?: McpToolResult };
  if (!response.ok || body.error) {
    throw new Error(`MCP ${name} failed: ${response.status} ${JSON.stringify(body.error ?? body)}`);
  }
  const result = body.result;
  const text = result?.content?.find((item) => item?.type === 'text')?.text;
  if (result?.isError || typeof text !== 'string') {
    throw new Error(`MCP ${name} failed: ${typeof text === 'string' ? text : JSON.stringify(result)}`);
  }
  return JSON.parse(text) as Result;
}

interface McpToolResult {
  content?: { type?: string; text?: string }[];
  isError?: boolean;
}
