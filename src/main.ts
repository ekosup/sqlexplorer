import { SqlEngine } from './db/engine';
import { saveDb, loadSavedDb, clearSavedDb } from './db/persist';
import { mountFileLoader } from './ui/fileLoader';
import { mountSchemaBrowser } from './ui/schemaBrowser';
import { mountResultGrid } from './ui/resultGrid';
import { mountCaseStudyPanel } from './ui/caseStudyPanel';
import { mountStarterQueryPanel } from './ui/starterQueryPanel';
import { mountHistoryPanel } from './ui/historyPanel';
import { mountExplainPanel } from './ui/explainPanel';
import { mountGlossaryPanel } from './ui/glossaryPanel';
import { mountQueryEditor } from './editor/queryEditor';
import { formatSql } from './utils/sqlFormat';
// Tabler Icons via npm (bukan CDN) — Vite bundle woff2-nya, offline-safe (NFR-01).
import '@tabler/icons-webfont/dist/tabler-icons.min.css';
import { runStabilityTest, STABILITY_COUNT, type StabilityReport } from './stability/harness';
import { appendAudit, toTsv } from './db/audit';
import { mountAuditPanel } from './ui/auditPanel';

const engine = new SqlEngine();

const $ = (id: string): HTMLElement => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Elemen #${id} tidak ditemukan`);
  return el;
};

const dbStatus = $('db-status');
const editorSlot = $('query-editor');
const runBtn = $('run-query') as HTMLButtonElement;
const exportBtn = $('export-csv') as HTMLButtonElement;
const queryMeta = $('query-meta');

const editor = mountQueryEditor(editorSlot, { onRun: () => void runQuery() });

const panelWorkspace = $('panel-workspace');
const btnToggleEditor = $('btn-toggle-editor');
const editorToggleIcon = $('editor-toggle-icon');
const btnMaximizeEditor = $('btn-maximize-editor');
const editorMaximizeIcon = $('editor-maximize-icon');

const setEditorCollapsed = (collapsed: boolean): void => {
  if (collapsed) {
    panelWorkspace.classList.add('collapsed-editor');
    editorToggleIcon.className = 'ti ti-chevron-down';
    btnToggleEditor.title = 'Expand Editor';
  } else {
    panelWorkspace.classList.remove('collapsed-editor');
    editorToggleIcon.className = 'ti ti-chevron-up';
    btnToggleEditor.title = 'Minimize Editor';
    if (document.body.classList.contains('maximized-editor')) {
      setEditorMaximized(false);
    }
  }
};

const setEditorMaximized = (maximized: boolean): void => {
  if (maximized) {
    document.body.classList.add('maximized-editor');
    editorMaximizeIcon.className = 'ti ti-minimize';
    btnMaximizeEditor.title = 'Restore Editor';
    if (panelWorkspace.classList.contains('collapsed-editor')) {
      setEditorCollapsed(false);
    }
  } else {
    document.body.classList.remove('maximized-editor');
    editorMaximizeIcon.className = 'ti ti-maximize';
    btnMaximizeEditor.title = 'Maximize Editor';
  }
};

const setEditor = (sql: string): void => {
  setEditorCollapsed(false);
  editor.setValue(formatSql(sql));
  editor.focus();
};

const resultGrid = mountResultGrid($('result-grid'));
const explainPanel = mountExplainPanel($('explain-panel'));
const schemaBrowser = mountSchemaBrowser($('schema-browser'));
const caseStudy = mountCaseStudyPanel($('case-study-panel'), {
  onLoadQuery: setEditor,
  onExplain: (e) => explainPanel.set(e),
});
mountStarterQueryPanel($('starter-query-panel'), {
  onLoadQuery: setEditor,
  onExplain: (e) => explainPanel.set(e),
});
mountGlossaryPanel($('glossary-panel'));
const history = mountHistoryPanel($('history-panel'), { onPick: setEditor });

const auditPanel = mountAuditPanel($('audit-overlay'));
$('btn-audit').addEventListener('click', () => void auditPanel.open());

// Collapsible sidebars logic
const panelSchema = $('panel-schema');
const btnCollapseSchema = $('btn-collapse-schema');
const btnExpandSchema = $('btn-expand-schema');

btnCollapseSchema.addEventListener('click', () => {
  panelSchema.classList.add('collapsed');
});
btnExpandSchema.addEventListener('click', () => {
  panelSchema.classList.remove('collapsed');
});

const panelLearning = $('panel-learning');
const btnCollapseLearning = $('btn-collapse-learning');
const btnExpandLearning = $('btn-expand-learning');

