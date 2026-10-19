// A minimal MCP server (JSON-RPC 2.0 over HTTP, JSON responses) so a person's own ChatGPT or Claude
// can search Wattle with what it already knows about them. Add https://wattlehealth.vercel.app/api/mcp
// as a connector. Tools: search_doctors, get_doctor. No API key on Wattle's side, no model calls.
import { NextResponse } from "next/server";
import { agentDoctor, agentSearch } from "@/src/data/agent-search";

type Rpc = { jsonrpc: "2.0"; id?: string | number | null; method: string; params?: Record<string, unknown> };

const TOOLS = [
  {
    name: "search_doctors",
    description:
      "Find up to three Queensland doctors for a person's needs, described in plain words (conditions, who it is for, how they like to be cared for, telehealth). Returns each doctor's own words, highlights ranked for this request, practical facts and a link.",
    inputSchema: {
      type: "object",
      properties: {
        sentence: { type: "string", description: "What the person needs, in their words, including relevant health context they have shared." },
        suburb: { type: "string", description: "Queensland suburb or postcode; defaults to Brisbane." },
      },
      required: ["sentence"],
    },
  },
  {
    name: "get_doctor",
    description: "Full Wattle profile for one doctor id returned by search_doctors.",
    inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
  },
];

async function handle(msg: Rpc) {
  switch (msg.method) {
    case "initialize":
      return {
        protocolVersion: "2025-06-18",
        capabilities: { tools: {} },
        serverInfo: { name: "wattle-health", version: "1.0.0" },
        instructions: "Use search_doctors with the person's needs and any health context they have shared with you. Present each doctor's own words and highlights, and link to the profile. Wattle does not give medical advice.",
      };
    case "tools/list":
      return { tools: TOOLS };
    case "tools/call": {
      const name = String(msg.params?.name ?? "");
      const args = (msg.params?.arguments ?? {}) as Record<string, unknown>;
      if (name === "search_doctors") {
        const out = await agentSearch(String(args.sentence ?? ""), typeof args.suburb === "string" ? args.suburb : undefined);
        return { content: [{ type: "text", text: JSON.stringify(out) }], structuredContent: out };
      }
      if (name === "get_doctor") {
        const out = await agentDoctor(String(args.id ?? ""));
        return out ? { content: [{ type: "text", text: JSON.stringify(out) }], structuredContent: out } : { content: [{ type: "text", text: "No doctor with that id." }], isError: true };
      }
      throw { code: -32602, message: `Unknown tool ${name}` };
    }
    case "ping":
      return {};
    default:
      throw { code: -32601, message: `Method not found: ${msg.method}` };
  }
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Rpc | Rpc[] | null;
  if (!body) return NextResponse.json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }, { status: 400 });
  const batch = Array.isArray(body) ? body : [body];
  const out: unknown[] = [];
  for (const msg of batch) {
    if (msg.id === undefined || msg.id === null) continue; // notifications get no response
    try {
      out.push({ jsonrpc: "2.0", id: msg.id, result: await handle(msg) });
    } catch (e) {
      const err = e as { code?: number; message?: string };
      out.push({ jsonrpc: "2.0", id: msg.id, error: { code: err.code ?? -32603, message: err.message ?? "Internal error" } });
    }
  }
  if (out.length === 0) return new Response(null, { status: 202 });
  return NextResponse.json(Array.isArray(body) ? out : out[0]);
}

export function GET() {
  return NextResponse.json({ name: "wattle-health", transport: "POST JSON-RPC 2.0 to this URL", tools: TOOLS.map((t) => t.name) });
}
