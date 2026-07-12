export type SaveQueryPanelApi = {
  open: (sql: string) => void;
};

export const mountSaveQueryPanel = (overlay: HTMLElement): SaveQueryPanelApi => {
  let sqlToSave = '';

  const $ = <T extends HTMLElement>(sel: string): T => overlay.querySelector<T>(sel)!;

  const close = (): void => {
    overlay.hidden = true;
    sqlToSave = '';
  };

  overlay.innerHTML = `
    <div class="test-overlay-card" style="max-width: 480px; width: 100%;">
      <div class="test-overlay-head">
        <b><i class="ti ti-device-floppy"></i> Simpan Query ke Local</b>
        <button id="sq-close" type="button" class="link-btn">Tutup</button>
      </div>
      <form id="sq-form" style="padding: 16px; display: flex; flex-direction: column; gap: 12px; margin: 0;">
        <div style="display: flex; flex-direction: column; gap: 6px;">
          <label for="sq-title" style="font-weight: 500; font-size: 13px; color: var(--text);">Judul Query</label>
          <input id="sq-title" class="app-input" type="text" placeholder="Contoh: 01. Query awal test" required style="margin-bottom: 0;" />
          <div id="sq-filename-preview" style="font-size: 11px; color: var(--muted, #888); margin-top: 4px;">Nama file: query.sql</div>
        </div>
        <div style="display: flex; flex-direction: column; gap: 6px;">
          <label for="sq-desc" style="font-weight: 500; font-size: 13px; color: var(--text);">Deskripsi (Opsional)</label>
          <textarea id="sq-desc" class="app-input" placeholder="Masukkan deskripsi untuk query ini..." rows="3" style="resize: vertical; font-family: inherit; margin-bottom: 0;"></textarea>
        </div>
        <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 8px;">
          <button id="sq-cancel" type="button" class="btn-secondary">Batal</button>
          <button type="submit" class="btn-primary"><i class="ti ti-download"></i> Unduh SQL</button>
        </div>
      </form>
    </div>
  `;

  const titleInput = $('#sq-title') as HTMLInputElement;
  const descInput = $('#sq-desc') as HTMLTextAreaElement;
  const previewEl = $('#sq-filename-preview') as HTMLDivElement;
  const form = $('#sq-form') as HTMLFormElement;

  $('#sq-close').addEventListener('click', close);
  $('#sq-cancel').addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  const getNormalizedFilename = (title: string): string => {
    const normalizedName = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
    return (normalizedName || 'query') + '.sql';
  };

  titleInput.addEventListener('input', () => {
    previewEl.textContent = `Nama file: ${getNormalizedFilename(titleInput.value)}`;
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const title = titleInput.value.trim();
    const desc = descInput.value.trim();

    if (!title) return;

    const filename = getNormalizedFilename(title);

    // Buat komentar di bagian atas query
    let fileContent = '';
    if (title || desc) {
      fileContent += '/*\n';
      if (title) {
        fileContent += ` * Judul: ${title}\n`;
      }
      if (desc) {
        fileContent += ` * Deskripsi: ${desc}\n`;
      }
      fileContent += ' */\n\n';
    }
    fileContent += sqlToSave;

    // Unduh file SQL
    const blob = new Blob([fileContent], { type: 'text/sql;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);

    close();
  });

  const open = (sql: string): void => {
    sqlToSave = sql;
    titleInput.value = '';
    descInput.value = '';
    previewEl.textContent = 'Nama file: query.sql';
    overlay.hidden = false;
    // Auto-focus input judul
    setTimeout(() => titleInput.focus(), 50);
  };

  return { open };
};
