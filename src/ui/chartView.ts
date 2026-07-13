// Visualisasi hasil query: bar, line, scatter, pie, donut, area. SVG murni (tanpa lib chart) → bundle kecil, offline.
const MAX_POINTS = 300;

export type ChartViewApi = {
  render: (cols: string[], rows: unknown[][]) => void;
  clear: () => void;
};

type ChartType = 'bar' | 'line' | 'scatter' | 'pie' | 'donut' | 'area' | 'heatmap' | 'stackedbar' | 'combo';
type LegendPosition = 'inside-right' | 'outside-right' | 'top' | 'bottom';

export interface ChartRenderContext {
  width: number;
  height: number;
  cols: string[];
  rows: unknown[][];
  xi: number;
  yi: number;
  zi?: number;
  showAllXLabels: boolean;
  legendPosition: LegendPosition;
  legendOffsetX: number;
  legendOffsetY: number;
  formatNum: (v: number) => string;
  esc: (s: string) => string;
}

export interface ChartRenderer {
  id: ChartType;
  name: string;
  render: (ctx: ChartRenderContext) => string;
}

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
    .ch-legend-text { fill: ${text}; font-size: 11px; text-anchor: start; }
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

// Palet warna premium untuk grafik kategori (Pie/Donut)
const PALETTE = [
  '#2563eb', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#06b6d4', // cyan
  '#ec4899', // pink
  '#f97316', // orange
  '#14b8a6', // teal
  '#a855f7', // purple
];

const buildCategoryXLabels = (params: {
  rows: unknown[][];
  xi: number;
  esc: (s: string) => string;
  cx: (k: number) => number;
  y: number;
  showAllXLabels: boolean;
  maxShown?: number;
  maxLen?: number;
}): string => {
  const { rows, xi, esc, cx, y, showAllXLabels, maxShown = 12, maxLen = 14 } = params;
  const n = rows.length;
  const step = showAllXLabels ? 1 : Math.ceil(n / maxShown);
  const angle = showAllXLabels ? 55 : 35;
  const fontSize = showAllXLabels ? 8 : 10;
  return rows.map((r, k) =>
    k % step === 0
      ? `<text x="${cx(k)}" y="${y}" class="ch-lbl-x" font-size="${fontSize}px" transform="rotate(${angle} ${cx(k)} ${y})">${esc(String(r[xi] ?? '')).slice(0, maxLen)}</text>`
      : ''
  ).join('');
};

const resolveLegendAnchor = (
  W: number,
  H: number,
  legendPosition: LegendPosition,
  defaults: { x: number; y: number },
  legendOffsetX: number,
  legendOffsetY: number,
  itemCount = 0,
): { x: number; y: number } => {
  const approxLegendHeight = Math.max(28, itemCount * 22);
  let x = defaults.x;
  let y = defaults.y;
  if (legendPosition === 'top') {
    x = 20;
    y = 34;
  } else if (legendPosition === 'bottom') {
    x = 20;
    y = H - approxLegendHeight - 8;
  } else if (legendPosition === 'outside-right') {
    x = Math.max(defaults.x, W - 190);
  }
  return { x: x + legendOffsetX, y: y + legendOffsetY };
};

// Helper untuk menggambar grafik tipe Cartesian (Bar, Line, Scatter, Area)
const renderCartesian = (
  ctx: ChartRenderContext,
  drawBody: (params: {
    pad: { l: number; r: number; t: number; b: number };
    iw: number;
    ih: number;
    yScale: (v: number) => number;
    yMin: number;
    yMax: number;
  }) => { body: string; xLabels: string }
): string => {
  const { width: W, height: H, cols, rows, xi, yi, formatNum, esc } = ctx;
  const ys = rows.map((r) => num(r[yi]));
  const yVals = ys.filter((v): v is number => v != null);
  if (yVals.length === 0) {
    return `<text x="${W / 2}" y="${H / 2}" class="ch-title" text-anchor="middle">Kolom Y tidak punya nilai numerik.</text>`;
  }
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
  const pad = { l: padL, r: 20, t: 20, b: ctx.showAllXLabels ? 88 : 64 };
  const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;

  const yScale = (v: number): number => pad.t + ih - ((v - yMin) / (yMax - yMin)) * ih;

  const axes = `
    <line x1="${pad.l}" y1="${pad.t}" x2="${pad.l}" y2="${pad.t + ih}" class="ch-axis"/>
    <line x1="${pad.l}" y1="${pad.t + ih}" x2="${pad.l + iw}" y2="${pad.t + ih}" class="ch-axis"/>`;
  
  const yTicks = tickLabels.map((lbl, k) => {
    const v = yMin + (k / 4) * (yMax - yMin), y = yScale(v);
    return `<line x1="${pad.l - 4}" y1="${y}" x2="${pad.l + iw}" y2="${y}" class="ch-grid"/><text x="${pad.l - 8}" y="${y + 4}" class="ch-lbl-y">${lbl}</text>`;
  }).join('');

  const { body, xLabels } = drawBody({ pad, iw, ih, yScale, yMin, yMax });

  return `
    ${yTicks}
    ${axes}
    ${body}
    ${xLabels}
    <text x="${pad.l + iw / 2}" y="${H - 4}" class="ch-title">${esc(cols[xi] ?? '')}</text>
    <text transform="rotate(-90 14 ${pad.t + ih / 2})" x="14" y="${pad.t + ih / 2}" class="ch-title">${esc(cols[yi] ?? '')}</text>
  `;
};

