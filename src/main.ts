import { SqlEngine } from './db/engine';
import { saveDb, loadSavedDb, clearSavedDb } from './db/persist';
import { mountFileLoader } from './ui/fileLoader';
import { mountSchemaBrowser } from './ui/schemaBrowser';
import { mountResultGrid } from './ui/resultGrid';
import { mountChartView } from './ui/chartView';
import { mountImportPanel } from './ui/importPanel';
import { mountCaseStudyPanel } from './ui/caseStudyPanel';
import { mountStarterQueryPanel } from './ui/starterQueryPanel';
import { mountHistoryPanel } from './ui/historyPanel';
import { mountExplainPanel } from './ui/explainPanel';
import { mountReferencePanel } from './ui/referencePanel';
import { mountQueryEditor } from './editor/queryEditor';
import { formatSql } from './utils/sqlFormat';
// Tabler Icons via npm (bukan CDN) — Vite bundle woff2-nya, offline-safe (NFR-01).
import '@tabler/icons-webfont/dist/tabler-icons.min.css';
import { runStabilityTest, STABILITY_COUNT, type StabilityReport } from './stability/harness';
import { appendAudit, toTsv } from './db/audit';
import { mountAuditPanel } from './ui/auditPanel';
import { mountSaveQueryPanel } from './ui/saveQueryPanel';

const engine = new SqlEngine();

const $ = (id: string): HTMLElement => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Elemen #${id} tidak ditemukan`);
  return el;
};

const dbStatus = $('db-status');
const updateDbStatus = (text: string, statusClass?: 'ok' | 'error' | '') => {
  const textEl = dbStatus.querySelector('span');
  if (textEl) textEl.textContent = text;
  dbStatus.title = text;
  dbStatus.classList.remove('ok', 'error');
  if (statusClass) {
    dbStatus.classList.add(statusClass);
  }
};
const editorSlot = $('query-editor');
const runBtn = $('run-query') as HTMLButtonElement;
const exportBtn = $('export-csv') as HTMLButtonElement;
const saveQueryBtn = $('save-query') as HTMLButtonElement;
const queryMeta = $('query-meta');

const LOCAL_STORAGE_KEY = 'sqlexplorer_console_tabs';
type ConsoleTab = { id: number; name: string; sql: string; cols: string[]; rows: unknown[][]; meta: string; metaErr: boolean; canExport: boolean };
let tabs: ConsoleTab[] = [];
let activeId = 0;
let tabSeq = 0;

let saveTimeout: any = null;
const saveTabsToStorage = (): void => {
  try {
    const data = {
      tabs: tabs.map(t => ({
        id: t.id,
        name: t.name,
        sql: t.sql,
        meta: t.meta,
        metaErr: t.metaErr,
        canExport: t.canExport
      })),
      activeId,
      tabSeq,
    };
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('Failed to save tabs to storage', e);
  }
};

const saveTabsDebounced = (): void => {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    saveTabsToStorage();
  }, 300);
};

const editor = mountQueryEditor(editorSlot, {
  onRun: () => void runQuery(),
  onChange: (sql) => {
    const t = tabs.find((x) => x.id === activeId);
    if (t) {
      t.sql = sql;
      saveTabsDebounced();
    }
  }
});

const panelWorkspace = $('panel-workspace');
const btnToggleEditor = $('btn-toggle-editor');
const editorToggleIcon = $('editor-toggle-icon');
const btnMaximizeEditor = $('btn-maximize-editor');
const editorMaximizeIcon = $('editor-maximize-icon');
const btnMaximizeResults = $('btn-maximize-results');
const resultsMaximizeIcon = $('results-maximize-icon');

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

