// FR-03 result grid. ponytail: render maks 500 baris pertama (NFR-03), banner "…lebih banyak" kalau kepotong.

const MAX_RENDER = 500;

export type ResultGridApi = {
  render: (cols: string[], rows: unknown[][]) => void;
  clear: () => void;
};

export const mountResultGrid = (host: HTMLElement): ResultGridApi => {
  const clear = (): void => { host.innerHTML = ''; };

  const render = (cols: string[], rows: unknown[][]): void => {
    if (cols.length === 0) {
      host.innerHTML = '<div class="muted">Query tidak mengembalikan hasil.</div>';
      return;
    }
    const shown = rows.slice(0, MAX_RENDER);
    const banner = rows.length > MAX_RENDER
      ? `<div class="muted" style="padding:6px 8px;">Menampilkan ${MAX_RENDER} dari ${rows.length} baris. Export CSV untuk seluruh data.</div>`
      : '';
    host.innerHTML = banner + `
      <table class="result">
        <thead><tr>${cols.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead>
        <tbody>
          ${shown.map((r) => `<tr>${r.map((v) => `<td>${esc(v)}</td>`).join('')}</tr>`).join('')}
        </tbody>
      </table>`;
  };

  clear();
  return { render, clear };
};

const esc = (v: unknown): string => {
  if (v == null) return '<span style="color:#aaa">NULL</span>';
  return String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
};
