// The person's health context, kept on this device only (localStorage). Items are what Wattle read
// from a summary they pasted (for example one ChatGPT wrote); each can be switched off. Searches
// add the switched-on items' words to the sentence, and the summary screen says so.
export type ContextItem = { id: string; label: string; kind: string; phrase: string; on: boolean };
export type HealthContext = { text: string; items: ContextItem[]; source: "chatgpt" | "typed"; updatedAt: string };

const KEY = "wattle.context.v1";

export function getContext(): HealthContext | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as HealthContext) : null;
  } catch {
    return null;
  }
}

export function setContext(c: HealthContext | null): void {
  try {
    if (c) localStorage.setItem(KEY, JSON.stringify(c));
    else localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable */
  }
}

/** Words to add to a search, from switched-on items not already in the sentence. */
export function contextPhrases(sentence: string): { phrases: string[]; labels: string[] } {
  const c = getContext();
  if (!c) return { phrases: [], labels: [] };
  const lower = sentence.toLowerCase();
  const on = c.items.filter((i) => i.on && !lower.includes(i.phrase.toLowerCase()));
  return { phrases: on.map((i) => i.phrase), labels: on.map((i) => i.label) };
}

/** The prompt a person copies into ChatGPT to get a summary Wattle can read. */
export const CHATGPT_PROMPT = `From what you know about me, write a short health context for finding a doctor in Australia. Use plain sentences, no more than 120 words. Include, only if you know them: health conditions or symptoms I've mentioned, who the care is for, my age range, whether I prefer telehealth or in person, any preference for a doctor's gender or language, and how I like doctors to work with me (for example: listens, explains things plainly, longer appointments, lived experience). Leave out my name, addresses, medicines, test results and anything I haven't told you.`;
