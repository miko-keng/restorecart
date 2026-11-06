import { readFileSync, writeFileSync } from "node:fs";
const path = new URL(
  "../src/restorecart/fixtures/sample-order-chat.json",
  import.meta.url,
);
const fixture = JSON.parse(readFileSync(path, "utf8"));
const key = process.env.GEMINI_API_KEY;
if (!key)
  throw Error(
    "Set GEMINI_API_KEY to record a genuine response. Existing fixture unchanged.",
  );
const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const response = await fetch(
  `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
  {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            {
              text: JSON.stringify({
                order: fixture.order,
                prompt: fixture.prompt,
              }),
            },
          ],
        },
      ],
    }),
  },
);
if (!response.ok)
  throw Error(
    `Gemini returned HTTP ${response.status}; existing recording unchanged.`,
  );
const body = (await response.json()) as any;
const text = body.candidates?.[0]?.content?.parts
  ?.map((p: any) => p.text || "")
  .join("")
  .trim();
if (!text || body.candidates?.[0]?.finishReason !== "STOP")
  throw Error("No complete Gemini answer; existing recording unchanged.");
fixture.recording = {
  source: "gemini",
  model,
  generatedAt: new Date().toISOString(),
  text,
  input: { order: fixture.order, prompt: fixture.prompt },
};
writeFileSync(path, JSON.stringify(fixture, null, 2) + "\n");
console.log(
  "Saved genuine Gemini answer. Rebuild to include the token-free replay.",
);
