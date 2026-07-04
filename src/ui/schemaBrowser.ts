import type { TableSchema } from '../db/types';

export type SchemaBrowserApi = { render: (schema: TableSchema[]) => void };

export const mountSchemaBrowser = (host: HTMLElement): SchemaBrowserApi => {
  const render = (schema: TableSchema[]): void => {
    if (schema.length === 0) {
      host.innerHTML = '<div class="muted">Belum ada tabel.</div>';
      return;
    }
    host.innerHTML = schema
      .map((t) => `
        <details>
          <summary><b>${escapeHtml(t.name)}</b> <small>(${t.columns.length} kolom)</small></summary>
          <ul style="margin:4px 0 8px 16px;padding:0;">
            ${t.columns
              .map((c) => `<li>${escapeHtml(c.name)} <small style="color:#888">${escapeHtml(c.type)}${c.pk ? ' · PK' : ''}</small></li>`)
              .join('')}
          </ul>
        </details>`)
      .join('');
  };
  render([]);
  return { render };
};

const escapeHtml = (s: string): string =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
