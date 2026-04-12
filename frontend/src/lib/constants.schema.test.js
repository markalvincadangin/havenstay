import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  AUDIT_ACTION_LABELS,
  BED_STATUS_LABELS,
  BILLING_ITEM_TYPE_LABELS,
  BILLING_STATUS_LABELS,
  CONTRACT_STATUS_LABELS,
  METHOD_LABELS,
  ROOM_STATUS_LABELS,
  ROOM_TYPE_LABELS,
  TENANT_STATUS_LABELS,
  TX_LOG_STATUS_LABELS,
} from "./constants";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadSchemaSql() {
  const schemaPath = path.join(__dirname, "../../../backend/database/sql/havenstay_schema.sql");
  return readFileSync(schemaPath, "utf8");
}

/** Pull ENUM('a','b') values for a column inside a CREATE TABLE block. */
function extractColumnEnum(sql, tableName, columnName) {
  const block = sql.match(new RegExp(`CREATE TABLE\\s+${tableName}\\s*\\(([\\s\\S]*?)\\)\\s*ENGINE`, "i"));
  if (!block) {
    throw new Error(`Could not find CREATE TABLE ${tableName}`);
  }
  const inner = block[1];
  const col = inner.match(new RegExp(`\\b${columnName}\\s+ENUM\\(([^)]+)\\)`, "i"));
  if (!col) {
    throw new Error(`Could not find ENUM for ${tableName}.${columnName}`);
  }
  return col[1]
    .split(",")
    .map((s) => s.trim().replace(/^'|'$/g, ""));
}

function expectKeysMatchEnum(labelMap, enumValues, name) {
  const keys = Object.keys(labelMap).sort();
  const sortedEnum = [...enumValues].sort();
  expect(keys, `${name} keys`).toEqual(sortedEnum);
}

describe("constants.js vs db/havenstay_schema.sql ENUMs", () => {
  const sql = loadSchemaSql();

  it("METHOD_LABELS keys match payments.payment_method", () => {
    expectKeysMatchEnum(METHOD_LABELS, extractColumnEnum(sql, "payments", "payment_method"), "METHOD_LABELS");
  });

  it("TENANT_STATUS_LABELS keys match tenants.status", () => {
    expectKeysMatchEnum(TENANT_STATUS_LABELS, extractColumnEnum(sql, "tenants", "status"), "TENANT_STATUS_LABELS");
  });

  it("ROOM_TYPE_LABELS keys match rooms.room_type", () => {
    expectKeysMatchEnum(ROOM_TYPE_LABELS, extractColumnEnum(sql, "rooms", "room_type"), "ROOM_TYPE_LABELS");
  });

  it("ROOM_STATUS_LABELS keys match rooms.status", () => {
    expectKeysMatchEnum(ROOM_STATUS_LABELS, extractColumnEnum(sql, "rooms", "status"), "ROOM_STATUS_LABELS");
  });

  it("BED_STATUS_LABELS keys match bed_spaces.status", () => {
    expectKeysMatchEnum(BED_STATUS_LABELS, extractColumnEnum(sql, "bed_spaces", "status"), "BED_STATUS_LABELS");
  });

  it("CONTRACT_STATUS_LABELS keys match contracts.status", () => {
    expectKeysMatchEnum(CONTRACT_STATUS_LABELS, extractColumnEnum(sql, "contracts", "status"), "CONTRACT_STATUS_LABELS");
  });

  it("BILLING_STATUS_LABELS keys match billing.status", () => {
    expectKeysMatchEnum(BILLING_STATUS_LABELS, extractColumnEnum(sql, "billing", "status"), "BILLING_STATUS_LABELS");
  });

  it("BILLING_ITEM_TYPE_LABELS keys match billing_line_items.item_type", () => {
    expectKeysMatchEnum(
      BILLING_ITEM_TYPE_LABELS,
      extractColumnEnum(sql, "billing_line_items", "item_type"),
      "BILLING_ITEM_TYPE_LABELS",
    );
  });

  it("AUDIT_ACTION_LABELS keys match audit_logs.action", () => {
    expectKeysMatchEnum(AUDIT_ACTION_LABELS, extractColumnEnum(sql, "audit_logs", "action"), "AUDIT_ACTION_LABELS");
  });

  it("TX_LOG_STATUS_LABELS keys match transaction_logs.status", () => {
    expectKeysMatchEnum(TX_LOG_STATUS_LABELS, extractColumnEnum(sql, "transaction_logs", "status"), "TX_LOG_STATUS_LABELS");
  });
});
