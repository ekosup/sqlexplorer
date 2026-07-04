// FR-07/08 + T14-T16: case study full flow — list, detail, scenario picker,
// DB guidance + match indicator, explain, individual practice.
import raw from '../data/caseStudies.json';
import type { Explain } from './explainPanel';

type Scenario = {
  id: string; title: string; db?: string; query?: string;
  explanation?: string; practice?: string; explain?: Explain;
};
type CaseStudy = {
  id: string; title: string; description: string;
  scenario: Scenario[]; query: string; explanation: string;
};

export type CaseStudyPanelApi = { setLoadedDbName: (name: string) => void };

export const mountCaseStudyPanel = (
  host: HTMLElement,
  opts: { onLoadQuery: (sql: string) => void; onExplain: (e: Explain | null) => void },
): CaseStudyPanelApi => {
  const list = validate(raw as unknown[]);
  let loadedName = '';
  let current: CaseStudy | null = null;

  host.innerHTML = `
    <div class="subpanel-title">Case Study</div>
    <select id="cs-select" class="app-select">
      <option value="">— Pilih studi kasus —</option>
      ${list.map((c) => `<option value="${c.id}">${esc(c.title)}</option>`).join('')}
    </select>
    <div id="cs-detail"></div>`;

  const detail = host.querySelector<HTMLElement>('#cs-detail')!;

  const renderDetail = (activeScenarioId = ''): void => {
    if (!current) { detail.innerHTML = ''; return; }
    const active = current.scenario.find((s) => s.id === activeScenarioId);
    detail.innerHTML = `
      <div class="cs-title">${esc(current.title)}</div>
      <p class="muted cs-desc">${esc(current.description)}</p>

      <div class="cs-actions">
        <button id="cs-load-base" class="btn-secondary" type="button" style="width:100%;">
          <i class="ti ti-file-code"></i> Load query baseline
        </button>
      </div>

      ${current.scenario.length > 0 ? `
        <label class="cs-scenario-label">Scenario</label>
        <select id="cs-scenario" class="app-select">
          <option value="">— Pilih scenario —</option>
          ${current.scenario.map((s) => `<option value="${s.id}" ${s.id === activeScenarioId ? 'selected' : ''}>${esc(s.title)}</option>`).join('')}
        </select>
      ` : ''}

      <div id="cs-scenario-detail">${active ? renderScenario(active) : ''}</div>`;
    bindDetail();
  };

  const renderScenario = (s: Scenario): string => {
    const expected = s.db ?? 'sample-audit.sqlite';
    const match = loadedName ? (loadedName === expected ? 'ok' : 'warn') : 'idle';
    
    let matchIcon = 'ti-database';
    if (match === 'ok') matchIcon = 'ti-circle-check-filled';
    if (match === 'warn') matchIcon = 'ti-alert-triangle-filled';

    const matchText = match === 'ok'
      ? `DB cocok: ${esc(loadedName)}`
      : match === 'warn'
        ? `DB dimuat (${esc(loadedName)}) ≠ ${esc(expected)}. Gunakan database ${esc(expected)}.`
        : `Belum ada DB dimuat. Silakan pilih file ${esc(expected)}.`;
    return `
      <div class="cs-db cs-db-${match}">
        <div class="cs-db-header">
          <i class="ti ti-info-circle"></i> Database yang diharapkan
        </div>
        <div class="cs-db-name">
          <i class="ti ${matchIcon}"></i> ${esc(expected)}
        </div>
        <div class="cs-db-status-msg">${matchText}</div>
      </div>
      ${s.query ? `<button id="cs-load-scenario" type="button" class="btn-primary" style="width:100%; margin-bottom:12px;"><i class="ti ti-terminal-2"></i> Load query ke Editor</button>` : ''}
      ${s.explanation ? `<div class="cs-block"><div class="cs-block-title"><i class="ti ti-book-open"></i> Penjelasan</div><div class="muted">${esc(s.explanation)}</div></div>` : ''}
      ${s.practice ? `<div class="cs-block cs-practice"><div class="cs-block-title"><i class="ti ti-edit"></i> Individual Practice</div><div class="muted">${esc(s.practice)}</div></div>` : ''}
      ${s.explain ? `<button id="cs-show-explain" type="button" class="link-btn" style="margin-top:8px; width:100%; justify-content:flex-start;"><i class="ti ti-help"></i> Tampilkan penjelasan query</button>` : ''}`;
  };

  const bindDetail = (): void => {
    if (!current) return;
    detail.querySelector('#cs-load-base')?.addEventListener('click', () => {
      opts.onLoadQuery(current!.query);
      opts.onExplain(null);
    });
    detail.querySelector('#cs-scenario')?.addEventListener('change', (e) => {
      const id = (e.target as HTMLSelectElement).value;
      const sc = current!.scenario.find((s) => s.id === id) ?? null;
      opts.onExplain(sc?.explain ?? null);
      renderDetail(id);
    });
    detail.querySelector('#cs-load-scenario')?.addEventListener('click', () => {
      const sel = detail.querySelector<HTMLSelectElement>('#cs-scenario')?.value;
      const sc = current!.scenario.find((s) => s.id === sel);
      if (sc?.query) opts.onLoadQuery(sc.query);
    });
    detail.querySelector('#cs-show-explain')?.addEventListener('click', () => {
      const sel = detail.querySelector<HTMLSelectElement>('#cs-scenario')?.value;
      const sc = current!.scenario.find((s) => s.id === sel);
      opts.onExplain(sc?.explain ?? null);
    });
  };

  host.querySelector<HTMLSelectElement>('#cs-select')!.addEventListener('change', (e) => {
    const id = (e.target as HTMLSelectElement).value;
    current = list.find((x) => x.id === id) ?? null;
    opts.onExplain(null);
    renderDetail(current?.scenario[0]?.id ?? '');
  });

  return {
    setLoadedDbName: (name: string) => {
      loadedName = name;
      if (current) {
        const sel = detail.querySelector<HTMLSelectElement>('#cs-scenario')?.value ?? '';
        renderDetail(sel);
      }
    },
  };
};

// ponytail: validasi field wajib manual (requirement §12). JSON Schema kalau konten mulai sering error.
const validate = (arr: unknown[]): CaseStudy[] => {
  const out: CaseStudy[] = [];
  for (const item of arr) {
    const c = item as Partial<CaseStudy>;
    const ok = c && typeof c.id === 'string' && typeof c.title === 'string'
      && typeof c.description === 'string' && Array.isArray(c.scenario)
      && typeof c.query === 'string' && typeof c.explanation === 'string';
    if (ok) out.push(c as CaseStudy);
    else console.warn('[caseStudies] item invalid dilewati:', item);
  }
  return out;
};

const esc = (s: string): string => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!);