function setEditorMaximized(maximized: boolean): void {
  if (maximized) {
    if (document.body.classList.contains('maximized-results')) {
      setResultsMaximized(false);
    }
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
}

function setResultsMaximized(maximized: boolean): void {
  if (maximized) {
    if (document.body.classList.contains('maximized-editor')) {
      setEditorMaximized(false);
    }
    document.body.classList.add('maximized-results');
    resultsMaximizeIcon.className = 'ti ti-minimize';
    btnMaximizeResults.title = 'Restore Results';
  } else {
    document.body.classList.remove('maximized-results');
    resultsMaximizeIcon.className = 'ti ti-maximize';
    btnMaximizeResults.title = 'Maximize Results';
  }
}

const setEditor = (sql: string): void => {
  setEditorCollapsed(false);
  editor.setValue(formatSql(sql));
  editor.focus();
};

const resultGrid = mountResultGrid($('result-grid'));
const chartView = mountChartView($('chart-view'));
const resultHost = $('result-grid');
const chartHost = $('chart-view');
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
const referencePanel = mountReferencePanel($('reference-overlay'));
const history = mountHistoryPanel($('history-panel'), { onPick: setEditor });

const auditPanel = mountAuditPanel($('audit-overlay'));
$('btn-audit').addEventListener('click', () => void auditPanel.open());
$('btn-reference').addEventListener('click', () => void referencePanel.open());

const learningOverlay = $('learning-overlay');
$('btn-learning').addEventListener('click', () => {
  learningOverlay.hidden = false;
});
$('learning-close').addEventListener('click', () => {
  learningOverlay.hidden = true;
});
learningOverlay.addEventListener('click', (e) => {
  if (e.target === learningOverlay) {
    learningOverlay.hidden = true;
  }
});
$('learn-reference-launch').addEventListener('click', () => {
  learningOverlay.hidden = true;
  void referencePanel.open();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !learningOverlay.hidden) {
    learningOverlay.hidden = true;
  }
});

const saveQueryPanel = mountSaveQueryPanel($('save-query-overlay'));
saveQueryBtn.addEventListener('click', () => {
  const sql = editor.getValue().trim();
  if (!sql) {
    alert('Query kosong. Tulis query terlebih dahulu sebelum menyimpan.');
    return;
  }
  saveQueryPanel.open(sql);
});

// Import Excel/CSV → SQLite. DB tetap di worker; setelah import refresh schema + persist.
const importPanel = mountImportPanel($('import-overlay'), {
  onImport: async (tableName, columns, rows) => {
    await engine.importData(tableName, columns, rows);
    const schema = await engine.getSchema();
    schemaBrowser.render(schema);
    editor.updateSchema(schema);
    panelSchema.classList.add('db-loaded');
    dbLoaded = true;
    if (!currentDbName) { currentDbName = 'imported.sqlite'; caseStudy.setLoadedDbName(currentDbName); }
    if (btnStability) btnStability.disabled = false;
    // Persist hasil import agar selamat dari refresh.
    const bytes = await engine.exportDb();
    updateDbStatus(`${currentDbName} · ${(bytes.byteLength / 1024).toFixed(1)} KB`, 'ok');
    await saveDb(currentDbName, new Uint8Array(bytes).buffer);
    localStorage.setItem('sqlexplorer_has_saved_db', 'true');
  },
});
$('btn-import').addEventListener('click', () => importPanel.pick());

// Collapsible sidebars logic
const panelSchema = $('panel-schema');
if (localStorage.getItem('sqlexplorer_has_saved_db') === 'true') {
  panelSchema.classList.add('db-loaded');
}
const btnCollapseSchema = $('btn-collapse-schema');
const btnExpandSchema = $('btn-expand-schema');

btnCollapseSchema.addEventListener('click', () => {
  panelSchema.classList.add('collapsed');
});
btnExpandSchema.addEventListener('click', () => {
  panelSchema.classList.remove('collapsed');
});

const panelHistory = $('panel-history');
const btnCollapseHistory = $('btn-collapse-history');
const btnExpandHistory = $('btn-expand-history');

btnCollapseHistory.addEventListener('click', () => {
  panelHistory.classList.add('collapsed');
});
btnExpandHistory.addEventListener('click', () => {
  panelHistory.classList.remove('collapsed');
});