// Helper untuk menggambar Pie / Donut
const renderPieDonut = (ctx: ChartRenderContext, isDonut: boolean): string => {
  const { width: W, height: H, cols, yi, esc, formatNum } = ctx;
  const cx = 210, cy = H / 2;
  const rOut = 125;
  const rIn = 75;

  const dataPairs: { label: string; value: number }[] = ctx.rows
    .map(r => ({
      label: String(r[ctx.xi] ?? ''),
      value: Math.max(0, num(r[ctx.yi]) ?? 0)
    }))
    .filter(p => p.value > 0);

  const total = dataPairs.reduce((sum, p) => sum + p.value, 0);
  if (total === 0) {
    return `<text x="${W / 2}" y="${H / 2}" class="ch-title" text-anchor="middle">Semua nilai bernilai nol atau kosong.</text>`;
  }

  // Urutkan menurun agar visualisasi rapi
  dataPairs.sort((a, b) => b.value - a.value);

  // Group ke "Lainnya" jika kategori terlalu banyak (> 8)
  let finalPairs: { label: string; value: number }[] = [];
  if (dataPairs.length > 8) {
    finalPairs = dataPairs.slice(0, 7);
    const otherSum = dataPairs.slice(7).reduce((sum, p) => sum + p.value, 0);
    finalPairs.push({ label: 'Lainnya', value: otherSum });
  } else {
    finalPairs = dataPairs;
  }

  let startAngle = -Math.PI / 2;
  const slices: string[] = [];
  const legendItems: string[] = [];

  finalPairs.forEach((p, idx) => {
    const percent = p.value / total;
    const angleDelta = percent * 2 * Math.PI;
    const endAngle = startAngle + angleDelta;
    const color = PALETTE[idx % PALETTE.length];
    
    let pathD = '';
    if (percent >= 0.9999) {
      if (isDonut) {
        pathD = `
          M ${cx} ${cy - rOut}
          A ${rOut} ${rOut} 0 1 1 ${cx - 0.01} ${cy - rOut}
          Z
          M ${cx} ${cy - rIn}
          A ${rIn} ${rIn} 0 1 0 ${cx - 0.01} ${cy - rIn}
          Z
        `;
      } else {
        pathD = `
          M ${cx} ${cy - rOut}
          A ${rOut} ${rOut} 0 1 1 ${cx - 0.01} ${cy - rOut}
          Z
        `;
      }
    } else {
      if (isDonut) {
        const x1Out = cx + rOut * Math.cos(startAngle);
        const y1Out = cy + rOut * Math.sin(startAngle);
        const x2Out = cx + rOut * Math.cos(endAngle);
        const y2Out = cy + rOut * Math.sin(endAngle);
        
        const x1In = cx + rIn * Math.cos(startAngle);
        const y1In = cy + rIn * Math.sin(startAngle);
        const x2In = cx + rIn * Math.cos(endAngle);
        const y2In = cy + rIn * Math.sin(endAngle);
        
        const largeArc = angleDelta > Math.PI ? 1 : 0;
        pathD = `M ${x1Out} ${y1Out} A ${rOut} ${rOut} 0 ${largeArc} 1 ${x2Out} ${y2Out} L ${x2In} ${y2In} A ${rIn} ${rIn} 0 ${largeArc} 0 ${x1In} ${y1In} Z`;
      } else {
        const x1 = cx + rOut * Math.cos(startAngle);
        const y1 = cy + rOut * Math.sin(startAngle);
        const x2 = cx + rOut * Math.cos(endAngle);
        const y2 = cy + rOut * Math.sin(endAngle);
        
        const largeArc = angleDelta > Math.PI ? 1 : 0;
        pathD = `M ${cx} ${cy} L ${x1} ${y1} A ${rOut} ${rOut} 0 ${largeArc} 1 ${x2} ${y2} Z`;
      }
    }

    slices.push(`<path d="${pathD.trim()}" fill="${color}" stroke="var(--panel)" stroke-width="1.5" class="ch-slice" />`);

    const pctStr = (percent * 100).toFixed(1) + '%';
    const labelText = esc(p.label);
    const displayLabel = labelText.length > 22 ? labelText.slice(0, 20) + '..' : labelText;
    const legendY = idx * 24;

    legendItems.push(`
      <g transform="translate(0, ${legendY})">
        <rect x="0" y="0" width="14" height="14" rx="3" fill="${color}" />
        <text x="20" y="11" class="ch-legend-text" font-size="11px" fill="var(--text)">${displayLabel} (${pctStr})</text>
      </g>
    `);

    startAngle = endAngle;
  });

  let donutCenterLabel = '';
  if (isDonut) {
    const totalFormatted = formatNum(total);
    donutCenterLabel = `
      <text x="${cx}" y="${cy - 4}" text-anchor="middle" class="ch-title" font-weight="600" font-size="14px" fill="var(--text)">TOTAL</text>
      <text x="${cx}" y="${cy + 16}" text-anchor="middle" class="ch-lbl-x-c" font-size="12px" fill="var(--muted)">${totalFormatted}</text>
    `;
  }

  const chartTitle = `<text x="${W / 2}" y="${25}" class="ch-title" font-size="14px" text-anchor="middle" font-weight="700" fill="var(--text)">Distribusi ${esc(cols[yi])}</text>`;
  const legendAnchor = resolveLegendAnchor(
    W,
    H,
    ctx.legendPosition,
    { x: 400, y: 60 },
    ctx.legendOffsetX,
    ctx.legendOffsetY,
    legendItems.length,
  );

  return `
    ${chartTitle}
    <g class="ch-slices">${slices.join('')}</g>
    ${donutCenterLabel}
    <g class="ch-legend" transform="translate(${legendAnchor.x}, ${legendAnchor.y})">${legendItems.join('')}</g>
  `;
};