btnCollapseLearning.addEventListener('click', () => {
  panelLearning.classList.add('collapsed');
});
btnExpandLearning.addEventListener('click', () => {
  panelLearning.classList.remove('collapsed');
});

// Theme toggle logic (Default: Light Mode)
const btnThemeToggle = $('btn-theme-toggle');
const currentTheme = localStorage.getItem('theme') || 'light';

if (currentTheme === 'dark') {
  document.documentElement.classList.add('dark-theme');
}

btnThemeToggle.addEventListener('click', () => {
  const isDark = document.documentElement.classList.toggle('dark-theme');
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
});

// Query Editor Toggle & Maximize Actions
btnToggleEditor.addEventListener('click', () => {
  const isCollapsed = panelWorkspace.classList.contains('collapsed-editor');
  setEditorCollapsed(!isCollapsed);
});

btnMaximizeEditor.addEventListener('click', () => {
  const isMaximized = document.body.classList.contains('maximized-editor');
  setEditorMaximized(!isMaximized);
});

// Query Editor Resizing
const resizeHandle = $('editor-resize-handle');
let isResizing = false;

resizeHandle.addEventListener('mousedown', (e) => {
  e.preventDefault();
  isResizing = true;
  resizeHandle.classList.add('active');
  document.body.style.cursor = 'row-resize';
});

document.addEventListener('mousemove', (e) => {
  if (!isResizing) return;
  const workspaceRect = panelWorkspace.getBoundingClientRect();
  const titleRect = panelWorkspace.querySelector('.panel-title')!.getBoundingClientRect();
  const relativeY = e.clientY - workspaceRect.top;
  
  const titleHeight = titleRect.height;
  const minHeight = 60;
  const maxHeight = workspaceRect.height - titleHeight - 120;
  
  let newHeight = relativeY - titleHeight;
  if (newHeight < minHeight) newHeight = minHeight;
  if (newHeight > maxHeight) newHeight = maxHeight;
  
  editorSlot.style.height = `${newHeight}px`;
});

document.addEventListener('mouseup', () => {
  if (isResizing) {
    isResizing = false;
    resizeHandle.classList.remove('active');
    document.body.style.cursor = '';
  }
});

// T18: stability test harness (QA tool, disabled sampai DB dimuat).
const btnStability = $('btn-stability') as HTMLButtonElement;
const testOverlay = $('test-overlay');
const testClose = $('test-close');
const testSummary = $('test-summary');
const testDetail = $('test-detail');
let dbLoaded = false;
let currentDbName = '';

// Dipakai ulang oleh upload baru maupun restore saat startup.
// Function declaration agar hoisted; semua const/let di bawah sudah ter-init sebelum dipanggil.
async function loadDbBytes(name: string, bytes: Uint8Array): Promise<void> {
  dbStatus.textContent = `Memuat ${name}…`;
  dbStatus.classList.remove('error', 'ok');
  try {
    await engine.loadDb(bytes);
    dbStatus.textContent = `${name} · ${(bytes.byteLength / 1024).toFixed(1)} KB`;
    dbStatus.classList.add('ok');
    caseStudy.setLoadedDbName(name);
    currentDbName = name;
    const schema = await engine.getSchema();
    schemaBrowser.render(schema);
    editor.updateSchema(schema);
    panelSchema.classList.add('db-loaded');
    dbLoaded = true;
    btnStability.disabled = false;
  } catch (err) {
    dbStatus.textContent = `Gagal memuat: ${(err as Error).message}`;
    dbStatus.classList.add('error');
    throw err;
  }
}

mountFileLoader($('file-loader'), {
  onLoad: async (file) => {
    const arrayBuf = await file.arrayBuffer();
    try {
      await loadDbBytes(file.name, new Uint8Array(arrayBuf));
      // Upload baru menimpa entry tersimpan → DB lama hilang, DB baru persist.
      await saveDb(file.name, arrayBuf);
    } catch {
      // status error sudah di-set oleh loadDbBytes.
    }
  },
  onClear: async () => {
    if (!confirm('Hapus database tersimpan? Refresh berikutnya kembali ke kondisi kosong.')) return;
    await clearSavedDb();
    location.reload();
  },
});

let lastRows: unknown[][] = [];
let lastCols: string[] = [];

