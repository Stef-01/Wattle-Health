// GET → the outreach queue as JSON: every doctor with gaps, the interview questions that fill
// them, and contact details from their own listing. Internal team tool; no emails are sent.
import { NextResponse } from "next/server";
import { outreachQueue } from "@/src/data/outreach";

export async function GET() {
  return NextResponse.json({ queue: await outreachQueue() });
}
