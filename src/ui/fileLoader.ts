// FR-01: file picker + drag-drop untuk .sqlite/.db

export type FileLoaderOpts = { onLoad: (file: File) => void | Promise<void> };

export const mountFileLoader = (host: HTMLElement, opts: FileLoaderOpts): void => {
  host.innerHTML = `
    <label class="drop-zone" id="fl-drop">
      <input type="file" accept=".sqlite,.db,application/x-sqlite3" />
      <div class="drop-zone-content">
        <i class="ti ti-cloud-upload drop-icon"></i>
        <div class="drop-text">Drop file <b>.sqlite</b> di sini</div>
        <div class="drop-subtext">atau klik untuk memilih file</div>
      </div>
    </label>
  `;
  const zone = host.querySelector<HTMLLabelElement>('#fl-drop')!;
  const input = zone.querySelector<HTMLInputElement>('input')!;

  const handle = (file: File | undefined): void => {
    if (!file) return;
    if (!/\.(sqlite|db)$/i.test(file.name)) {
      alert('File harus berekstensi .sqlite atau .db');
      return;
    }
    void opts.onLoad(file);
  };

  input.addEventListener('change', () => handle(input.files?.[0]));
  ['dragenter', 'dragover'].forEach((ev) =>
    zone.addEventListener(ev, (e) => { e.preventDefault(); zone.classList.add('dragover'); }),
  );
  ['dragleave', 'drop'].forEach((ev) =>
    zone.addEventListener(ev, (e) => { e.preventDefault(); zone.classList.remove('dragover'); }),
  );
  zone.addEventListener('drop', (e) => handle((e as DragEvent).dataTransfer?.files[0]));
};