// Collapse Schema & History sidebars on narrow screens
let isNarrow = window.innerWidth <= 768;
if (isNarrow) {
  panelSchema.classList.add('collapsed');
  panelHistory.classList.add('collapsed');
}
window.addEventListener('resize', () => {
  const narrow = window.innerWidth <= 768;
  if (narrow && !isNarrow) {
    panelSchema.classList.add('collapsed');
    panelHistory.classList.add('collapsed');
  }
  isNarrow = narrow;
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

btnMaximizeResults.addEventListener('click', () => {
  const isMaximized = document.body.classList.contains('maximized-results');
  setResultsMaximized(!isMaximized);
});

// Query Editor Resizing
const resizeHandle = $('editor-resize-handle');
let isResizing = false;
let startY = 0;
let startHeight = 0;

resizeHandle.addEventListener('mousedown', (e) => {
  e.preventDefault();
  isResizing = true;
  startY = e.clientY;
  startHeight = editorSlot.getBoundingClientRect().height;
  resizeHandle.classList.add('active');
  document.body.style.cursor = 'row-resize';
  document.body.style.userSelect = 'none';
});

document.addEventListener('mousemove', (e) => {
  if (!isResizing) return;
  const deltaY = e.clientY - startY;
  const workspaceRect = panelWorkspace.getBoundingClientRect();
  const titleRect = panelWorkspace.querySelector('.panel-title')!.getBoundingClientRect();
  const titleHeight = titleRect.height;
  const minHeight = 60;
  const maxHeight = workspaceRect.height - titleHeight - 120;
  
  let newHeight = startHeight + deltaY;
  if (newHeight < minHeight) newHeight = minHeight;
  if (newHeight > maxHeight) newHeight = maxHeight;
  
  editorSlot.style.height = `${newHeight}px`;
});

document.addEventListener('mouseup', () => {
  if (isResizing) {
    isResizing = false;
    resizeHandle.classList.remove('active');
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }
});

// T18: stability test harness (QA tool, disabled sampai DB dimuat).
const btnStability = document.getElementById('btn-stability') as HTMLButtonElement | null;
const testOverlay = $('test-overlay');
const testClose = $('test-close');
const testSummary = $('test-summary');
const testDetail = $('test-detail');
let dbLoaded = false;
let currentDbName = '';

// Dipakai ulang oleh upload baru maupun restore saat startup.
// Function declaration agar hoisted; semua const/let di bawah sudah ter-init sebelum dipanggil.
async function loadDbBytes(name: string, bytes: Uint8Array): Promise<void> {
  updateDbStatus(`Memuat ${name}…`);
  try {
    await engine.loadDb(bytes);
    updateDbStatus(`${name} · ${(bytes.byteLength / 1024).toFixed(1)} KB`, 'ok');
    caseStudy.setLoadedDbName(name);
    currentDbName = name;
    const schema = await engine.getSchema();
    schemaBrowser.render(schema);
    editor.updateSchema(schema);
    panelSchema.classList.add('db-loaded');
    dbLoaded = true;
    if (btnStability) btnStability.disabled = false;
  } catch (err) {
    updateDbStatus(`Gagal memuat: ${(err as Error).message}`, 'error');
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
      localStorage.setItem('sqlexplorer_has_saved_db', 'true');
    } catch {
      // status error sudah di-set oleh loadDbBytes.
    }
  },
  onClear: async () => {
    if (!confirm('Hapus database tersimpan? Refresh berikutnya kembali ke kondisi kosong.')) return;
    await clearSavedDb();
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    localStorage.removeItem('sqlexplorer_has_saved_db');
    location.reload();
  },
});

// ---- Multi-console tabs (UI-only; logika query tetap sama, hanya state per-tab) ----
const tabsBar = $('editor-tabs');
let resultView: 'table' | 'chart' = 'table';

const activeTab = (): ConsoleTab => tabs.find((t) => t.id === activeId)!;

