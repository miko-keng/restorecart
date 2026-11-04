import test from "node:test";
import assert from "node:assert/strict";
import { assessClaims } from "../server/restorecart/claims";
import {
  mergeVerification,
  verifyClaims,
} from "../server/restorecart/claimVerifier";
import { openRC, createIncident } from "../server/restorecart/store";
import {
  addSample,
  sourceList,
  checkEvidence,
  deterministicCandidates,
} from "../server/restorecart/sources";
import { assist } from "../server/restorecart/assistant";
import { readSavedReview } from "../server/restorecart/reviewRecord";
const source = {
  id: "stock",
  mime: "text/csv",
  text: "sku,name,description,price\nBLUE,Blue mug,Blue stoneware mug,20.00\nRED,Red mug,Red ceramic mug,18.00",
};
const products = [
  {
    sku: "BLUE",
    candidates: [{ field: "price", sourceId: "stock", value: "20.00" }],
  },
];
const claim = (extra: any = {}) => ({
  sku: "BLUE",
  field: "description",
  value: "Blue stoneware mug",
  sourceId: "stock",
  excerpt: "Blue stoneware mug",
  ...extra,
});
test("Claim checks reject invented properties despite a real citation and isolate SKU rows", () => {
  assert.equal(
    assessClaims([claim()], products, [source])[0].status,
    "supported",
  );
  assert.equal(
    assessClaims(
      [claim({ value: "Dishwasher-safe blue stoneware mug" })],
      products,
      [source],
    )[0].status,
    "insufficient_evidence",
  );
  const wrong = assessClaims(
    [claim({ value: "Red ceramic mug", excerpt: "Red ceramic mug" })],
    products,
    [source],
  )[0];
  assert.equal(wrong.hardBlock, true);
  assert.equal(wrong.status, "insufficient_evidence");
  assert.equal(
    assessClaims([claim({ sourceId: "fabricated" })], products, [source])[0]
      .hardBlock,
    true,
  );
});
test("Column mapping and price conflicts cannot be overruled by a verifier", () => {
  const mapped = {
    id: "mapped",
    mime: "text/csv",
    columnMapping: { sku: "code", description: "notes" },
    text: "code,notes\nBLUE,Blue stoneware mug",
  };
  assert.equal(
    assessClaims([claim({ sourceId: "mapped" })], products, [mapped])[0].status,
    "supported",
  );
  const p = [
    {
      ...products[0],
      candidates: [
        ...products[0].candidates,
        { field: "price", sourceId: "old", value: "18.00" },
      ],
    },
  ];
  const findings = assessClaims(
    [claim({ field: "price", value: "20.00", excerpt: "20.00" })],
    p,
    [source],
  );
  assert.equal(findings[0].status, "conflicting");
  assert.equal(
    mergeVerification(findings, [
      { index: 0, status: "supported", reason: "Guess latest price" },
    ])[0].status,
    "conflicting",
  );
});
test("Photo existence alone is not visual variant proof; unknown image is a hard block", () => {
  const photo = { id: "photo", mime: "image/png", text: "", name: "BLUE.png" };
  const finding = assessClaims(
    [claim({ field: "imageSourceId", value: "photo", sourceId: "photo" })],
    products,
    [photo],
  )[0];
  assert.equal(finding.status, "insufficient_evidence");
  assert.equal(
    assessClaims(
      [claim({ field: "imageSourceId", value: "outside", sourceId: "photo" })],
      products,
      [photo],
    )[0].hardBlock,
    true,
  );
});
test("Independent verifier validates full index coverage and rejects injected extra fields", async () => {
  const input = {
    claims: [claim()],
    products,
    sources: [source],
    images: [],
    model: "test",
    key: "test",
  };
  for (const findings of [
    [],
    [{ index: 1, status: "supported", reason: "x" }],
    [{ index: 0, status: "supported", reason: "x", publish: true }],
  ]) {
    await assert.rejects(
      verifyClaims({
        ...input,
        transport: (async () =>
          Response.json({
            candidates: [
              { content: { parts: [{ text: JSON.stringify({ findings }) }] } },
            ],
          })) as typeof fetch,
      }),
    );
  }
});
test("Reconstruction strips an invented description while retaining source-backed fields", async () => {
  const db = openRC(":memory:");
  try {
    const shop = createIncident(db);
    await addSample(db, shop.id);
    const sources = sourceList(db, shop.id);
    const p: any = deterministicCandidates(sources)[0];
    const row = {
      sku: p.sku,
      name: p.name,
      description: "Dishwasher-safe guaranteed",
      candidates: p.candidates,
    };
    assert.equal(checkEvidence([row], sources)[0].description, "");
    row.description = p.description;
    assert.equal(checkEvidence([row], sources)[0].description, p.description);
  } finally {
    db.close();
  }
});
test("Review catches unsupported wording and saved replay preserves non-applicable conflicts", async () => {
  const db = openRC(":memory:");
  try {
    const shop = createIncident(db);
    await addSample(db, shop.id);
    shop.products = deterministicCandidates(sourceList(db, shop.id));
    const { save } = await import("../server/restorecart/store");
    save(db, shop);
    const sid = sourceList(db, shop.id).find((s) => s.mime === "text/csv")!.id;
    const proposals = [
      claim({
        sku: "MUG-BLU",
        sourceId: sid,
        excerpt: "A blue stoneware mug",
        value: "Dishwasher-safe",
      }),
      claim({
        sku: "MUG-BLU",
        field: "price",
        sourceId: sid,
        excerpt: "20.00",
        value: "20.00",
      }),
    ];
    const r = await assist(db, shop.id, "review", undefined, (async () =>
      Response.json({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    summary: "Review",
                    suggestions: proposals.map((p) => ({
                      ...p,
                      reason: "source",
                    })),
                    questions: [],
                  }),
                },
              ],
            },
          },
        ],
      })) as typeof fetch);
    assert.equal(r.omittedSuggestions, 1);
    assert.equal(r.suggestions.length, 1);
    assert.equal(r.suggestions[0].applicable, false);
    assert.equal(
      readSavedReview(db, shop.id)!.suggestions[0].applicable,
      false,
    );
  } finally {
    db.close();
  }
});