// Concrete Implementations of ChartRenderer
const BarChartRenderer: ChartRenderer = {
  id: 'bar',
  name: 'Bar',
  render(ctx) {
    return renderCartesian(ctx, ({ pad, iw, ih, yScale }) => {
      const n = ctx.rows.length;
      const bw = iw / Math.max(1, n);
      const cx = (k: number): number => pad.l + bw * k + bw / 2;

      const body = ctx.rows.map((r, k) => {
        const y = num(r[ctx.yi]);
        if (y == null) return '';
        const top = yScale(y), base = yScale(0);
        const bh = Math.abs(base - top);
        return `<rect x="${cx(k) - Math.min(bw * 0.35, 22)}" y="${Math.min(top, base)}" width="${Math.min(bw * 0.7, 44)}" height="${bh}" class="ch-bar"/>`;
      }).join('');

      const xLabels = buildCategoryXLabels({
        rows: ctx.rows,
        xi: ctx.xi,
        esc: ctx.esc,
        cx,
        y: pad.t + ih + 20,
        showAllXLabels: ctx.showAllXLabels,
      });

      return { body, xLabels };
    });
  }
};

const LineChartRenderer: ChartRenderer = {
  id: 'line',
  name: 'Line',
  render(ctx) {
    return renderCartesian(ctx, ({ pad, iw, ih, yScale }) => {
      const n = ctx.rows.length;
      const bw = iw / Math.max(1, n);
      const cx = (k: number): number => pad.l + bw * k + bw / 2;

      const pts = ctx.rows
        .map((r, k) => {
          const y = num(r[ctx.yi]);
          return y == null ? null : `${cx(k)},${yScale(y)}`;
        })
        .filter((val): val is string => val !== null)
        .join(' ');

      const body = `<polyline points="${pts}" class="ch-line"/>` + 
        ctx.rows.map((r, k) => {
          const y = num(r[ctx.yi]);
          return y == null ? '' : `<circle cx="${cx(k)}" cy="${yScale(y)}" r="3" class="ch-pt"/>`;
        }).join('');

      const xLabels = buildCategoryXLabels({
        rows: ctx.rows,
        xi: ctx.xi,
        esc: ctx.esc,
        cx,
        y: pad.t + ih + 20,
        showAllXLabels: ctx.showAllXLabels,
      });

      return { body, xLabels };
    });
  }
};

const ScatterChartRenderer: ChartRenderer = {
  id: 'scatter',
  name: 'Scatter',
  render(ctx) {
    return renderCartesian(ctx, ({ pad, iw, ih, yScale }) => {
      const xs = ctx.rows.map((r) => num(r[ctx.xi]));
      const xVals = xs.filter((v): v is number => v != null);
      let xMin = Math.min(...xVals), xMax = Math.max(...xVals);
      if (xMin === xMax) xMax = xMin + 1;
      const xScale = (v: number): number => pad.l + ((v - xMin) / (xMax - xMin)) * iw;

      const body = ctx.rows.map((r) => {
        const x = num(r[ctx.xi]), y = num(r[ctx.yi]);
        return x == null || y == null ? '' : `<circle cx="${xScale(x)}" cy="${yScale(y)}" r="4" class="ch-pt"/>`;
      }).join('');

      const xLabels = Array.from({ length: 5 }, (_, k) => {
        const v = xMin + (k / 4) * (xMax - xMin);
        return `<text x="${xScale(v)}" y="${pad.t + ih + 20}" class="ch-lbl-x-c">${ctx.formatNum(v)}</text>`;
      }).join('');

      return { body, xLabels };
    });
  }
};

const AreaChartRenderer: ChartRenderer = {
  id: 'area',
  name: 'Area',
  render(ctx) {
    return renderCartesian(ctx, ({ pad, iw, ih, yScale }) => {
      const n = ctx.rows.length;
      const bw = iw / Math.max(1, n);
      const cx = (k: number): number => pad.l + bw * k + bw / 2;

      // Filter point valid
      const points = ctx.rows
        .map((r, k) => {
          const y = num(r[ctx.yi]);
          return y == null ? null : { x: cx(k), y: yScale(y) };
        })
        .filter((pt): pt is { x: number; y: number } => pt != null);

      if (points.length === 0) return { body: '', xLabels: '' };

      const linePointsStr = points.map(pt => `${pt.x},${pt.y}`).join(' ');
      const zeroY = yScale(0);
      const firstX = points[0].x;
      const lastX = points[points.length - 1].x;
      const areaPointsStr = `${firstX},${zeroY} ${linePointsStr} ${lastX},${zeroY}`;

      const gradientId = 'ch-area-grad';
      const body = `
        <defs>
          <linearGradient id="${gradientId}" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.4"/>
            <stop offset="100%" stop-color="var(--accent)" stop-opacity="0.0"/>
          </linearGradient>
        </defs>
        <polygon points="${areaPointsStr}" fill="url(#${gradientId})" />
        <polyline points="${linePointsStr}" class="ch-line"/>
        ${points.map(pt => `<circle cx="${pt.x}" cy="${pt.y}" r="3" class="ch-pt"/>`).join('')}
      `;

      const xLabels = buildCategoryXLabels({
        rows: ctx.rows,
        xi: ctx.xi,
        esc: ctx.esc,
        cx,
        y: pad.t + ih + 20,
        showAllXLabels: ctx.showAllXLabels,
      });

      return { body, xLabels };
    });
  }
};

const PieChartRenderer: ChartRenderer = {
  id: 'pie',
  name: 'Pie',
  render(ctx) {
    return renderPieDonut(ctx, false);
  }
};

const DonutChartRenderer: ChartRenderer = {
  id: 'donut',
  name: 'Donut',
  render(ctx) {
    return renderPieDonut(ctx, true);
  }
};