const renderTabs = (): void => {
  tabsBar.innerHTML = tabs.map((t) =>
    `<div class="etab${t.id === activeId ? ' active' : ''}" data-id="${t.id}" title="${escHtml(t.name)}">` +
      `<span class="etab-name">${escHtml(t.name)}</span>` +
      (tabs.length > 1 ? `<button class="etab-close" data-close="${t.id}" title="Tutup">×</button>` : '') +
    `</div>`).join('') +
    `<button class="etab-add" id="etab-add" type="button" title="Console baru"><i class="ti ti-plus"></i></button>`;
};

const showActiveResults = (): void => {
  const t = activeTab();
  if (resultView === 'chart') {
    chartHost.hidden = false; resultHost.hidden = true;
    chartView.render(t.cols, t.rows);
  } else {
    chartHost.hidden = true; resultHost.hidden = false;
    if (t.cols.length) resultGrid.render(t.cols, t.rows); else resultGrid.clear();
  }
};

const restoreActive = (): void => {
  const t = activeTab();
  editor.setValue(t.sql);
  queryMeta.textContent = t.meta;
  queryMeta.classList.toggle('error', t.metaErr);
  exportBtn.disabled = !t.canExport;
  showActiveResults();
};

const saveActive = (): void => { const t = tabs.find((x) => x.id === activeId); if (t) t.sql = editor.getValue(); };

const activateTab = (id: number): void => {
  saveActive(); activeId = id; renderTabs(); restoreActive(); editor.focus();
  saveTabsToStorage();
};

const addTab = (): void => {
  saveActive();
  const id = ++tabSeq;
  tabs.push({ id, name: `Console ${id}`, sql: '', cols: [], rows: [], meta: '', metaErr: false, canExport: false });
  activeId = id; renderTabs(); restoreActive(); editor.focus();
  saveTabsToStorage();
};

const closeTab = (id: number): void => {
  if (tabs.length <= 1) return;
  const idx = tabs.findIndex((t) => t.id === id);
  tabs = tabs.filter((t) => t.id !== id);
  if (activeId === id) activeId = tabs[Math.max(0, idx - 1)].id;
  renderTabs(); restoreActive();
  saveTabsToStorage();
};

tabsBar.addEventListener('click', (e) => {
  const target = e.target as HTMLElement;
  const closeBtn = target.closest<HTMLElement>('.etab-close');
  if (closeBtn) { e.stopPropagation(); closeTab(Number(closeBtn.dataset.close)); return; }
  if (target.closest('#etab-add')) { addTab(); return; }
  const tab = target.closest<HTMLElement>('.etab');
  if (tab) activateTab(Number(tab.dataset.id));
});

const viewTableBtn = $('view-table');
const viewChartBtn = $('view-chart');
const setView = (v: 'table' | 'chart'): void => {
  resultView = v;
  viewTableBtn.classList.toggle('active', v === 'table');
  viewChartBtn.classList.toggle('active', v === 'chart');
  showActiveResults();
};
viewTableBtn.addEventListener('click', () => setView('table'));
viewChartBtn.addEventListener('click', () => setView('chart'));

const loadTabsFromStorage = (): boolean => {
  try {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed.tabs) && parsed.tabs.length > 0) {
        tabs = parsed.tabs.map((t: any) => ({
          id: t.id,
          name: t.name || `Console ${t.id}`,
          sql: t.sql || '',
          cols: [],
          rows: [],
          meta: t.meta || '',
          metaErr: !!t.metaErr,
          canExport: !!t.canExport,
        }));
        activeId = parsed.activeId || tabs[0].id;
        tabSeq = parsed.tabSeq || Math.max(...tabs.map(t => t.id));
        return true;
      }
    }
  } catch (e) {
    console.error('Failed to load tabs from storage', e);
  }
  return false;
};

// bootstrap console pertama / restore dari storage
if (!loadTabsFromStorage()) {
  tabs.push({ id: ++tabSeq, name: 'Console 1', sql: '', cols: [], rows: [], meta: '', metaErr: false, canExport: false });
  activeId = tabSeq;
}
renderTabs();
restoreActive();

