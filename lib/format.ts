import { Victim } from "./triage";

export const hm = (t: number) => new Date(t).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
export const ago = (t: number, now: number) => {
  const m = Math.floor((now - t) / 60000);
  return m < 1 ? "baru saja" : m + " mnt lalu";
};
export const dt = (t: number) => new Date(t).toLocaleString("id-ID");

export const reportText = (victims: Victim[], retri: number, op: string, role: string, now: number, overdueN: number) => {
  const k = (x: string) => victims.filter((v) => v.kat === x).length;
  const mer = victims.filter((v) => v.kat === "merah").map((v) => v.id + " (" + v.lok + ")").join(", ") || "-";
  return (
    "LAPORAN TRIASE START\nWaktu: " + hm(now) + "\nPetugas: " + op + " (" + role + ")\nTotal korban: " + victims.length +
    "\nMERAH " + k("merah") + " | KUNING " + k("kuning") + " | HIJAU " + k("hijau") + " | HITAM " + k("hitam") +
    "\nPerlu retriase (>" + retri + " mnt): " + overdueN + "\nData baru sejak laporan terakhir: " + victims.filter((v) => !v.sent).length +
    "\nKorban MERAH: " + mer
  );
};

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob), a = document.createElement("a");
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}
const today = () => new Date().toISOString().slice(0, 10);

export function exportJSON(by: string, data: unknown) {
  const payload = { app: "TriaSiap", formatVersion: 1, exportedAt: new Date().toISOString(), exportedBy: by || "Koordinator", data };
  download(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }), "TriaSiap_Data_" + today() + ".json");
}

export function exportCSV(victims: Victim[]) {
  const cols = ["ID Pasien", "Lokasi", "Kategori Triase", "Alasan Triase", "Waktu Triase", "Petugas Triase", "Usia", "Jenis Kelamin", "Kesadaran", "Frekuensi Napas", "Nadi", "Tekanan Darah", "SpO2", "Suhu", "Perdarahan", "Skala Nyeri", "Cedera/Kondisi Fisik", "Tindakan Awal", "Catatan", "Status Evakuasi", "Tujuan Evakuasi", "Petugas Evakuasi", "Waktu Evakuasi", "Catatan Evakuasi"];
  const rows = victims.map((v) => {
    const a = v.assessment || {}, e = v.evac;
    return [v.id, v.lok, v.kat.toUpperCase(), v.why, dt(v.ts), v.op, a.age, a.sex, a.conscious, a.rr, a.pulse, a.bp, a.spo2, a.temp, a.bleeding, a.pain, a.injury, a.intervention, a.note, e?.status, e?.destination, e?.officer, e?.time ? dt(e.time) : "", e?.note];
  });
  // Cegah formula injection saat dibuka di Excel
  const cell = (x: unknown) => {
    let s = String(x == null ? "" : x);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
  };
  const csv = [cols, ...rows].map((r) => r.map(cell).join(";")).join("\r\n");
  download(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" }), "TriaSiap_Rekap_Pasien_" + today() + ".csv");
}
