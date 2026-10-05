/**
 * The one published demonstration record. A GET of its id runs the same
 * verifier as a POST. It is not a product and not a catalog of other ids.
 */
import record from "../../../protocol/examples/polygon-anchor-1.record.json" with { type: "json" };
import anchor from "../../../protocol/examples/polygon-anchor-1.anchor.json" with { type: "json" };

const ID = "polygon-anchor-1";
const URL = "https://authichain.com/protocol/examples/polygon-anchor-1";

function norm(value) {
  return String(value || "").trim().toLowerCase().replace(/\/+$/, "");
}

export function publishedRecord(raw) {
  const key = norm(raw);
  if (key !== ID && key !== URL) return null;
  return { record, anchor, source: "published_example" };
}
