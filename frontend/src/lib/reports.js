import { downloadCsvWithAuth } from "./downloads";

export function buildQueryFromParams(params) {
  const query = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value) query.set(key, value);
  });
  const value = query.toString();
  return value ? `?${value}` : "";
}

export async function exportReportCsv({ endpoint, filters, filenamePrefix }) {
  const query = buildQueryFromParams(filters);
  const stamp = new Date().toISOString().slice(0, 10);
  await downloadCsvWithAuth(`${endpoint}${query}`, `${filenamePrefix}-${stamp}.csv`);
}