const HeatmapChartRenderer: ChartRenderer = {
  id: 'heatmap',
  name: 'Heatmap',
  render(ctx) {
    const { width: W, height: H, cols, rows, xi, yi, formatNum, esc } = ctx;
    const zi = ctx.zi ?? 2;

    const xVals = Array.from(new Set(rows.map(r => String(r[xi] ?? ''))));
    const yVals = Array.from(new Set(rows.map(r => String(r[yi] ?? ''))));

    if (xVals.length === 0 || yVals.length === 0) {
      return `<text x="${W / 2}" y="${H / 2}" class="ch-title" text-anchor="middle">Data tidak cukup untuk heatmap.</text>`;
    }

    const sortAlphanumeric = (arr: string[]): string[] => {
      return [...arr].sort((a, b) => {
        const aNum = Number(a), bNum = Number(b);
        if (Number.isFinite(aNum) && Number.isFinite(bNum)) {
          return aNum - bNum;
        }
        return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
      });
    };

    const sortedX = sortAlphanumeric(xVals);
    const sortedY = sortAlphanumeric(yVals);

    const gridX = sortedX.slice(0, 30);
    const gridY = sortedY.slice(0, 20);

    const cellMap: Record<string, number> = {};
    rows.forEach(r => {
      const x = String(r[xi] ?? '');
      const y = String(r[yi] ?? '');
      const zVal = num(r[zi]) ?? 0;
      const key = `${x}|||${y}`;
      cellMap[key] = (cellMap[key] || 0) + zVal;
    });

    const zVals = Object.values(cellMap);
    if (zVals.length === 0) {
      return `<text x="${W / 2}" y="${H / 2}" class="ch-title" text-anchor="middle">Kolom Z tidak memiliki nilai numerik.</text>`;
    }

    let zMin = Math.min(...zVals);
    let zMax = Math.max(...zVals);
    if (zMin === zMax) zMax = zMin + 1;

    const pad = { l: 110, r: 90, t: 40, b: ctx.showAllXLabels ? 86 : 65 };
    const iw = W - pad.l - pad.r;
    const ih = H - pad.t - pad.b;

    const cw = iw / gridX.length;
    const ch = ih / gridY.length;

    const cells: string[] = [];
    gridY.forEach((y, rIdx) => {
      gridX.forEach((x, cIdx) => {
        const key = `${x}|||${y}`;
        const hasVal = key in cellMap;
        const val = cellMap[key] ?? 0;
        const px = pad.l + cIdx * cw;
        const py = pad.t + rIdx * ch;

        let fill = 'var(--border)';
        let opacity = 0.1;
        let titleText = `${esc(x)}, ${esc(y)}: no data`;

        if (hasVal) {
          const pct = (val - zMin) / (zMax - zMin);
          fill = 'var(--accent)';
          opacity = 0.15 + pct * 0.85;
          titleText = `${esc(x)}, ${esc(y)}: ${formatNum(val)}`;
        }

        cells.push(`
          <rect x="${px + 0.5}" y="${py + 0.5}" width="${cw - 1}" height="${ch - 1}" fill="${fill}" fill-opacity="${opacity}" rx="2" class="ch-cell">
            <title>${titleText}</title>
          </rect>
        `);
      });
    });

    // Draw Y labels (left)
    const yLabels = gridY.map((y, rIdx) => {
      const py = pad.t + rIdx * ch + ch / 2 + 3;
      const displayY = y.length > 15 ? y.slice(0, 13) + '..' : y;
      return `<text x="${pad.l - 8}" y="${py}" class="ch-lbl-y" font-size="9px">${esc(displayY)}</text>`;
    }).join('');

    // Draw X labels (bottom)
    const xStep = ctx.showAllXLabels ? 1 : Math.ceil(gridX.length / 15);
    const xAngle = ctx.showAllXLabels ? 45 : 25;
    const xFont = ctx.showAllXLabels ? 8 : 9;
    const xLabels = gridX.map((x, cIdx) => {
      if (cIdx % xStep !== 0) return '';
      const px = pad.l + cIdx * cw + cw / 2;
      const py = pad.t + ih + 12;
      const displayX = x.length > 12 ? x.slice(0, 10) + '..' : x;
      return `<text x="${px}" y="${py}" class="ch-lbl-x-c" font-size="${xFont}px" transform="rotate(${xAngle} ${px} ${py})">${esc(displayX)}</text>`;
    }).join('');

    // Draw legend
    const legendW = 15;
    const legendH = ih;
    const gradientId = 'ch-heatmap-grad';
    const legendAnchor = resolveLegendAnchor(
      W,
      H,
      ctx.legendPosition,
      { x: W - pad.r + 25, y: pad.t },
      ctx.legendOffsetX,
      ctx.legendOffsetY,
      4,
    );

    const legendSvg = `
      <defs>
        <linearGradient id="${gradientId}" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.15"/>
          <stop offset="100%" stop-color="var(--accent)" stop-opacity="1.0"/>
        </linearGradient>
      </defs>
      <g transform="translate(${legendAnchor.x}, ${legendAnchor.y})">
        <rect x="0" y="0" width="${legendW}" height="${legendH}" fill="url(#${gradientId})" rx="2" />
        <text x="${legendW + 6}" y="8" class="ch-lbl-y" font-size="9px" text-anchor="start">${formatNum(zMax)}</text>
        <text x="${legendW + 6}" y="${legendH - 2}" class="ch-lbl-y" font-size="9px" text-anchor="start">${formatNum(zMin)}</text>
        <text transform="rotate(90 ${legendW + 35} ${legendH / 2})" x="${legendW + 35}" y="${legendH / 2}" class="ch-title" font-size="10px" text-anchor="middle">${esc(cols[zi] ?? 'Nilai')}</text>
      </g>
    `;

    const chartTitle = `<text x="${W / 2}" y="${22}" class="ch-title" font-size="13px" font-weight="700">${esc(cols[xi])} vs ${esc(cols[yi])} (${esc(cols[zi])})</text>`;

    const truncationNote = (sortedX.length > 30 || sortedY.length > 20)
      ? `<text x="${pad.l}" y="${H - 4}" class="ch-lbl-x" font-size="8px" fill="var(--muted)">* Menampilkan ${Math.min(30, sortedX.length)}x${Math.min(20, sortedY.length)} kategori pertama</text>`
      : '';

    return `
      ${chartTitle}
      <g class="ch-grid-cells">${cells.join('')}</g>
      <g class="ch-y-labels">${yLabels}</g>
      <g class="ch-x-labels">${xLabels}</g>
      ${legendSvg}
      ${truncationNote}
    `;
  }
};

