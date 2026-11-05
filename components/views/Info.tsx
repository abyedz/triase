"use client";
import { useState } from "react";
import type { Store } from "../useStore";

const TASKS = ["Triase satu korban baru sampai muncul kartu hasil", "Simpan korban dengan catatan singkat", "Lakukan retriase pada satu korban di Daftar", "Kirim laporan ke pos komando"];
const FLOW = ["Masuk sebagai petugas", "Korban baru: isi lokasi (kode otomatis)", "Triase START dalam 4 tahap pertanyaan", "Kartu hasil dan catatan, lalu simpan", "Daftar dan dasbor: pantau jumlah per kategori", "Retriase korban merah atau kuning (kembali ke tahap START)", "Kirim laporan ke pos komando"];
const ICN = [["Assessment", "Triase START (4 tahap) dan retriase berkala"], ["Intervention", "Instruksi pada hasil: buka jalan napas, hentikan perdarahan"], ["Communication", "Laporan ringkas ke pos komando, termasuk antrean saat offline"]];
const NOVEL = ["Retriase terjadwal: penanda korban yang belum dinilai ulang", "Antrean data saat offline, terkirim otomatis saat online", "Tombol besar, satu pertanyaan per layar, ramah sarung tangan", "Kartu triase digital yang menampilkan alasan penentuan kategori", "Data tersinkron antar-perangkat melalui database"];
const LIMITS = [
  "Tidak ada kolom identitas korban, jadi jangan menulis identitas asli pada lokasi atau catatan.",
  "Alat bantu keputusan berbasis algoritma START untuk korban dewasa. Untuk anak-anak gunakan JumpSTART. Isi klinis diverifikasi tim terhadap rujukan, bukan terhadap keluaran AI.",
  "Peran Perawat dan Relawan masuk dengan nama petugas; hanya Koordinator yang dilindungi kata sandi.",
  "Huruf Archivo dan Public Sans berlisensi terbuka (SIL OFL). Ikon dan logo dibuat sendiri.",
];

export function InfoView({ st }: { st: Store }) {
  const [I, setI] = useState<"tentang" | "uji">("tentang");
  return (
    <>
      <h2>Info proyek</h2>
      <div className="chips">
        <button className={"chip " + (I === "tentang" ? "act" : "")} onClick={() => setI("tentang")}>Tentang dan alur</button>
        <button className={"chip " + (I === "uji" ? "act" : "")} onClick={() => setI("uji")}>Uji kegunaan</button>
      </div>
      {I === "tentang" ? <About /> : <Usability st={st} />}
    </>
  );
}

function About() {
  return (
    <>
      <div className="card"><h2>Masalah dan pengguna</h2><p style={{ margin: 0, fontSize: 14 }}>Pada korban massal, pencatatan manual rawan salah kategori dan laporan ke pos komando terlambat. Pengguna: perawat dan relawan di pos triase.</p></div>
      <div className="card"><h2>Alur pengguna</h2><ol className="flow">{FLOW.map((x) => <li key={x}>{x}</li>)}</ol></div>
      <div className="card"><h2>Domain ICN</h2>{ICN.map((x) => <div key={x[0]} className="row"><b>{x[0]}</b><span style={{ textAlign: "right", maxWidth: "65%" }}>{x[1]}</span></div>)}</div>
      <div className="card"><h2>Pembeda (kebaruan)</h2><ul className="ul">{NOVEL.map((x) => <li key={x}>{x}</li>)}</ul></div>
      <div className="card"><h2>Kepatuhan dan batasan</h2><ul className="ul">{LIMITS.map((x) => <li key={x}>{x}</li>)}</ul></div>
      <div className="card"><h2>Penggunaan AI</h2><p style={{ margin: 0, fontSize: 14 }}>Claude Sonnet 5.5 (Anthropic) untuk merancang alur, menulis kode, dan menyusun teks antarmuka prototipe. Prompt dan ringkasan hasil dicatat tim pada Log Penggunaan AI.</p></div>
    </>
  );
}

