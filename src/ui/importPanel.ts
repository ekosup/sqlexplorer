// Import Excel/CSV → tabel SQLite. Pilih sheet, preview, infer tipe kolom, lalu buat tabel.
// xlsx di-lazy-load (dynamic import) → hanya diunduh saat user benar-benar import.
import type * as XLSXType from 'xlsx';
import type { ImportColumn } from '../db/types';

let XLSX: typeof XLSXType | null = null;

export type ImportPanelApi = { open: (file: File) => void; pick: () => void };

type Opts = {
  onImport: (tableName: string, columns: ImportColumn[], rows: unknown[][]) => Promise<void>;
};

const PREVIEW_ROWS = 8;

const sanitizeName = (raw: string): string => {
  const s = raw.trim().replace(/[^A-Za-z0-9_]+/g, '_').replace(/^_+|_+$/g, '');
  return s || 'data';
};

// Normalisasi 1 cell: Date → ISO string, undefined → null.
const normCell = (v: unknown): unknown => {
  if (v === undefined) return null;
  if (v instanceof Date) return v.toISOString();
  return v;
};

export const inferType = (values: unknown[]): ImportColumn['type'] => {
  let allInt = true, allNum = true, hasVal = false;
  for (const v of values) {
    if (v == null || v === '') continue;
    hasVal = true;
    if (typeof v === 'number') { if (!Number.isInteger(v)) allInt = false; }
    else { allNum = false; allInt = false; break; }
  }
  if (!hasVal) return 'TEXT';
  return allInt ? 'INTEGER' : allNum ? 'REAL' : 'TEXT';
};

const esc = (v: unknown): string => {
  if (v == null) return '<span style="color:#aaa">·</span>';
  return String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
};