// ponytail: stacked bar clamp negatif ke 0; diverging stack (positif/negatif split baseline) tambah kalau data punya negatif bermakna.
const StackedBarChartRenderer: ChartRenderer = {
  id: 'stackedbar',
  name: 'Stacked Bar',
  render(ctx) {
    const { width: W, height: H, cols, rows, xi, formatNum, esc } = ctx;
    // Semua kolom numerik selain X → jadi series yang ditumpuk
    const seriesIdx = cols.map((_, i) => i).filter((i) => i !== xi && isNumericCol(rows, i));
    if (seriesIdx.length === 0) {
      return `<text x="${W / 2}" y="${H / 2}" class="ch-title" text-anchor="middle">Tidak ada kolom numerik (selain X) untuk ditumpuk.</text>`;
    }

    const rowMax = rows.map((r) => seriesIdx.reduce((s, i) => s + Math.max(0, num(r[i]) ?? 0), 0));
    const yMax = Math.max(1, ...rowMax);

    const ticks = Array.from({ length: 5 }, (_, k) => formatNum((k / 4) * yMax));
    const pad = { l: Math.max(56, Math.max(...ticks.map((t) => t.length)) * 6.5 + 36), r: 170, t: 20, b: ctx.showAllXLabels ? 88 : 64 };
    const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
    const yScale = (v: number): number => pad.t + ih - (v / yMax) * ih;

    const n = rows.length;
    const bw = iw / Math.max(1, n);
    const cx = (k: number): number => pad.l + bw * k + bw / 2;
    const barW = Math.min(bw * 0.7, 44);

    const segments: string[] = [];
    rows.forEach((r, k) => {
      let acc = 0;
      seriesIdx.forEach((si, sIdx) => {
        const v = Math.max(0, num(r[si]) ?? 0);
        if (v === 0) return;
        const yBot = yScale(acc), yTop = yScale(acc + v);
        acc += v;
        segments.push(`<rect x="${cx(k) - barW / 2}" y="${yTop}" width="${barW}" height="${Math.max(0, yBot - yTop)}" fill="${PALETTE[sIdx % PALETTE.length]}" opacity="0.88"><title>${esc(cols[si])}: ${formatNum(v)}</title></rect>`);
      });
    });

    const yTicks = ticks.map((lbl, k) => {
      const y = yScale((k / 4) * yMax);
      return `<line x1="${pad.l - 4}" y1="${y}" x2="${pad.l + iw}" y2="${y}" class="ch-grid"/><text x="${pad.l - 8}" y="${y + 4}" class="ch-lbl-y">${lbl}</text>`;
    }).join('');
    const axes = `<line x1="${pad.l}" y1="${pad.t}" x2="${pad.l}" y2="${pad.t + ih}" class="ch-axis"/><line x1="${pad.l}" y1="${pad.t + ih}" x2="${pad.l + iw}" y2="${pad.t + ih}" class="ch-axis"/>`;

    const xLabels = buildCategoryXLabels({
      rows,
      xi,
      esc,
      cx,
      y: pad.t + ih + 20,
      showAllXLabels: ctx.showAllXLabels,
    });

    const shown = seriesIdx.slice(0, 10);
    const legendAnchor = resolveLegendAnchor(
      W,
      H,
      ctx.legendPosition,
      { x: pad.l + iw + 16, y: 30 },
      ctx.legendOffsetX,
      ctx.legendOffsetY,
      shown.length + (seriesIdx.length > shown.length ? 1 : 0),
    );
    const legend = shown.map((si, sIdx) => {
      const ly = sIdx * 22;
      return `<rect x="0" y="${ly}" width="12" height="12" rx="2" fill="${PALETTE[sIdx % PALETTE.length]}"/><text x="18" y="${ly + 10}" class="ch-legend-text" font-size="10px">${esc(cols[si]).slice(0, 18)}</text>`;
    }).join('') + (seriesIdx.length > shown.length ? `<text x="0" y="${shown.length * 22 + 6}" class="ch-legend-text" font-size="10px" fill="var(--muted)">+${seriesIdx.length - shown.length}</text>` : '');

    return `
      ${yTicks}
      ${axes}
      <g class="ch-bars">${segments.join('')}</g>
      ${xLabels}
      <g class="ch-legend" transform="translate(${legendAnchor.x}, ${legendAnchor.y})">${legend}</g>
      <text x="${pad.l + iw / 2}" y="${H - 4}" class="ch-title">${esc(cols[xi] ?? '')}</text>
    `;
  }
};

