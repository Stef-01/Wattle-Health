// OpenAPI 3.1 for a custom GPT Action: lets a person's own ChatGPT search Wattle with their context.
import { NextResponse } from "next/server";

export function GET(request: Request) {
  const origin = new URL(request.url).origin;
  return NextResponse.json({
    openapi: "3.1.0",
    info: {
      title: "Wattle Health",
      version: "1.0.0",
      description: "Find Australian doctors who fit a person's needs, with each doctor's own words and ranked highlights. Facts only, with sources; not medical advice.",
    },
    servers: [{ url: origin }],
    paths: {
      "/api/gpt/search": {
        get: {
          operationId: "searchDoctors",
          summary: "Find up to three doctors for a need described in plain words",
          parameters: [
            { name: "sentence", in: "query", required: true, schema: { type: "string" }, description: "The person's needs and relevant health context, in plain words." },
            { name: "suburb", in: "query", required: false, schema: { type: "string" }, description: "Australian suburb or postcode; defaults to Brisbane." },
          ],
          responses: { "200": { description: "Matches with highlights", content: { "application/json": { schema: { type: "object" } } } } },
        },
      },
    },
  });
}
