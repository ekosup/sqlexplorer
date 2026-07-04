// FR-05: pesan error mahasiswa-friendly.

export const friendlyError = (err: unknown): string => {
  const msg = err instanceof Error ? err.message : String(err);
  const m1 = /no such table:\s*(\S+)/i.exec(msg);
  if (m1) return `Tabel "${m1[1]}" tidak ditemukan. Cek daftar tabel di panel Schema.`;
  const m2 = /no such column:\s*(\S+)/i.exec(msg);
  if (m2) return `Kolom "${m2[1]}" tidak ditemukan. Cek nama kolom pada tabel terkait.`;
  const m3 = /near "([^"]+)":\s*syntax error/i.exec(msg);
  if (m3) return `Ada kesalahan sintaks di dekat "${m3[1]}". Periksa ejaan atau tanda baca.`;
  return msg;
};