// Combo: batang (Y1, axis kiri) + garis (Y2, axis kanan). Dual-axis karena dua series biasanya beda skala.
const ComboChartRenderer: ChartRenderer = {
  id: 'combo',
  name: 'Combo (Bar+Line)',
  render(ctx) {
    const { width: W, height: H, cols, rows, xi, yi, formatNum, esc } = ctx;
    const zi = ctx.zi ?? yi;

    const barVals = rows.map((r) => num(r[yi])).filter((v): v is number => v != null);
    const lineVals = rows.map((r) => num(r[zi])).filter((v): v is number => v != null);
    if (barVals.length === 0 || lineVals.length === 0) {
      return `<text x="${W / 2}" y="${H / 2}" class="ch-title" text-anchor="middle">Kolom Y₁ dan Y₂ harus numerik.</text>`;
    }

    let barMin = Math.min(0, ...barVals), barMax = Math.max(0, ...barVals);
    if (barMin === barMax) barMax = barMin + 1;
    let lineMin = Math.min(0, ...lineVals), lineMax = Math.max(0, ...lineVals);
    if (lineMin === lineMax) lineMax = lineMin + 1;

    const barTicks = Array.from({ length: 5 }, (_, k) => formatNum(barMin + (k / 4) * (barMax - barMin)));
    const lineTicks = Array.from({ length: 5 }, (_, k) => formatNum(lineMin + (k / 4) * (lineMax - lineMin)));

    const pad = {
      l: Math.max(56, Math.max(...barTicks.map((t) => t.length)) * 6.5 + 36),
      r: Math.max(56, Math.max(...lineTicks.map((t) => t.length)) * 6.5 + 36),
      t: 20, b: ctx.showAllXLabels ? 88 : 64,
    };
    const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
    const barScale = (v: number): number => pad.t + ih - ((v - barMin) / (barMax - barMin)) * ih;
    const lineScale = (v: number): number => pad.t + ih - ((v - lineMin) / (lineMax - lineMin)) * ih;

    const n = rows.length;
    const bw = iw / Math.max(1, n);
    const cx = (k: number): number => pad.l + bw * k + bw / 2;
    const barW = Math.min(bw * 0.6, 40);
    const barColor = 'var(--accent)';
    const lineColor = PALETTE[1];

    const bars = rows.map((r, k) => {
      const y = num(r[yi]);
      if (y == null) return '';
      const top = barScale(y), base = barScale(0);
      return `<rect x="${cx(k) - barW / 2}" y="${Math.min(top, base)}" width="${barW}" height="${Math.abs(base - top)}" fill="${barColor}" opacity="0.55"><title>${esc(cols[yi])}: ${formatNum(y)}</title></rect>`;
    }).join('');

    const linePts = rows.map((r, k) => {
      const y = num(r[zi]);
      return y == null ? null : `${cx(k)},${lineScale(y)}`;
    }).filter((p): p is string => p != null);
    const linePath = `<polyline points="${linePts.join(' ')}" fill="none" stroke="${lineColor}" stroke-width="2"/>`;
    const lineDots = rows.map((r, k) => {
      const y = num(r[zi]);
      return y == null ? '' : `<circle cx="${cx(k)}" cy="${lineScale(y)}" r="3" fill="${lineColor}"><title>${esc(cols[zi])}: ${formatNum(y)}</title></circle>`;
    }).join('');

    const yAxis = barTicks.map((lbl, k) => {
      const v = barMin + (k / 4) * (barMax - barMin), y = barScale(v);
      return `<line x1="${pad.l - 4}" y1="${y}" x2="${pad.l + iw}" y2="${y}" class="ch-grid"/><text x="${pad.l - 8}" y="${y + 4}" class="ch-lbl-y">${lbl}</text>`;
    }).join('');
    const y2Axis = lineTicks.map((lbl, k) => {
      const v = lineMin + (k / 4) * (lineMax - lineMin), y = lineScale(v);
      return `<text x="${pad.l + iw + 8}" y="${y + 4}" class="ch-lbl-x">${lbl}</text>`;
    }).join('');
    const axes = `<line x1="${pad.l}" y1="${pad.t}" x2="${pad.l}" y2="${pad.t + ih}" class="ch-axis"/><line x1="${pad.l + iw}" y1="${pad.t}" x2="${pad.l + iw}" y2="${pad.t + ih}" class="ch-axis"/><line x1="${pad.l}" y1="${pad.t + ih}" x2="${pad.l + iw}" y2="${pad.t + ih}" class="ch-axis"/>`;

    const xLabels = buildCategoryXLabels({
      rows,
      xi,
      esc,
      cx,
      y: pad.t + ih + 20,
      showAllXLabels: ctx.showAllXLabels,
    });

    const legendAnchor = resolveLegendAnchor(
      W,
      H,
      ctx.legendPosition,
      { x: pad.l + 8, y: pad.t - 6 },
      ctx.legendOffsetX,
      ctx.legendOffsetY,
      1,
    );
    const legend = `
      <rect x="0" y="0" width="12" height="12" rx="2" fill="${barColor}" opacity="0.55"/>
      <text x="18" y="10" class="ch-legend-text" font-size="10px">${esc(cols[yi]).slice(0, 16)}</text>
      <line x1="108" y1="6" x2="128" y2="6" stroke="${lineColor}" stroke-width="2"/>
      <circle cx="118" cy="6" r="3" fill="${lineColor}"/>
      <text x="134" y="10" class="ch-legend-text" font-size="10px">${esc(cols[zi]).slice(0, 16)}</text>
    `;

    return `
      ${yAxis}
      ${y2Axis}
      ${axes}
      <g class="ch-bars">${bars}</g>
      ${linePath}
      ${lineDots}
      ${xLabels}
      <g class="ch-legend" transform="translate(${legendAnchor.x}, ${legendAnchor.y})">${legend}</g>
      <text x="${pad.l + iw / 2}" y="${H - 4}" class="ch-title">${esc(cols[xi] ?? '')}</text>
    `;
  }
};

// Map Registry untuk renderers grafik
const chartRenderers: Record<ChartType, ChartRenderer> = {
  bar: BarChartRenderer,
  line: LineChartRenderer,
  scatter: ScatterChartRenderer,
  pie: PieChartRenderer,
  donut: DonutChartRenderer,
  area: AreaChartRenderer,
  heatmap: HeatmapChartRenderer,
  stackedbar: StackedBarChartRenderer,
  combo: ComboChartRenderer,
};

