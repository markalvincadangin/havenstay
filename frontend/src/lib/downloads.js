import { API_BASE_URL } from './config';
import { ApiError } from './api';
import { buildPaginationQuery } from './pagination';

function getToken() {
  if (typeof window === 'undefined') {
    return null;
  }

  return localStorage.getItem('havenstay_token');
}

export async function downloadCsvWithAuth(path, fileName) {
  const token = getToken();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'GET',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!response.ok) {
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const body = await response.json();
      throw new ApiError(
        body?.message || 'CSV export failed.',
        response.status,
        body?.errors || null
      );
    }
    throw new ApiError('CSV export failed.', response.status);
  }

  const blob = await response.blob();
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(href);
}

/**
 * High-level helper for generating a CSV report download with authentication.
 *
 * @param {object} options
 * @param {string} options.endpoint - The API path (e.g. /api/reports/collections)
 * @param {object} [options.filters] - Key/value pairs for query parameters
 * @param {string} options.filenamePrefix - Base name for the generated file
 */
export async function exportReportCsv({
  endpoint,
  filters = {},
  filenamePrefix,
}) {
  // Use buildPaginationQuery to handle param mapping (null/undefined removal)
  const query = buildPaginationQuery(null, null, filters);
  const stamp = new Date().toISOString().slice(0, 10);
  await downloadCsvWithAuth(
    `${endpoint}${query}`,
    `${filenamePrefix}-${stamp}.csv`
  );
}
