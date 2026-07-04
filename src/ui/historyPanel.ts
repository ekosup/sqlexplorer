// FR-09 (session only). Max 30 item (dedup berurutan).

const MAX = 30;

export type HistoryApi = { push: (sql: string) => void };

export const mountHistoryPanel = (host: HTMLElement, opts: { onPick: (sql: string) => void }): HistoryApi => {
  const items: string[] = [];
  host.innerHTML = '<div class="subpanel-title">History</div><ul id="hist-list" class="learn-list"></ul>';
  const list = host.querySelector<HTMLUListElement>('#hist-list')!;

  const render = (): void => {
    list.innerHTML = items
      .map((s, i) => `<li><button data-i="${i}" class="history-btn" type="button"><i class="ti ti-history"></i> ${esc(s.slice(0, 80))}</button></li>`)
      .join('');
    list.querySelectorAll<HTMLButtonElement>('button[data-i]').forEach((b) =>
      b.addEventListener('click', () => opts.onPick(items[Number(b.dataset.i)]!)),
    );
  };

  return {
    push: (sql: string) => {
      if (items[0] === sql) return;
      items.unshift(sql);
      if (items.length > MAX) items.length = MAX;
      render();
    },
  };
};

const esc = (s: string): string => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!);