export const mountChartView = (host: HTMLElement): ChartViewApi => {
  let cols: string[] = [];
  let rows: unknown[][] = [];
  let type: ChartType = 'bar';
  let xi = 0;
  let yi = 1;
  let zi = 2;
  let showAllXLabels = false;
  let legendPosition: LegendPosition = 'outside-right';
  let legendOffsetX = 0;
  let legendOffsetY = 0;

  const clear = (): void => {
    host.innerHTML = '<div class="muted" style="padding:12px">Tidak ada data untuk divisualisasikan.</div>';
    cols = [];
    rows = [];
    type = 'bar';
    xi = -1;
    yi = -1;
    zi = -1;
    showAllXLabels = false;
    legendPosition = 'outside-right';
    legendOffsetX = 0;
    legendOffsetY = 0;
  };

  const option = (label: string, i: number, sel: number): string =>
    `<option value="${i}"${i === sel ? ' selected' : ''}>${esc(label)}</option>`;

  const renderControls = (): string => {
    const numericYs = cols.map((_, i) => i).filter((i) => isNumericCol(rows, i));

    const xOptions = [
      `<option value="-1"${xi === -1 ? ' selected' : ''}>-- Pilih Kolom X --</option>`,
      ...cols.map((c, i) => option(c, i, xi))
    ].join('');

    let yOptions = '';
    if (type === 'heatmap') {
      yOptions = [
        `<option value="-1"${yi === -1 ? ' selected' : ''}>-- Pilih Kolom Y --</option>`,
        ...cols.map((c, i) => option(c, i, yi))
      ].join('');
    } else {
      yOptions = numericYs.length > 0
        ? [
            `<option value="-1"${yi === -1 ? ' selected' : ''}>-- Pilih Kolom Y --</option>`,
            ...numericYs.map((i) => option(cols[i], i, yi))
          ].join('')
        : option('(tak ada kolom numerik)', -1, -1);
    }

    const zSelector = (type === 'heatmap' || type === 'combo')
      ? `<label>${type === 'combo' ? 'Garis (Y₂)' : 'Nilai (Z)'}
          <select id="ch-z">
            <option value="-1"${zi === -1 ? ' selected' : ''}>-- Pilih Kolom ${type === 'combo' ? 'Line' : 'Z'} --</option>
            ${numericYs.map((i) => option(cols[i], i, zi)).join('')}
          </select>
        </label>`
      : '';

    const labelX = (type === 'pie' || type === 'donut' || type === 'stackedbar') 
      ? 'Kategori (X)' 
      : (type === 'heatmap' ? 'Kolom X (Horizontal)' : 'Sumbu X');
    const labelY = (type === 'pie' || type === 'donut') 
      ? 'Nilai (Y)' 
      : (type === 'heatmap' ? 'Kolom Y (Vertikal)' : (type === 'combo' ? 'Batang (Y₁)' : 'Sumbu Y'));
    const supportsDenseXLabels = type !== 'pie' && type !== 'donut' && type !== 'scatter';
    const supportsLegendOptions = type === 'pie' || type === 'donut' || type === 'stackedbar' || type === 'combo' || type === 'heatmap';

    const hasData = type === 'heatmap'
      ? xi >= 0 && yi >= 0 && zi >= 0 && isNumericCol(rows, zi)
      : type === 'stackedbar'
      ? xi >= 0 && cols.some((_, i) => i !== xi && isNumericCol(rows, i))
      : type === 'combo'
      ? xi >= 0 && yi >= 0 && zi >= 0 && isNumericCol(rows, yi) && isNumericCol(rows, zi)
      : yi >= 0 && isNumericCol(rows, yi);

    return `
      <div class="chart-controls">
        <div class="chart-selectors">
          <label>Tipe
            <select id="ch-type">
              <option value="bar"${type === 'bar' ? ' selected' : ''}>Bar</option>
              <option value="line"${type === 'line' ? ' selected' : ''}>Line</option>
              <option value="scatter"${type === 'scatter' ? ' selected' : ''}>Scatter</option>
              <option value="pie"${type === 'pie' ? ' selected' : ''}>Pie</option>
              <option value="donut"${type === 'donut' ? ' selected' : ''}>Donut</option>
              <option value="area"${type === 'area' ? ' selected' : ''}>Area</option>
              <option value="stackedbar"${type === 'stackedbar' ? ' selected' : ''}>Stacked Bar</option>
              <option value="combo"${type === 'combo' ? ' selected' : ''}>Combo (Bar+Line)</option>
              <option value="heatmap"${type === 'heatmap' ? ' selected' : ''}>Heatmap</option>
            </select>
          </label>
          <label>${labelX}
            <select id="ch-x">${xOptions}</select>
          </label>
          ${type === 'stackedbar'
            ? `<label class="muted" style="align-self:center;font-size:11px">Semua kolom numerik (selain X) otomatis ditumpuk</label>`
            : `<label>${labelY}
            <select id="ch-y">${yOptions}</select>
          </label>`}
          ${zSelector}
          ${supportsDenseXLabels ? `<label class="muted" style="align-self:center;font-size:11px;display:flex;gap:6px;align-items:center">
            <input id="ch-all-x" type="checkbox" ${showAllXLabels ? 'checked' : ''} /> Semua label X (kecil)
          </label>` : ''}
          ${supportsLegendOptions ? `<label>Posisi Legend
            <select id="ch-legend-pos">
              <option value="outside-right"${legendPosition === 'outside-right' ? ' selected' : ''}>Outside Right</option>
              <option value="inside-right"${legendPosition === 'inside-right' ? ' selected' : ''}>Inside Right</option>
              <option value="top"${legendPosition === 'top' ? ' selected' : ''}>Top</option>
              <option value="bottom"${legendPosition === 'bottom' ? ' selected' : ''}>Bottom</option>
            </select>
          </label>
          <label>Offset X
            <input id="ch-legend-offset-x" type="number" value="${legendOffsetX}" style="width:72px" />
          </label>
          <label>Offset Y
            <input id="ch-legend-offset-y" type="number" value="${legendOffsetY}" style="width:72px" />
          </label>` : ''}
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
    if (type === 'heatmap') {
      if (xi < 0 || yi < 0 || zi < 0 || !isNumericCol(rows, zi)) {
        return '<div class="muted" style="padding:12px">Pilih kolom X, Y, dan kolom Z numerik untuk membuat heatmap.</div>';
      }
    } else if (type === 'stackedbar') {
      if (xi < 0 || !cols.some((_, i) => i !== xi && isNumericCol(rows, i))) {
        return '<div class="muted" style="padding:12px">Pilih kolom X kategori dengan minimal satu kolom numerik lain untuk stacked bar.</div>';
      }
    } else if (type === 'combo') {
      if (xi < 0 || yi < 0 || zi < 0 || !isNumericCol(rows, yi) || !isNumericCol(rows, zi)) {
        return '<div class="muted" style="padding:12px">Pilih kolom X, Y₁ (batang), dan Y₂ (garis) numerik untuk combo chart.</div>';
      }
    } else {
      if (yi < 0 || !isNumericCol(rows, yi)) {
        return '<div class="muted" style="padding:12px">Pilih kolom Y numerik untuk membuat grafik.</div>';
      }
    }

    const src = rows.slice(0, MAX_POINTS);
    const banner = rows.length > MAX_POINTS ? `<div class="muted" style="padding:4px 8px">Menampilkan ${MAX_POINTS} dari ${rows.length} baris.</div>` : '';

    const renderer = chartRenderers[type];
    if (!renderer) return '<div class="muted" style="padding:12px">Tipe grafik tidak didukung.</div>';

    const ctx: ChartRenderContext = {
      width: W,
      height: H,
      cols,
      rows: src,
      xi,
      yi,
      zi,
      showAllXLabels,
      legendPosition,
      legendOffsetX,
      legendOffsetY,
      formatNum,
      esc,
    };

    const innerSvg = renderer.render(ctx);

    return banner + `<svg viewBox="0 0 ${W} ${H}" class="chart-svg" preserveAspectRatio="xMidYMid meet">
      ${innerSvg}
    </svg>`;
  };

  const paint = (): void => {
    host.innerHTML = renderControls() + `<div class="chart-canvas">${draw()}</div>`;
    
    host.querySelector<HTMLSelectElement>('#ch-type')!.addEventListener('change', (e) => {
      const newType = (e.target as HTMLSelectElement).value as ChartType;
      type = newType;
      
      const numeric = cols.map((_, i) => i).filter((i) => isNumericCol(rows, i));
      if (type === 'heatmap') {
        if (zi < 0 || !isNumericCol(rows, zi)) {
          zi = numeric[0] ?? -1;
        }
        if (xi === yi && cols.length > 1) {
          yi = (xi + 1) % cols.length;
        }
      } else {
        if (yi < 0 || !isNumericCol(rows, yi)) {
          yi = numeric[0] ?? -1;
        }
        if (type === 'combo' && (zi < 0 || !isNumericCol(rows, zi) || zi === yi)) {
          zi = numeric.find((i) => i !== yi) ?? yi;
        }
      }
      paint();
    });

    host.querySelector<HTMLSelectElement>('#ch-x')!.addEventListener('change', (e) => { xi = Number((e.target as HTMLSelectElement).value); paint(); });
    const ySel = host.querySelector<HTMLSelectElement>('#ch-y')!;
    ySel.addEventListener('change', (e) => { yi = Number((e.target as HTMLSelectElement).value); paint(); });

    const zSel = host.querySelector<HTMLSelectElement>('#ch-z');
    if (zSel) {
      zSel.addEventListener('change', (e) => { zi = Number((e.target as HTMLSelectElement).value); paint(); });
    }

    const allXToggle = host.querySelector<HTMLInputElement>('#ch-all-x');
    if (allXToggle) {
      allXToggle.addEventListener('change', (e) => {
        showAllXLabels = (e.target as HTMLInputElement).checked;
        paint();
      });
    }

    const legendPosSel = host.querySelector<HTMLSelectElement>('#ch-legend-pos');
    if (legendPosSel) {
      legendPosSel.addEventListener('change', (e) => {
        legendPosition = (e.target as HTMLSelectElement).value as LegendPosition;
        paint();
      });
    }

    const legendOffsetXInput = host.querySelector<HTMLInputElement>('#ch-legend-offset-x');
    if (legendOffsetXInput) {
      legendOffsetXInput.addEventListener('change', (e) => {
        legendOffsetX = Number((e.target as HTMLInputElement).value) || 0;
        paint();
      });
    }

    const legendOffsetYInput = host.querySelector<HTMLInputElement>('#ch-legend-offset-y');
    if (legendOffsetYInput) {
      legendOffsetYInput.addEventListener('change', (e) => {
        legendOffsetY = Number((e.target as HTMLInputElement).value) || 0;
        paint();
      });
    }

    const btnClear = host.querySelector<HTMLButtonElement>('#btn-clear-chart');
    if (btnClear) {
      btnClear.addEventListener('click', () => {
        xi = -1;
        yi = -1;
        zi = -1;
        showAllXLabels = false;
        legendPosition = 'outside-right';
        legendOffsetX = 0;
        legendOffsetY = 0;
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
    
    const numeric = cols.map((_, i) => i).filter((i) => isNumericCol(rows, i));
    yi = numeric[0] ?? 1;
    xi = cols.findIndex((_, i) => !isNumericCol(rows, i));
    if (xi < 0) xi = 0;

    if (numeric.length > 0) {
      zi = numeric.find(idx => idx !== yi && idx !== xi) ?? numeric[0];
    } else {
      zi = -1;
    }
    paint();
  };

  clear();
  return { render, clear };
};