function Usability({ st }: { st: Store }) {
  const [prl, setPrl] = useState("Perawat");
  const [tk, setTk] = useState<string[]>(TASKS.map(() => "Berhasil"));
  const [psk, setPsk] = useState("3");
  const [pkd, setPkd] = useState("");
  const [ppb, setPpb] = useState("");
  const L = st.tests, n = L.length;
  const pct = TASKS.map((_, i) => (n ? Math.round((L.filter((t) => t.r[i] === "Berhasil").length / n) * 100) : 0));
  const avg = n ? (L.reduce((a, t) => a + t.sk, 0) / n).toFixed(1) : "-";
  const isCoord = st.me?.role === "Koordinator";

  const save = async () => {
    if (await st.saveTest({ role: prl, r: tk, sk: +psk, kd: pkd.trim(), pb: ppb.trim() })) { setTk(TASKS.map(() => "Berhasil")); setPsk("3"); setPkd(""); setPpb(""); }
  };
  const copy = async () => {
    const t = "HASIL UJI KEGUNAAN\nPeserta: " + n + "\n" + TASKS.map((x, i) => "Tugas " + (i + 1) + " (" + x + "): " + pct[i] + "% berhasil").join("\n") +
      "\nSkor kemudahan rata-rata: " + avg + "/5\nKendala dan usulan perbaikan:\n" + L.map((x) => "- " + x.id + ": " + (x.kd || "-") + " | usulan: " + (x.pb || "-")).join("\n");
    try { await navigator.clipboard.writeText(t); st.toast("Teks disalin"); } catch { st.toast("Gagal menyalin"); }
  };

  return (
    <>
      <div className="card">
        <h2>Catat hasil uji</h2>
        <p className="note" style={{ margin: 0 }}>Target 5 sampai 10 calon pengguna. Catat dengan kode peserta saja, tanpa nama.</p>
        <label htmlFor="prl">Peran peserta</label>
        <select id="prl" value={prl} onChange={(e) => setPrl(e.target.value)}><option>Perawat</option><option>Relawan</option><option>Mahasiswa keperawatan</option></select>
        {TASKS.map((t, i) => (
          <div key={t}>
            <label htmlFor={"tk" + i}>Tugas {i + 1}: {t}</label>
            <select id={"tk" + i} value={tk[i]} onChange={(e) => setTk(tk.map((x, j) => (j === i ? e.target.value : x)))}><option>Berhasil</option><option>Dibantu</option><option>Gagal</option></select>
          </div>
        ))}
        <label htmlFor="psk">Kemudahan penggunaan</label>
        <select id="psk" value={psk} onChange={(e) => setPsk(e.target.value)}>
          <option value="5">5 - Sangat mudah</option><option value="4">4 - Mudah</option><option value="3">3 - Cukup</option><option value="2">2 - Sulit</option><option value="1">1 - Sangat sulit</option>
        </select>
        <label htmlFor="pkd">Kendala yang ditemui</label>
        <textarea id="pkd" rows={2} maxLength={300} value={pkd} onChange={(e) => setPkd(e.target.value)} />
        <label htmlFor="ppb">Usulan perbaikan</label>
        <textarea id="ppb" rows={2} maxLength={300} value={ppb} onChange={(e) => setPpb(e.target.value)} />
        <button className="btn pri" onClick={() => void save()}>Simpan hasil peserta</button>
      </div>
      <div className="card">
        <h2>Ringkasan uji</h2>
        <div className="row"><span>Peserta tercatat</span><b>{n}{n >= 5 && n <= 10 ? " (memenuhi target)" : ""}</b></div>
        {TASKS.map((_, i) => <div key={i} className="row"><span>Tugas {i + 1}</span><b>{pct[i]}% berhasil</b></div>)}
        <div className="row"><span>Kemudahan rata-rata</span><b>{avg}/5</b></div>
        <button className="btn" onClick={() => void copy()}>Salin ringkasan untuk laporan</button>
      </div>
      {n > 0 && (
        <div className="card"><h2>Peserta</h2>
          {L.map((t) => (
            <div key={t.id} className="row" style={{ alignItems: "flex-start" }}>
              <div><b>{t.id}</b> · {t.role} · skor {t.sk}/5<div className="sub">Kendala: {t.kd || "-"}</div><div className="sub">Usulan: {t.pb || "-"}</div></div>
              {isCoord && <button className="btn sm ghost" onClick={() => void st.delTest(t.id)}>Hapus</button>}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
