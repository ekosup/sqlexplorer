// Visualisasi hasil query: bar, line, scatter. SVG murni (tanpa lib chart) → bundle kecil, offline.
const MAX_POINTS = 300;

export type ChartViewApi = {
  render: (cols: string[], rows: unknown[][]) => void;
  clear: () => void;
};

type ChartType = 'bar' | 'line' | 'scatter';

const num = (v: unknown): number | null => {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

const formatNum = (v: number): string => {
  if (Math.abs(v) < 1000) {
    return String(Math.round(v * 100) / 100);
  }
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    compactDisplay: 'short',
    maximumFractionDigits: 1
  }).format(v);
};

const isNumericCol = (rows: unknown[][], i: number): boolean => {
  let seen = 0, ok = 0;
  for (const r of rows.slice(0, 50)) { if (r[i] == null || r[i] === '') continue; seen++; if (num(r[i]) != null) ok++; }
  return seen > 0 && ok / seen >= 0.8;
};

const esc = (s: string): string => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const resolveChartSvg = (svgEl: SVGElement): SVGElement => {
  const svgClone = svgEl.cloneNode(true) as SVGElement;
  const computed = getComputedStyle(document.documentElement);
  const accent = computed.getPropertyValue('--accent').trim() || '#3b82f6';
  const muted = computed.getPropertyValue('--muted').trim() || '#64748b';
  const border = computed.getPropertyValue('--border').trim() || '#e2e8f0';
  const text = computed.getPropertyValue('--text').trim() || '#1e293b';
  const bg = computed.getPropertyValue('--editor-bg').trim() || '#ffffff';
  
  const styleEl = document.createElementNS('http://www.w3.org/2000/svg', 'style');
  styleEl.textContent = `
    svg { background-color: ${bg}; font-family: system-ui, -apple-system, sans-serif; }
    .ch-axis { stroke: ${muted}; stroke-width: 1; }
    .ch-grid { stroke: ${border}; stroke-width: 1; stroke-dasharray: 2 3; }
    .ch-bar { fill: ${accent}; opacity: 0.85; }
    .ch-line { fill: none; stroke: ${accent}; stroke-width: 2; }
    .ch-pt { fill: ${accent}; }
    .ch-lbl-y { fill: ${muted}; font-size: 10px; text-anchor: end; }
    .ch-lbl-x { fill: ${muted}; font-size: 10px; text-anchor: start; }
    .ch-lbl-x-c { fill: ${muted}; font-size: 10px; text-anchor: middle; }
    .ch-title { fill: ${text}; font-size: 12px; text-anchor: middle; font-weight: 600; }
  `;
  svgClone.insertBefore(styleEl, svgClone.firstChild);
  return svgClone;
};

const exportSvg = (svgEl: SVGElement, filename: string): void => {
  const styledSvg = resolveChartSvg(svgEl);
  const serializer = new XMLSerializer();
  const source = serializer.serializeToString(styledSvg);
  const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

const exportPng = (svgEl: SVGElement, filename: string): void => {
  const styledSvg = resolveChartSvg(svgEl);
  const serializer = new XMLSerializer();
  const source = serializer.serializeToString(styledSvg);
  const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  
  const img = new Image();
  img.onload = () => {
    const scale = 2;
    const canvas = document.createElement('canvas');
    canvas.width = 720 * scale;
    canvas.height = 380 * scale;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      try {
        const pngUrl = canvas.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = pngUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } catch (err) {
        console.error('Failed to export PNG:', err);
      }
    }
    URL.revokeObjectURL(url);
  };
  img.onerror = (e) => {
    console.error('Failed to load image for PNG export:', e);
    URL.revokeObjectURL(url);
  };
  img.src = url;
};