export const mountImportPanel = (overlay: HTMLElement, opts: Opts): ImportPanelApi => {
  let workbook: XLSXType.WorkBook | null = null;
  let sheetName = '';
  let useHeader = true;

  const $ = <T extends HTMLElement>(sel: string): T => overlay.querySelector<T>(sel)!;

  const close = (): void => { overlay.hidden = true; workbook = null; };

  // matrix mentah untuk sheet aktif (array of arrays)
  const sheetMatrix = (): unknown[][] => {
    if (!workbook || !XLSX) return [];
    const ws = workbook.Sheets[sheetName];
    if (!ws) return [];
    const m = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null, blankrows: false });
    return m.map((row) => row.map(normCell));
  };

  // { columns, rows } setelah menerapkan opsi header.
  const buildTable = (): { columns: ImportColumn[]; rows: unknown[][] } => {
    const m = sheetMatrix();
    if (m.length === 0) return { columns: [], rows: [] };
    const width = m.reduce((w, r) => Math.max(w, r.length), 0);
    const headerRow = useHeader ? m[0] : [];
    const dataRows = useHeader ? m.slice(1) : m;
    const names: string[] = [];
    const seen = new Set<string>();
    for (let i = 0; i < width; i++) {
      let name = sanitizeName(useHeader ? String(headerRow[i] ?? `col_${i + 1}`) : `col_${i + 1}`);
      let uniq = name, n = 2;
      while (seen.has(uniq.toLowerCase())) uniq = `${name}_${n++}`;
      seen.add(uniq.toLowerCase());
      names.push(uniq);
    }
    const columns: ImportColumn[] = names.map((name, i) => ({
      name,
      type: inferType(dataRows.map((r) => r[i])),
    }));
    const rows = dataRows.map((r) => { const out: unknown[] = []; for (let i = 0; i < width; i++) out[i] = r[i] ?? null; return out; });
    return { columns, rows };
  };

  const renderPreview = (): void => {
    const { columns, rows } = buildTable();
    const shown = rows.slice(0, PREVIEW_ROWS);
    const info = `${rows.length} baris · ${columns.length} kolom`;
    $('#imp-info').textContent = info;
    if (columns.length === 0) {
      $('#imp-preview').innerHTML = '<div class="muted">Sheet kosong.</div>';
      return;
    }
    $('#imp-preview').innerHTML = `
      <table class="result">
        <thead><tr>${columns.map((c) => `<th>${esc(c.name)}<br><span class="imp-type">${c.type}</span></th>`).join('')}</tr></thead>
        <tbody>${shown.map((r) => `<tr>${r.map((v) => `<td>${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody>
      </table>`;
  };

  const renderSheetTabs = (): void => {
    if (!workbook) return;
    $('#imp-sheets').innerHTML = workbook.SheetNames.map(
      (n) => `<button type="button" class="imp-sheet-btn${n === sheetName ? ' active' : ''}" data-sheet="${esc(n)}">${esc(n)}</button>`,
    ).join('');
  };

  const open = (file: File): void => {
    void file.arrayBuffer().then(async (buf) => {
      try {
        if (!XLSX) XLSX = await import('xlsx');
        workbook = XLSX.read(new Uint8Array(buf), { type: 'array', cellDates: true });
      } catch {
        alert('Gagal membaca file. Pastikan file Excel (.xlsx/.xls) atau CSV yang valid.');
        return;
      }
      if (workbook.SheetNames.length === 0) { alert('Tidak ada sheet di file ini.'); return; }
      sheetName = workbook.SheetNames[0];
      useHeader = true;
      ($('#imp-header') as HTMLInputElement).checked = true;
      ($('#imp-table-name') as HTMLInputElement).value = sanitizeName(
        workbook.SheetNames.length > 1 ? sheetName : file.name.replace(/\.[^.]+$/, ''),
      );
      renderSheetTabs();
      renderPreview();
      overlay.hidden = false;
    });
  };

  overlay.innerHTML = `
    <div class="test-overlay-card import-card">
      <div class="test-overlay-head">
        <b><i class="ti ti-file-spreadsheet"></i> Import Excel / CSV</b>
        <button id="imp-close" type="button" class="link-btn">Tutup</button>
      </div>
      <div class="import-body">
        <div class="import-config-card">
          <div class="import-config-grid">
            <div class="imp-field">
              <label><i class="ti ti-layers-union"></i> Pilih Sheet</label>
              <div id="imp-sheets" class="imp-sheets"></div>
            </div>
            <div class="imp-field">
              <label><i class="ti ti-forms"></i> Nama Tabel</label>
              <input id="imp-table-name" class="app-input" placeholder="nama_tabel" />
            </div>
          </div>
          <div class="import-config-footer">
            <label class="imp-check">
              <input type="checkbox" id="imp-header" checked />
              <span>Gunakan baris pertama sebagai header (nama kolom)</span>
            </label>
            <div id="imp-info" class="imp-info-badge"></div>
          </div>
        </div>
        
        <div class="import-preview-container">
          <div class="import-preview-title">
            <i class="ti ti-table"></i> Preview Data (Maksimal 8 Baris Pertama)
          </div>
          <div id="imp-preview" class="import-preview"></div>
        </div>
      </div>
      <div class="import-actions">
        <button id="imp-cancel" type="button" class="btn-secondary">Batal</button>
        <button id="imp-do" type="button" class="btn-primary"><i class="ti ti-database-import"></i> Import ke Database</button>
      </div>
    </div>`;

  $('#imp-close').addEventListener('click', close);
  $('#imp-cancel').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

  $('#imp-sheets').addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.imp-sheet-btn');
    if (!btn) return;
    sheetName = btn.dataset.sheet!;
    const nameInput = $('#imp-table-name') as HTMLInputElement;
    if (workbook && workbook.SheetNames.length > 1) nameInput.value = sanitizeName(sheetName);
    renderSheetTabs();
    renderPreview();
  });

  $('#imp-header').addEventListener('change', (e) => {
    useHeader = (e.target as HTMLInputElement).checked;
    renderPreview();
  });

  $('#imp-do').addEventListener('click', () => {
    const { columns, rows } = buildTable();
    if (columns.length === 0) { alert('Tidak ada data untuk diimport.'); return; }
    const tableName = sanitizeName(($('#imp-table-name') as HTMLInputElement).value);
    const doBtn = $('#imp-do') as HTMLButtonElement;
    doBtn.disabled = true;
    doBtn.textContent = 'Mengimport…';
    void opts.onImport(tableName, columns, rows)
      .then(() => close())
      .catch((err) => alert(`Gagal import: ${(err as Error).message}`))
      .finally(() => { doBtn.disabled = false; doBtn.innerHTML = '<i class="ti ti-database-import"></i> Import ke Database'; });
  });

  const pick = (): void => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    input.addEventListener('change', () => { const f = input.files?.[0]; if (f) open(f); });
    input.click();
  };

  return { open, pick };
};
