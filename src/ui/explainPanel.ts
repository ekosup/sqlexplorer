// UXR-A2: Explain panel — "mencari apa / cara baca / red flag" untuk query aktif.

export type Explain = { mencari_apa?: string; cara_baca?: string; red_flag?: string };

export type ExplainPanelApi = { set: (e: Explain | null) => void };

export const mountExplainPanel = (host: HTMLElement): ExplainPanelApi => {
  const render = (e: Explain | null): void => {
    if (!e || (!e.mencari_apa && !e.cara_baca && !e.red_flag)) {
      host.innerHTML = '<div class="muted">Pilih starter query atau scenario untuk melihat penjelasan.</div>';
      return;
    }
    host.innerHTML = `
      <div class="explain-row"><span class="explain-label">Mencari apa?</span><div>${esc(e.mencari_apa)}</div></div>
      <div class="explain-row"><span class="explain-label">Cara baca output</span><div>${esc(e.cara_baca)}</div></div>
      <div class="explain-row explain-red"><span class="explain-label">Red flag</span><div>${esc(e.red_flag)}</div></div>`;
  };
  render(null);
  return { set: render };
};

const esc = (s = ''): string => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!);