export const mountChartView = (host: HTMLElement): ChartViewApi => {
  let cols: string[] = [];
  let rows: unknown[][] = [];
  let type: ChartType = 'bar';
  let xi = 0;
  let yi = 1;

  const clear = (): void => {
    host.innerHTML = '<div class="muted" style="padding:12px">Tidak ada data untuk divisualisasikan.</div>';
    cols = [];
    rows = [];
    type = 'bar';
    xi = -1;
    yi = -1;
  };

  const option = (label: string, i: number, sel: number): string =>
    `<option value="${i}"${i === sel ? ' selected' : ''}>${esc(label)}</option>`;

  const renderControls = (): string => {
    const numericYs = cols.map((_, i) => i).filter((i) => isNumericCol(rows, i));
    const yOpts = (type === 'scatter' ? numericYs : numericYs);
    const hasData = yi >= 0 && isNumericCol(rows, yi);

    const xOptions = [
      `<option value="-1"${xi === -1 ? ' selected' : ''}>-- Pilih Kolom X --</option>`,
      ...cols.map((c, i) => option(c, i, xi))
    ].join('');

    const yOptions = yOpts.length > 0
      ? [
          `<option value="-1"${yi === -1 ? ' selected' : ''}>-- Pilih Kolom Y --</option>`,
          ...yOpts.map((i) => option(cols[i], i, yi))
        ].join('')
      : option('(tak ada kolom numerik)', -1, -1);

    return `
      <div class="chart-controls">
        <div class="chart-selectors">
          <label>Tipe
            <select id="ch-type">
              <option value="bar"${type === 'bar' ? ' selected' : ''}>Bar</option>
              <option value="line"${type === 'line' ? ' selected' : ''}>Line</option>
              <option value="scatter"${type === 'scatter' ? ' selected' : ''}>Scatter</option>
            </select>
          </label>
          <label>Sumbu X
            <select id="ch-x">${xOptions}</select>
          </label>
          <label>Sumbu Y
            <select id="ch-y">${yOptions}</select>
          </label>
        </div>
        ${hasData ? `
        <div class="chart-export-actions">
          <button id="btn-clear-chart" type="button" class="btn-secondary" title="Clear Cache Grafik" style="color: var(--danger)">
            <i class="ti ti-trash"></i> Clear Cache
          </button>
          <button id="btn-export-png" type="button" class="btn-secondary" title="Export ke PNG">
            <i class="ti ti-photo"></i> Export PNG
          </button>
          <button id="btn-export-svg" type="button" class="btn-secondary" title="Export ke SVG">
            <i class="ti ti-download"></i> Export SVG
          </button>
        </div>
        ` : ''}
      </div>`;
  };

  const draw = (): string => {
    const W = 720, H = 380;
    if (yi < 0 || !isNumericCol(rows, yi)) return '<div class="muted" style="padding:12px">Pilih kolom Y numerik untuk membuat grafik.</div>';

    const src = rows.slice(0, MAX_POINTS);
    const banner = rows.length > MAX_POINTS ? `<div class="muted" style="padding:4px 8px">Menampilkan ${MAX_POINTS} dari ${rows.length} baris.</div>` : '';
    const ys = src.map((r) => num(r[yi]));
    const yVals = ys.filter((v): v is number => v != null);
    if (yVals.length === 0) return '<div class="muted" style="padding:12px">Kolom Y tidak punya nilai numerik.</div>';
    let yMin = Math.min(0, ...yVals), yMax = Math.max(0, ...yVals);
    if (yMin === yMax) yMax = yMin + 1;

    // Generate tick labels to compute dynamic left padding
    const tickLabels = Array.from({ length: 5 }, (_, k) => {
      const v = yMin + (k / 4) * (yMax - yMin);
      return formatNum(v);
    });
    const maxLabelLen = Math.max(...tickLabels.map(l => l.length));
    
    // Estimate required padding: ~6.5px per character + 12px margin + 24px rotated title space
    const padL = Math.max(56, maxLabelLen * 6.5 + 36);
    const pad = { l: padL, r: 20, t: 20, b: 64 };
    const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;

    const yScale = (v: number): number => pad.t + ih - ((v - yMin) / (yMax - yMin)) * ih;

    const axes = `
      <line x1="${pad.l}" y1="${pad.t}" x2="${pad.l}" y2="${pad.t + ih}" class="ch-axis"/>
      <line x1="${pad.l}" y1="${pad.t + ih}" x2="${pad.l + iw}" y2="${pad.t + ih}" class="ch-axis"/>`;
    const yTicks = tickLabels.map((lbl, k) => {
      const v = yMin + (k / 4) * (yMax - yMin), y = yScale(v);
      return `<line x1="${pad.l - 4}" y1="${y}" x2="${pad.l + iw}" y2="${y}" class="ch-grid"/><text x="${pad.l - 8}" y="${y + 4}" class="ch-lbl-y">${lbl}</text>`;
    }).join('');

    let body = '';
    let xLabels = '';
    if (type === 'scatter') {
      const xs = src.map((r) => num(r[xi]));
      const xVals = xs.filter((v): v is number => v != null);
      let xMin = Math.min(...xVals), xMax = Math.max(...xVals);
      if (xMin === xMax) xMax = xMin + 1;
      const xScale = (v: number): number => pad.l + ((v - xMin) / (xMax - xMin)) * iw;
      body = src.map((r) => { const x = num(r[xi]), y = num(r[yi]); return x == null || y == null ? '' : `<circle cx="${xScale(x)}" cy="${yScale(y)}" r="4" class="ch-pt"/>`; }).join('');
      xLabels = Array.from({ length: 5 }, (_, k) => {
        const v = xMin + (k / 4) * (xMax - xMin);
        return `<text x="${xScale(v)}" y="${pad.t + ih + 20}" class="ch-lbl-x-c">${formatNum(v)}</text>`;
      }).join('');
    } else {
      const n = src.length;
      const bw = iw / Math.max(1, n);
      const cx = (k: number): number => pad.l + bw * k + bw / 2;
      if (type === 'bar') {
        body = src.map((r, k) => { const y = num(r[yi]); if (y == null) return ''; const top = yScale(y), base = yScale(0); const bh = Math.abs(base - top); return `<rect x="${cx(k) - Math.min(bw * 0.35, 22)}" y="${Math.min(top, base)}" width="${Math.min(bw * 0.7, 44)}" height="${bh}" class="ch-bar"/>`; }).join('');
      } else {
        const pts = src.map((r, k) => { const y = num(r[yi]); return y == null ? null : `${cx(k)},${yScale(y)}`; }).filter(Boolean).join(' ');
        body = `<polyline points="${pts}" class="ch-line"/>` + src.map((r, k) => { const y = num(r[yi]); return y == null ? '' : `<circle cx="${cx(k)}" cy="${yScale(y)}" r="3" class="ch-pt"/>`; }).join('');
      }
      const step = Math.ceil(n / 12);
      xLabels = src.map((r, k) => k % step === 0 ? `<text x="${cx(k)}" y="${pad.t + ih + 20}" class="ch-lbl-x" transform="rotate(35 ${cx(k)} ${pad.t + ih + 20})">${esc(String(r[xi] ?? '')).slice(0, 14)}</text>` : '').join('');
    }

    return banner + `<svg viewBox="0 0 ${W} ${H}" class="chart-svg" preserveAspectRatio="xMidYMid meet">
      ${yTicks}${axes}${body}${xLabels}
      <text x="${pad.l + iw / 2}" y="${H - 4}" class="ch-title">${esc(cols[xi] ?? '')}</text>
      <text transform="rotate(-90 14 ${pad.t + ih / 2})" x="14" y="${pad.t + ih / 2}" class="ch-title">${esc(cols[yi] ?? '')}</text>
    </svg>`;
  };

  const paint = (): void => {
    host.innerHTML = renderControls() + `<div class="chart-canvas">${draw()}</div>`;
    host.querySelector<HTMLSelectElement>('#ch-type')!.addEventListener('change', (e) => { type = (e.target as HTMLSelectElement).value as ChartType; paint(); });
    host.querySelector<HTMLSelectElement>('#ch-x')!.addEventListener('change', (e) => { xi = Number((e.target as HTMLSelectElement).value); paint(); });
    const ySel = host.querySelector<HTMLSelectElement>('#ch-y')!;
    ySel.addEventListener('change', (e) => { yi = Number((e.target as HTMLSelectElement).value); paint(); });

    const btnClear = host.querySelector<HTMLButtonElement>('#btn-clear-chart');
    if (btnClear) {
      btnClear.addEventListener('click', () => {
        xi = -1;
        yi = -1;
        paint();
      });
    }

    const btnPng = host.querySelector<HTMLButtonElement>('#btn-export-png');
    if (btnPng) {
      btnPng.addEventListener('click', () => {
        const svgEl = host.querySelector<SVGElement>('.chart-svg');
        if (svgEl) {
          const filename = `chart_${cols[xi] || 'x'}_${cols[yi] || 'y'}.png`;
          exportPng(svgEl, filename);
        }
      });
    }

    const btnSvg = host.querySelector<HTMLButtonElement>('#btn-export-svg');
    if (btnSvg) {
      btnSvg.addEventListener('click', () => {
        const svgEl = host.querySelector<SVGElement>('.chart-svg');
        if (svgEl) {
          const filename = `chart_${cols[xi] || 'x'}_${cols[yi] || 'y'}.svg`;
          exportSvg(svgEl, filename);
        }
      });
    }
  };

  const render = (c: string[], r: unknown[][]): void => {
    cols = c; rows = r;
    if (cols.length === 0 || rows.length === 0) { host.innerHTML = '<div class="muted" style="padding:12px">Tidak ada data untuk divisualisasikan.</div>'; return; }
    // default X = kolom non-numerik pertama, Y = kolom numerik pertama
    const numeric = cols.map((_, i) => i).filter((i) => isNumericCol(rows, i));
    yi = numeric[0] ?? 1;
    xi = cols.findIndex((_, i) => !isNumericCol(rows, i));
    if (xi < 0) xi = 0;
    paint();
  };

  clear();
  return { render, clear };
};
