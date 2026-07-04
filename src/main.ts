import { SqlEngine } from './db/engine';
import { mountFileLoader } from './ui/fileLoader';
import { mountSchemaBrowser } from './ui/schemaBrowser';
import { mountResultGrid } from './ui/resultGrid';
import { mountCaseStudyPanel } from './ui/caseStudyPanel';
import { mountStarterQueryPanel } from './ui/starterQueryPanel';
import { mountHistoryPanel } from './ui/historyPanel';
import { mountExplainPanel } from './ui/explainPanel';
import { mountGlossaryPanel } from './ui/glossaryPanel';

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

// ponytail: editor pakai <textarea> dulu. Ganti ke CodeMirror di T6 (FR-03 syntax highlight).
const textarea = document.createElement('textarea');
textarea.style.cssText = 'width:100%;height:100%;border:0;outline:0;resize:none;font:inherit;';
textarea.placeholder = 'Tulis query SELECT di sini, contoh:\nSELECT name FROM sqlite_master WHERE type = "table";';
textarea.setAttribute('aria-label', 'Editor SQL');
editorSlot.appendChild(textarea);

const setEditor = (sql: string): void => {
  textarea.value = sql;
  textarea.focus();
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

mountFileLoader($('file-loader'), {
  onLoad: async (file) => {
    dbStatus.textContent = `Memuat ${file.name}…`;
    dbStatus.classList.remove('error', 'ok');
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      await engine.loadDb(bytes);
      const kb = (file.size / 1024).toFixed(1);
      dbStatus.textContent = `${file.name} · ${kb} KB`;
      dbStatus.classList.add('ok');
      caseStudy.setLoadedDbName(file.name);
      schemaBrowser.render(await engine.getSchema());
      panelSchema.classList.add('db-loaded');
    } catch (err) {
      dbStatus.textContent = `Gagal memuat: ${(err as Error).message}`;
      dbStatus.classList.add('error');
    }
  },
});

let lastRows: unknown[][] = [];
let lastCols: string[] = [];

const runQuery = async (): Promise<void> => {
  const sql = textarea.value.trim();
  if (!sql) return;
  queryMeta.textContent = 'Menjalankan…';
  queryMeta.classList.remove('error');
  try {
    const t0 = performance.now();
    const result = await engine.execQuery(sql);
    const ms = Math.round(performance.now() - t0);
    lastCols = result.columns;
    lastRows = result.values;
    resultGrid.render(result.columns, result.values);
    queryMeta.textContent = `${result.values.length} baris · ${ms} ms`;
    exportBtn.disabled = result.values.length === 0;
    history.push(sql);
  } catch (err) {
    queryMeta.textContent = (err as Error).message;
    queryMeta.classList.add('error');
    resultGrid.clear();
    exportBtn.disabled = true;
  }
};

runBtn.addEventListener('click', () => void runQuery());
textarea.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
    e.preventDefault();
    void runQuery();
  }
});

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
