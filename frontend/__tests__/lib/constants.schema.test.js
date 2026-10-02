import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
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
} from '../../src/lib/constants';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadSchemaSql() {
  const candidates = [
    process.env.SCHEMA_PATH,
    path.join(__dirname, '../../../backend/database/sql/havenstay_schema.sql'),
    path.join(__dirname, '../../../../db/havenstay_schema.sql'),
    path.join(process.cwd(), '../backend/database/sql/havenstay_schema.sql'),
    path.join(process.cwd(), '../db/havenstay_schema.sql'),
    path.join(process.cwd(), 'database/sql/havenstay_schema.sql'),
    path.join(__dirname, '../../database/sql/havenstay_schema.sql'),
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return readFileSync(candidate, 'utf8');
    }
  }
  return null;
}

/** Pull ENUM('a','b') values for a column inside a CREATE TABLE block. */
function extractColumnEnum(sql, tableName, columnName) {
  if (!sql) return [];
  const block = sql.match(
    new RegExp(
      `CREATE TABLE\\s+${tableName}\\s*\\(([\\s\\S]*?)\\)\\s*ENGINE`,
      'i'
    )
  );
  if (!block) {
    throw new Error(`Could not find CREATE TABLE ${tableName}`);
  }
  const inner = block[1];
  const col = inner.match(
    new RegExp(`\\b${columnName}\\s+ENUM\\(([^)]+)\\)`, 'i')
  );
  if (!col) {
    throw new Error(`Could not find ENUM for ${tableName}.${columnName}`);
  }
  return col[1].split(',').map((s) => s.trim().replace(/^'|'$/g, ''));
}

function expectKeysMatchEnum(labelMap, enumValues, name) {
  const keys = Object.keys(labelMap).sort();
  const sortedEnum = [...enumValues].sort();
  expect(keys, `${name} keys`).toEqual(sortedEnum);
}

describe('constants.js vs db/havenstay_schema.sql ENUMs', () => {
  const sql = loadSchemaSql();
  const hasSql = Boolean(sql);

  it.runIf(hasSql)('METHOD_LABELS keys match payments.payment_method', () => {
    expectKeysMatchEnum(
      METHOD_LABELS,
      extractColumnEnum(sql, 'payments', 'payment_method'),
      'METHOD_LABELS'
    );
  });

  it.runIf(hasSql)('TENANT_STATUS_LABELS keys match tenants.status', () => {
    expectKeysMatchEnum(
      TENANT_STATUS_LABELS,
      extractColumnEnum(sql, 'tenants', 'status'),
      'TENANT_STATUS_LABELS'
    );
  });

  it.runIf(hasSql)('ROOM_TYPE_LABELS keys match rooms.room_type', () => {
    expectKeysMatchEnum(
      ROOM_TYPE_LABELS,
      extractColumnEnum(sql, 'rooms', 'room_type'),
      'ROOM_TYPE_LABELS'
    );
  });

  it.runIf(hasSql)('ROOM_STATUS_LABELS keys match rooms.status', () => {
    expectKeysMatchEnum(
      ROOM_STATUS_LABELS,
      extractColumnEnum(sql, 'rooms', 'status'),
      'ROOM_STATUS_LABELS'
    );
  });

  it.runIf(hasSql)('BED_STATUS_LABELS keys match bed_spaces.status', () => {
    expectKeysMatchEnum(
      BED_STATUS_LABELS,
      extractColumnEnum(sql, 'bed_spaces', 'status'),
      'BED_STATUS_LABELS'
    );
  });

  it.runIf(hasSql)('CONTRACT_STATUS_LABELS keys match contracts.status', () => {
    expectKeysMatchEnum(
      CONTRACT_STATUS_LABELS,
      extractColumnEnum(sql, 'contracts', 'status'),
      'CONTRACT_STATUS_LABELS'
    );
  });

  it.runIf(hasSql)('BILLING_STATUS_LABELS keys match billing.status', () => {
    expectKeysMatchEnum(
      BILLING_STATUS_LABELS,
      extractColumnEnum(sql, 'billing', 'status'),
      'BILLING_STATUS_LABELS'
    );
  });

  it.runIf(hasSql)('BILLING_ITEM_TYPE_LABELS keys match billing_line_items.item_type', () => {
    expectKeysMatchEnum(
      BILLING_ITEM_TYPE_LABELS,
      extractColumnEnum(sql, 'billing_line_items', 'item_type'),
      'BILLING_ITEM_TYPE_LABELS'
    );
  });

  it.runIf(hasSql)('audit_logs.action is VARCHAR in schema; AUDIT_ACTION_LABELS are UI keys for free-form actions', () => {
    const block = sql.match(
      /CREATE TABLE\s+audit_logs\s*\([\s\S]*?\)\s*ENGINE/i
    );
    expect(block?.[0], 'audit_logs table').toBeTruthy();
    expect(block[0]).toMatch(/\baction\s+VARCHAR\s*\(\s*32\s*\)/i);
    expect(Object.keys(AUDIT_ACTION_LABELS).length).toBeGreaterThan(0);
  });
});