const runQuery = async (): Promise<void> => {
  const sql = editor.getValue().trim();
  if (!sql) return;
  const t = activeTab();

  const wasMaximized = document.body.classList.contains('maximized-editor');
  if (wasMaximized) {
    setEditorMaximized(false);
  }

  queryMeta.textContent = 'Menjalankan…';
  queryMeta.classList.remove('error');
  const t0 = performance.now();
  try {
    const result = await engine.execQuery(sql);
    const ms = Math.round(performance.now() - t0);
    t.cols = result.columns;
    t.rows = result.values;
    t.meta = `${result.values.length} baris · ${ms} ms`;
    t.metaErr = false;
    t.canExport = result.values.length > 0;
    queryMeta.textContent = t.meta;
    exportBtn.disabled = !t.canExport;
    showActiveResults();
    history.push(sql);
    saveTabsToStorage();
    // Audit (best-effort; IDB error tidak boleh ganggu UX query). Hanya saat DB aktif.
    if (dbLoaded) void appendAudit({
      ts: Date.now(), dbName: currentDbName, sql, ms,
      rowCount: result.values.length, text: toTsv(result.columns, result.values),
    }).catch(() => {});
  } catch (err) {
    const ms = Math.round(performance.now() - t0);
    t.cols = []; t.rows = []; t.canExport = false;
    t.meta = (err as Error).message; t.metaErr = true;
    queryMeta.textContent = t.meta;
    queryMeta.classList.add('error');
    showActiveResults();
    exportBtn.disabled = true;
    saveTabsToStorage();
    if (dbLoaded) void appendAudit({
      ts: Date.now(), dbName: currentDbName, sql, ms, rowCount: 0, text: '',
      error: (err as Error).message,
    }).catch(() => {});

    // Keep editor visible so the user can inspect or fix the query.
    setEditorCollapsed(false);
    if (wasMaximized) {
      setEditorMaximized(true);
    }
  }
};

runBtn.addEventListener('click', () => void runQuery());

exportBtn.addEventListener('click', () => {
  const t = activeTab();
  if (!t.cols.length) return;
  const csv = toCsv(t.cols, t.rows);
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

function escHtml(s: string): string {
  return s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!);
}

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

if (btnStability) {
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
}

testClose.addEventListener('click', () => { testOverlay.hidden = true; });
testOverlay.addEventListener('click', (e) => { if (e.target === testOverlay) testOverlay.hidden = true; });

// Restore DB tersimpan saat startup — selamat dari refresh.
// Hilang hanya via tombol "Clear DB" atau upload file baru.
void (async () => {
  const saved = await loadSavedDb();
  if (!saved) {
    panelSchema.classList.remove('db-loaded');
    localStorage.removeItem('sqlexplorer_has_saved_db');
    return;
  }
  try {
    await loadDbBytes(saved.name, new Uint8Array(saved.bytes));
    localStorage.setItem('sqlexplorer_has_saved_db', 'true');
  } catch {
    // ponytail: entry korup/tak terbaca → bersihkan agar startup berikutnya bersih.
    await clearSavedDb();
    panelSchema.classList.remove('db-loaded');
    localStorage.removeItem('sqlexplorer_has_saved_db');
  }
})();

// Network status handling for offline capabilities.
const networkStatusEl = $('network-status');
const updateNetworkStatus = (): void => {
  const iconEl = networkStatusEl.querySelector('i');
  const textEl = networkStatusEl.querySelector('span');
  if (navigator.onLine) {
    networkStatusEl.className = 'network-status online';
    networkStatusEl.title = 'Terhubung ke internet';
    if (iconEl) iconEl.className = 'ti ti-wifi';
    if (textEl) textEl.textContent = 'Online';
  } else {
    networkStatusEl.className = 'network-status offline';
    networkStatusEl.title = 'Bekerja secara offline';
    if (iconEl) iconEl.className = 'ti ti-wifi-off';
    if (textEl) textEl.textContent = 'Offline';
  }
};
window.addEventListener('online', updateNetworkStatus);
window.addEventListener('offline', updateNetworkStatus);
updateNetworkStatus();
