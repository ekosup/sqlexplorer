import referenceData from '../data/referenceContent.json';
import { renderMarkdown } from '../utils/markdown';

type ReferenceItem = { id: string; title: string; summary: string; body: string };
type ReferenceGroup = { id: string; title: string; icon: string; items: ReferenceItem[] };

type ReferenceData = { groups: ReferenceGroup[] };

export type ReferencePanelApi = { open: () => Promise<void> };

const esc = (s: string): string => {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return s.replace(/[&<>"']/g, (c) => map[c] ?? c);
};

const matches = (item: ReferenceItem, query: string): boolean => {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [item.title, item.summary, item.body].some((v) => v.toLowerCase().includes(q));
};

export const mountReferencePanel = (host: HTMLElement): ReferencePanelApi => {
  const data = referenceData as ReferenceData;
  const groups = data.groups ?? [];
  const state = { search: '', selectedId: '' };

  const detail = host.querySelector<HTMLElement>('#reference-detail')!;
  const list = host.querySelector<HTMLElement>('#reference-list')!;
  const search = host.querySelector<HTMLInputElement>('#reference-search')!;
  const btnClose = host.querySelector<HTMLButtonElement>('#reference-close')!;

  const getVisibleItems = (): Array<{ group: ReferenceGroup; item: ReferenceItem }> =>
    groups.flatMap((group) => group.items.filter((item) => matches(item, state.search)).map((item) => ({ group, item })));

  const renderList = (): void => {
    const visibleItems = getVisibleItems();
    if (!visibleItems.length) {
      list.innerHTML = '<div class="reference-empty">Tidak ada topik yang cocok.</div>';
      detail.innerHTML = '<div class="reference-empty">Pilih topik dari daftar kiri untuk melihat penjelasannya.</div>';
      return;
    }

    if (!visibleItems.some(({ item }) => item.id === state.selectedId)) {
      state.selectedId = visibleItems[0]!.item.id;
    }

    list.innerHTML = groups.map((group) => {
      const items = group.items.filter((item) => matches(item, state.search));
      if (!items.length) return '';
      return `
        <div class="reference-group">
          <div class="reference-group-title"><i class="${esc(group.icon)}"></i>${esc(group.title)}</div>
          <div class="reference-group-items">
            ${items.map((item) => `
              <button class="reference-item-btn ${item.id === state.selectedId ? 'active' : ''}" data-id="${esc(item.id)}" type="button">
                <span class="reference-item-title">${esc(item.title)}</span>
                <span class="reference-item-summary">${esc(item.summary)}</span>
              </button>
            `).join('')}
          </div>
        </div>`;
    }).join('');

    list.querySelectorAll<HTMLButtonElement>('.reference-item-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.selectedId = btn.dataset.id ?? '';
        renderList();
      });
    });

    renderDetail();
  };

  const renderDetail = (): void => {
    const visibleItems = getVisibleItems();
    const selected = visibleItems.find(({ item }) => item.id === state.selectedId) ?? visibleItems[0];
    if (!selected) {
      detail.innerHTML = '<div class="reference-empty">Tidak ada topik yang cocok.</div>';
      return;
    }

    const { group, item } = selected;
    detail.innerHTML = `
      <div class="reference-article">
        <div class="reference-article-head">
          <div class="reference-badge">${esc(group.title)}</div>
          <h2>${esc(item.title)}</h2>
          <p>${esc(item.summary)}</p>
        </div>
        <div class="reference-markdown">${renderMarkdown(item.body)}</div>
      </div>`;
  };

  search.addEventListener('input', () => {
    state.search = search.value;
    renderList();
  });

  btnClose.addEventListener('click', () => { host.hidden = true; });
  host.addEventListener('click', (event) => { if (event.target === host) host.hidden = true; });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !host.hidden) host.hidden = true;
  });

  if (groups.length) {
    state.selectedId = groups[0]!.items[0]?.id ?? '';
  }

  renderList();

  return {
    open: async () => {
      host.hidden = false;
      if (groups.length && !state.selectedId) {
        state.selectedId = groups[0]!.items[0]?.id ?? '';
      }
      renderList();
    },
  };
};
