// UXR-A4: glossary reference (10+ istilah audit+SQL). Default collapse (anti-overwhelm).
import glossary from '../data/glossary.json';

type Term = { istilah: string; bidang: string; definisi: string };

export const mountGlossaryPanel = (host: HTMLElement): void => {
  const terms = glossary as Term[];
  host.innerHTML = `
    <details class="glossary">
      <summary><i class="ti ti-book-2"></i> Glosarium (${terms.length})</summary>
      <input id="glos-filter" class="app-input" placeholder="Cari istilah…" />
      <ul id="glos-list" class="learn-list">
        ${terms.map((t) => `
          <li class="glos-item" data-key="${esc(t.istilah.toLowerCase())}">
            <div style="margin-bottom: 2px;">
              <span style="font-weight:600;">${esc(t.istilah)}</span> 
              <span class="glos-tag glos-${t.bidang}">${t.bidang}</span>
            </div>
            <div class="muted" style="line-height:1.4;">${esc(t.definisi)}</div>
          </li>`).join('')}
      </ul>
    </details>`;
  const filter = host.querySelector<HTMLInputElement>('#glos-filter')!;
  filter.addEventListener('input', () => {
    const q = filter.value.trim().toLowerCase();
    host.querySelectorAll<HTMLLIElement>('.glos-item').forEach((li) => {
      li.style.display = !q || li.dataset.key!.includes(q) ? '' : 'none';
    });
  });
};

const esc = (s: string): string => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!);