const runQuery = async (): Promise<void> => {
  const sql = editor.getValue().trim();
  if (!sql) return;
  
  const wasMaximized = document.body.classList.contains('maximized-editor');
  if (wasMaximized) {
    setEditorMaximized(false);
  }
  
  // Collapse editor to focus on results
  setEditorCollapsed(true);
  
  queryMeta.textContent = 'Menjalankan…';
  queryMeta.classList.remove('error');
  const t0 = performance.now();
  try {
    const result = await engine.execQuery(sql);
    const ms = Math.round(performance.now() - t0);
    lastCols = result.columns;
    lastRows = result.values;
    resultGrid.render(result.columns, result.values);
    queryMeta.textContent = `${result.values.length} baris · ${ms} ms`;
    exportBtn.disabled = result.values.length === 0;
    history.push(sql);
    // Audit (best-effort; IDB error tidak boleh ganggu UX query). Hanya saat DB aktif.
    if (dbLoaded) void appendAudit({
      ts: Date.now(), dbName: currentDbName, sql, ms,
      rowCount: result.values.length, text: toTsv(result.columns, result.values),
    }).catch(() => {});
  } catch (err) {
    const ms = Math.round(performance.now() - t0);
    queryMeta.textContent = (err as Error).message;
    queryMeta.classList.add('error');
    resultGrid.clear();
    exportBtn.disabled = true;
    if (dbLoaded) void appendAudit({
      ts: Date.now(), dbName: currentDbName, sql, ms, rowCount: 0, text: '',
      error: (err as Error).message,
    }).catch(() => {});
    
    // If query failed, expand again so the user can fix the error
    setEditorCollapsed(false);
    if (wasMaximized) {
      setEditorMaximized(true);
    }
  }
};

runBtn.addEventListener('click', () => void runQuery());

exportBtn.addEventListener('click', () => {
  if (!lastCols.length) return;
  const csv = toCsv(lastCols, lastRows);
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `result-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
});

const toCsv = (cols: string[], rows: unknown[][]): string => {
  const esc = (v: unknown): string => {
    if (v == null) return '';
    const s = String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.map(esc).join(','), ...rows.map((r) => r.map(esc).join(','))].join('\n');
};

const escHtml = (s: string): string =>
  s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!);

const renderStabilitySummary = (r: StabilityReport): string => {
  const pass = r.workerAlive && r.failed === 0;
  return `<div class="${pass ? 'ok' : 'error'}"><b>${pass ? 'LULUS' : 'GAGAL'}</b> · ${r.passed}/${r.rows.length} sesuai ekspektasi · ${r.totalMs} ms · worker ${r.workerAlive ? 'hidup' : 'MATI'}</div>`;
};

const renderStabilityDetail = (r: StabilityReport): string => `
  <table class="result">
    <thead><tr><th>#</th><th>Skenario</th><th>Ekspektasi</th><th>Hasil</th><th>ms</th><th>Catatan</th></tr></thead>
    <tbody>
      ${r.rows.map((row, i) => `<tr>
        <td>${i + 1}</td><td>${escHtml(row.label)}</td><td>${row.expect}</td>
        <td class="${row.match ? 'ok' : 'error'}">${row.match ? '✓ sesuai' : '✗ ' + row.got}</td>
        <td>${row.ms}</td><td>${escHtml(row.detail ?? '')}</td>
      </tr>`).join('')}
    </tbody>
  </table>`;

btnStability.addEventListener('click', async () => {
  if (!dbLoaded) return;
  btnStability.disabled = true;
  queryMeta.textContent = `Menjalankan uji stabilitas (${STABILITY_COUNT} query)…`;
  queryMeta.classList.remove('error');
  const report = await runStabilityTest(engine);
  testSummary.innerHTML = renderStabilitySummary(report);
  testDetail.innerHTML = renderStabilityDetail(report);
  testOverlay.hidden = false;
  const pass = report.workerAlive && report.failed === 0;
  queryMeta.textContent = `Uji stabilitas: ${report.passed}/${report.rows.length} · ${report.totalMs} ms${report.workerAlive ? '' : ' · WORKER MATI'}`;
  queryMeta.classList.toggle('error', !pass);
  btnStability.disabled = false;
});

testClose.addEventListener('click', () => { testOverlay.hidden = true; });
testOverlay.addEventListener('click', (e) => { if (e.target === testOverlay) testOverlay.hidden = true; });

// Restore DB tersimpan saat startup — selamat dari refresh.
// Hilang hanya via tombol "Clear DB" atau upload file baru.
void (async () => {
  const saved = await loadSavedDb();
  if (!saved) return;
  try {
    await loadDbBytes(saved.name, new Uint8Array(saved.bytes));
  } catch {
    // ponytail: entry korup/tak terbaca → bersihkan agar startup berikutnya bersih.
    await clearSavedDb();
  }
})();
