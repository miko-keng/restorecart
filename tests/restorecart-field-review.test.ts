import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SupportingRecords } from "../src/restorecart/SupportingRecords";
import { FieldFindings } from "../src/restorecart/FieldFindings";
import {
  findingField,
  productStatus,
  normalizeStockInput,
  productSaveIssues,
} from "../src/restorecart/productReview";

const base = {
  product: { sku: "RED" },
  fields: { description: "A red mug" },
  sources: [{ id: "source-1", name: "stock.csv" }],
  change: () => {
    throw Error("Render must never change a field");
  },
  review: {
    stale: false,
    questions: [
      { sku: "BLUE", text: "Which price is correct: $18 or $20?" },
      {
        sku: "RED",
        text: "Which price is correct: $18 or $20?",
        sellerConfirmed: true,
        sellerResponse: "$18",
      },
    ],
    suggestions: [
      {
        sku: "RED",
        field: "description",
        value: "A red mug",
        sourceId: "source-1",
        reason: "From stock sheet",
        excerpt: "A red mug",
      },
    ],
  },
};
test("Findings stay with their own SKU and field; unchanged suggestions are hidden", () => {
  const description = renderToStaticMarkup(
    createElement(FieldFindings, { ...base, field: "description" }),
  );
  assert.equal(description, "");
  assert.doesNotMatch(description, /Which price|Use suggestion/);
  const price = renderToStaticMarkup(
    createElement(FieldFindings, { ...base, field: "price" }),
  );
  assert.equal((price.match(/Which price/g) || []).length, 1);
  assert.match(price, /Resolved/);
  assert.doesNotMatch(price, /A red mug/);
  assert.equal(
    renderToStaticMarkup(
      createElement(FieldFindings, { ...base, field: "name" }),
    ),
    "",
  );
});
test("Changed suggestions offer an action but stale results cannot be applied", () => {
  const changed = { ...base, fields: { description: "My description" } };
  const current = renderToStaticMarkup(
    createElement(FieldFindings, { ...changed, field: "description" }),
  );
  assert.match(current, /Use suggestion/);
  assert.doesNotMatch(current, /disabled/);
  const stale = renderToStaticMarkup(
    createElement(FieldFindings, {
      ...changed,
      review: { ...base.review, stale: true },
      field: "description",
    }),
  );
  assert.match(stale, /disabled/);
  assert.match(stale, /Earlier suggestion/);
});
test("Publishing labels reflect seller readiness, not AI suggestions", () => {
  assert.equal(productStatus({ status: "ready" }), "Ready to publish");
  assert.equal(
    productStatus({ status: "excluded", questions: ["Confirm stock"] }),
    "Hidden from shop",
  );
  assert.equal(
    productStatus({ questions: ["Confirm the physical stock count"] }),
    "Needs review · confirm stock",
  );
  assert.equal(
    productStatus({ questions: ["Explain which price is current"] }),
    "Needs review · choose the correct price",
  );
  assert.equal(findingField("Please confirm the photo"), "imageSourceId");
  assert.equal(findingField("Is this item still for sale?"), "general");
});

test("Stock editing permits clearing and replacement without leading zeros or invalid numeric syntax", () => {
  assert.equal(normalizeStockInput(""), "");
  assert.equal(normalizeStockInput("05"), "5");
  assert.equal(normalizeStockInput("00012"), "12");
  for (const invalid of ["-1", "1.5", "1e2", "abc"])
    assert.equal(normalizeStockInput(invalid), null);
});
test("Save guidance tracks current entries and blocks unresolved visible products", () => {
  const product = {
    candidates: [
      { field: "price", value: "18.00" },
      { field: "price", value: "20.00" },
    ],
  };
  const valid = {
    price: "20.00",
    quantity: "8",
    allocation: "3",
    confirm: true,
    resolutionNote: "Latest stock sheet",
    excluded: false,
  };
  assert.deepEqual(productSaveIssues(valid, product), []);
  assert.match(
    productSaveIssues({ ...valid, quantity: "" }, product).join(" "),
    /physical count/,
  );
  assert.match(
    productSaveIssues({ ...valid, quantity: "2" }, product).join(" "),
    /cannot exceed/,
  );
  assert.match(
    productSaveIssues({ ...valid, allocation: "0" }, product).join(" "),
    /at least 1/,
  );
  assert.match(
    productSaveIssues({ ...valid, resolutionNote: "" }, product).join(" "),
    /Resolve the price conflict/,
  );
  assert.deepEqual(
    productSaveIssues(
      {
        ...valid,
        excluded: true,
        quantity: "0",
        allocation: "0",
        confirm: false,
        price: "",
        resolutionNote: "",
      },
      product,
    ),
    [],
  );
});

test("Supporting records groups each file once, distinguishes citations and hides excerpts", () => {
  const markup = renderToStaticMarkup(
    createElement(SupportingRecords, {
      product: {
        sku: "RED",
        candidates: [
          {
            sourceId: "csv",
            field: "name",
            value: "Red mug",
            excerpt: "RED,Red mug,18",
          },
          {
            sourceId: "csv",
            field: "price",
            value: "18",
            excerpt: "RED,Red mug,18",
          },
          { sourceId: "pdf", field: "price", value: "20", excerpt: "RED | 20" },
        ],
      },
      sources: [
        { id: "csv", name: "stock.csv" },
        { id: "pdf", name: "catalog.pdf" },
      ],
      review: {
        suggestions: [{ sku: "RED", sourceId: "csv", excerpt: "Red mug" }],
      },
    }),
  );
  assert.match(markup, /Supporting records · 2 files/);
  assert.equal((markup.match(/<tr>/g) || []).length, 3);
  assert.match(markup, /Cited by Gemini/);
  assert.match(markup, /Imported record/);
  assert.match(markup, /Show excerpt/);
  assert.doesNotMatch(markup, /<details open/);
});
