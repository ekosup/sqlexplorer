// FR-10 + UXR-A1/A2: starter query library. Load ke editor + tampilkan explain.
import starters from '../data/starterQueries.json';
import type { Explain } from './explainPanel';

type Starter = {
  id: string; title: string; konsep_audit: string; tujuan_belajar: string;
  query: string; explain?: Explain;
};

export const mountStarterQueryPanel = (
  host: HTMLElement,
  opts: { onLoadQuery: (sql: string) => void; onExplain: (e: Explain | null) => void },
): void => {
  const list = starters as Starter[];
  const concepts = Array.from(new Set(list.map((s) => s.konsep_audit)));

  host.innerHTML = `
    <div class="subpanel-title">Starter Query</div>
    <select id="sq-filter" class="app-select">
      <option value="">Semua konsep</option>
      ${concepts.map((c) => `<option value="${esc(c)}">${esc(c)}</option>`).join('')}
    </select>
    <ul id="sq-list" class="learn-list">
      ${list.map((s) => `
        <li class="sq-item" data-concept="${esc(s.konsep_audit)}">
          <button data-id="${s.id}" class="starter-btn" type="button">
            <i class="ti ti-terminal"></i>
            <div style="text-align:left; width:100%;">
              <div class="text-left" style="font-weight:600; line-height:1.25; text-align:left;">${esc(s.title)}</div>
              <div class="text-left muted" style="font-size:11px; margin-top:2px; text-align:left;">Concept: ${esc(s.konsep_audit)}</div>
            </div>
          </button>
        </li>`).join('')}
    </ul>`;

  host.querySelector<HTMLSelectElement>('#sq-filter')!.addEventListener('change', (e) => {
    const q = (e.target as HTMLSelectElement).value;
    host.querySelectorAll<HTMLLIElement>('.sq-item').forEach((li) => {
      li.style.display = !q || li.dataset.concept === q ? '' : 'none';
    });
  });

  host.querySelectorAll<HTMLButtonElement>('button[data-id]').forEach((b) =>
    b.addEventListener('click', () => {
      const s = list.find((x) => x.id === b.dataset.id);
      if (!s) return;
      opts.onLoadQuery(s.query);
      opts.onExplain(s.explain ?? null);
    }),
  );
};

const esc = (s: string): string => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!);
