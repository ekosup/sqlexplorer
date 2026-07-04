// FR-09. Max 30 item (dedup berurutan). Persist di localStorage agar setiap peserta
// mempertahankan history-nya setelah refresh. Flat text kecil → localStorage cukup.

const MAX = 30;
const KEY = 'sqlexplorer.history';

const load = (): string[] => {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]') as string[]; } catch { return []; }
};
// ponytail: swallow quota error — history best-effort, tidak boleh break UX query.
const save = (xs: string[]): void => { try { localStorage.setItem(KEY, JSON.stringify(xs)); } catch { /* quota */ } };

export type HistoryApi = { push: (sql: string) => void };

export const mountHistoryPanel = (host: HTMLElement, opts: { onPick: (sql: string) => void }): HistoryApi => {
  const items: string[] = load();
  host.innerHTML = '<div class="subpanel-title">History</div><ul id="hist-list" class="learn-list"></ul>';
  const list = host.querySelector<HTMLUListElement>('#hist-list')!;

  const render = (): void => {
    list.innerHTML = items
      .map((s, i) => `<li><button data-i="${i}" class="history-btn" type="button"><i class="ti ti-history"></i><span style="display:block; width:100%; text-align:left; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${esc(s.slice(0, 50))}</span></button></li>`)
      .join('');
    list.querySelectorAll<HTMLButtonElement>('button[data-i]').forEach((b) =>
      b.addEventListener('click', () => opts.onPick(items[Number(b.dataset.i)]!)),
    );
  };

  render();

  return {
    push: (sql: string) => {
      if (items[0] === sql) return;
      items.unshift(sql);
      if (items.length > MAX) items.length = MAX;
      save(items);
      render();
    },
  };
};

const esc = (s: string): string => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!);
