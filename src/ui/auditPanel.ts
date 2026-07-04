// Halaman audit: overlay berisi log hasil query (flat text), dengan export .txt & clear.
// Reuse pola .test-overlay dari uji stabilitas.

import { listAudit, clearAudit, toAuditText, type AuditEntry } from '../db/audit';

export type AuditPanelApi = { open: () => Promise<void> };

const esc = (s: string): string =>
  s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!);

const fmtTs = (ts: number): string => new Date(ts).toLocaleString('id-ID');

// ponytail: hanya tampilan yang dipotong — export .txt tetap full data.
const MAX_DISPLAY_ROWS = 10;

const renderEntry = (e: AuditEntry, i: number, total: number): string => {
  const meta = `#${total - i} · ${fmtTs(e.ts)} · DB: ${esc(e.dbName || '(tanpa nama)')} · ${e.rowCount} baris · ${e.ms} ms`;
  let body: string;
  if (e.error) {
    body = `<pre class="audit-error">${esc(e.error)}</pre>`;
  } else {
    const lines = (e.text || '(tidak ada baris)').split('\n');
    const header = lines[0] ?? '';
    const data = lines.slice(1);
    const shown = data.slice(0, MAX_DISPLAY_ROWS);
    const more = data.length > MAX_DISPLAY_ROWS
      ? `\n… +${data.length - MAX_DISPLAY_ROWS} baris lagi (lihat seluruhnya via Export .txt)`
      : '';
    body = `<pre class="audit-text">${esc(header + (shown.length ? '\n' + shown.join('\n') : '') + more)}</pre>`;
  }
  return `<div class="audit-entry">
    <div class="audit-meta">${meta}</div>
    <pre class="audit-sql">${esc(e.sql)}</pre>
    ${body}
  </div>`;
};

const download = (filename: string, text: string): void => {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

export const mountAuditPanel = (host: HTMLElement): AuditPanelApi => {
  const detail = host.querySelector<HTMLElement>('#audit-detail')!;
  const btnExport = host.querySelector<HTMLButtonElement>('#audit-export')!;
  const btnClear = host.querySelector<HTMLButtonElement>('#audit-clear')!;
  const btnClose = host.querySelector<HTMLButtonElement>('#audit-close')!;

  const render = (entries: AuditEntry[]): void => {
    if (entries.length === 0) {
      detail.innerHTML = '<div class="muted" style="padding:16px;">Belum ada audit. Jalankan query untuk mengisi log.</div>';
      return;
    }
    const total = entries.length;
    detail.innerHTML = entries.slice().reverse().map((e, i) => renderEntry(e, i, total)).join('');
  };

  const refresh = async (): Promise<void> => render(await listAudit());

  btnExport.addEventListener('click', async () => {
    const entries = await listAudit();
    if (!entries.length) return;
    download(`sqlexplorer-audit-${Date.now()}.txt`, toAuditText(entries));
  });

  btnClear.addEventListener('click', async () => {
    if (!confirm('Hapus seluruh audit log? Tindakan ini tidak bisa dibatalkan.')) return;
    await clearAudit();
    await refresh();
  });

  btnClose.addEventListener('click', () => { host.hidden = true; });
  host.addEventListener('click', (e) => { if (e.target === host) host.hidden = true; });

  return { open: async () => { host.hidden = false; await refresh(); } };
};