test("Exact JSON and CSV row citations tolerate quote escaping without accepting another variant", () => {
  const row = {
    sku: "BLUE",
    name: "Blue mug",
    description: "Blue stoneware mug",
    price: "20.00",
  };
  const json = JSON.stringify(row);
  for (const excerpt of [
    json,
    json.replaceAll('"', '\\"'),
    "BLUE,Blue mug,Blue stoneware mug,20.00",
  ]) {
    assert.equal(
      assessClaims([claim({ excerpt })], products, [source])[0].status,
      "supported",
    );
  }
});

test("Verifier enforcement/shadow/outage preserve guards, shared quota and saved-review decisions", async () => {
  const old = process.env.RESTORECART_AI_VERIFIER;
  try {
    for (const mode of ["enforce", "shadow", "unavailable"]) {
      process.env.RESTORECART_AI_VERIFIER =
        mode === "shadow" ? "shadow" : "enforce";
      const db = openRC(":memory:");
      try {
        const shop = createIncident(db);
        await addSample(db, shop.id);
        const sources = sourceList(db, shop.id);
        shop.products = deterministicCandidates(sources);
        const { save } = await import("../server/restorecart/store");
        save(db, shop);
        let calls = 0;
        const transport = (async (_url: any, init: any) => {
          calls++;
          const body = JSON.parse(init.body);
          if (calls === 1)
            return Response.json({
              candidates: [
                {
                  content: {
                    parts: [
                      {
                        text: JSON.stringify({
                          summary: "Review",
                          suggestions: [
                            {
                              sku: "MUG-BLU",
                              field: "description",
                              value: "Stoneware mug in blue",
                              sourceId: sources[0].id,
                              excerpt: "A blue stoneware mug",
                              reason: "Faithful paraphrase",
                            },
                          ],
                          questions: [],
                        }),
                      },
                    ],
                  },
                },
              ],
            });
          assert.match(
            body.systemInstruction.parts[0].text,
            /independent evidence verifier/,
          );
          if (mode === "unavailable") return new Response("", { status: 503 });
          return Response.json({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: JSON.stringify({
                        findings: [
                          {
                            index: 0,
                            status: "supported",
                            reason: "Faithful paraphrase of the exact SKU row",
                          },
                        ],
                      }),
                    },
                  ],
                },
              },
            ],
          });
        }) as typeof fetch;
        const answer = await assist(
          db,
          shop.id,
          "review",
          undefined,
          transport,
        );
        assert.equal(calls, 2);
        assert.equal(answer.suggestions.length, mode === "enforce" ? 1 : 0);
        assert.equal(
          readSavedReview(db, shop.id)!.suggestions.length,
          mode === "enforce" ? 1 : 0,
        );
        const cached = await assist(
          db,
          shop.id,
          "review",
          undefined,
          transport,
        );
        assert.equal(cached.cached, true);
        assert.equal(calls, 2);
      } finally {
        db.close();
      }
    }
  } finally {
    if (old === undefined) delete process.env.RESTORECART_AI_VERIFIER;
    else process.env.RESTORECART_AI_VERIFIER = old;
  }
});

test("A price from another SKU cannot validate a reconstruction even when the whole file is cited", () => {
  const p = {
    sku: "BLUE",
    name: "Blue mug",
    description: "",
    candidates: [
      {
        field: "price",
        value: "18.00",
        sourceId: "stock",
        location: "Row 2",
        excerpt: source.text,
      },
    ],
  };
  assert.throws(
    () => checkEvidence([p], [source]),
    /matching spreadsheet SKU row/,
  );
  const forged = [{ sku: "BLUE", candidates: p.candidates }];
  assert.equal(
    assessClaims(
      [
        claim({
          field: "price",
          value: "18.00",
          excerpt: "Blue stoneware mug",
        }),
      ],
      forged,
      [source],
    )[0].hardBlock,
    true,
  );
});
