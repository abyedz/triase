"use client";
import { useState } from "react";
import type { Store } from "../useStore";
import type { ViewName } from "../App";
import { EVAC_STATUS, KAT, KATS, Victim } from "@/lib/triage";
import { dt, exportCSV, exportJSON, hm } from "@/lib/format";

export function PosView({ st, go }: { st: Store; go: (v: ViewName) => void }) {
  const all = st.victims.slice().sort((a, b) => KAT[a.kat].o - KAT[b.kat].o || a.ts - b.ts);
  const total = all.length;
  const ev = all.filter((v) => v.evac?.status === "Sudah dievakuasi").length;
  const prog = all.filter((v) => v.evac?.status === "Dalam proses evakuasi").length;
  const cnt = (k: string) => all.filter((v) => v.kat === k).length;

  const onImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    const rd = new FileReader();
    rd.onload = () => { void st.importData(String(rd.result)); e.target.value = ""; };
    rd.readAsText(f);
  };

  return (
    <>
      <h2>Dashboard korlap / komandan</h2>
      <div className="warn">Ringkasan dan detail per pasien. Data tersinkron antar-perangkat dan diperbarui otomatis setiap 10 detik.</div>
      <div className="tiles">
        <div className="tile" style={{ background: "#174a78" }}><b>{total}</b><span>Total pasien</span></div>
        <div className="tile" style={{ background: "#16804a" }}><b>{ev}</b><span>Sudah dievakuasi</span></div>
        <div className="tile" style={{ background: "#b45309" }}><b>{prog}</b><span>Dalam proses</span></div>
        <div className="tile" style={{ background: "#596779" }}><b>{total - ev - prog}</b><span>Belum dievakuasi</span></div>
      </div>
      <div className="tiles">{KATS.map((k) => <div key={k} className={"tile " + k}><b>{cnt(k)}</b><span>{KAT[k].n}</span></div>)}</div>
      <div className="card">
        <div className="row"><span>Terakhir diperbarui</span><b>{dt(st.now)}</b></div>
        <p className="note" style={{ margin: "8px 0 0" }}>Pemeriksaan fisik yang belum diisi akan tampil sebagai “Belum dicatat”. Data klinis harus diverifikasi petugas dan protokol setempat.</p>
      </div>
      {all.map((v) => <PatientCard key={v.id + ":" + (v.evac?.updatedAt || 0)} v={v} st={st} />)}
      {!all.length && <div className="card"><h2>Belum ada pasien</h2><p className="note">Data pasien akan muncul setelah petugas menyimpan hasil triase.</p></div>}
      <div className="card">
        <h2>Kelola dan bagikan data</h2>
        <p className="note">Data sudah tersimpan di server. Ekspor untuk arsip/rekap, atau impor file JSON dari perangkat lama (hasil ekspor versi file HTML) untuk digabungkan. Ekspor CSV dapat dibuka di Excel.</p>
        <button className="btn pri" onClick={() => { exportJSON(st.me?.name || "", { victims: st.victims, reports: st.reports, tests: st.tests, retri: st.retri }); st.toast("File data TriaSiap berhasil dibuat"); }}>Unduh seluruh data (JSON)</button>
        <button className="btn" onClick={() => { exportCSV(st.victims); st.toast("Rekap pasien berhasil diekspor"); }}>Unduh rekap pasien (CSV / Excel)</button>
        <label htmlFor="import-triasiap">Impor data dari file JSON</label>
        <input id="import-triasiap" type="file" accept=".json,application/json" onChange={onImport} />
      </div>
      <button className="btn ghost" onClick={() => go("lapor")}>Kembali ke laporan</button>
    </>
  );
}

function PatientCard({ v, st }: { v: Victim; st: Store }) {
  const a = v.assessment || {}, e = v.evac, hist = v.hist || [], eh = v.evacHist || [];
  const val = (k: keyof typeof a) => a[k] || "Belum dicatat";
  const [status, setStatus] = useState(e.status || "Belum dievakuasi");
  const [officer, setOfficer] = useState(e.officer || "");
  const [dest, setDest] = useState(e.destination || "");
  const [note, setNote] = useState(e.note || "");
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try { await st.saveEvac(v.id, { status, officer: officer.trim(), destination: dest.trim(), note: note.trim() }); } finally { setBusy(false); }
  };
  const R = ({ k, children }: { k: string; children: React.ReactNode }) => <div className="row"><span>{k}</span><b>{children}</b></div>;
  return (
    <article className="patient-detail" style={{ borderLeft: `6px solid var(--${v.kat})` }}>
      <div className="vi"><div>
        <b style={{ fontSize: 20 }}>{v.id}</b> <span className={"badge " + v.kat}>{KAT[v.kat].n}</span>
        <div className="sub">{v.lok} · triase {hm(v.ts)} · {v.op || "Petugas tidak tercatat"}</div>
      </div></div>
      <div className="section-title">Hasil triase</div>
      <R k="Alasan kategori">{v.why || "-"}</R>
      <R k="Riwayat pemeriksaan">{hist.length + 1} kali</R>
      <div className="section-title">Profil dan pemeriksaan fisik</div>
      <R k="Usia / jenis kelamin">{val("age")} / {val("sex")}</R>
      <R k="Kesadaran">{val("conscious")}</R>
      <R k="Frekuensi napas">{val("rr")} kali/menit</R>
      <R k="Denyut nadi">{val("pulse")} kali/menit</R>
      <R k="Tekanan darah">{val("bp")}</R>
      <R k="SpO₂">{val("spo2")}%</R>
      <R k="Suhu">{val("temp")} °C</R>
      <R k="Perdarahan">{val("bleeding")}</R>
      <R k="Skala nyeri">{val("pain")}</R>
      <R k="Cedera / kondisi fisik">{val("injury")}</R>
      <R k="Tindakan awal">{val("intervention")}</R>
      <R k="Catatan">{val("note")}</R>
      <div className="section-title">Status evakuasi</div>
      <R k="Status saat ini">{e.status || "Belum dievakuasi"}</R>
      <R k="Tujuan">{e.destination || "Belum dicatat"}</R>
      <R k="Petugas evakuasi">{e.officer || "Belum dicatat"}</R>
      <R k="Waktu evakuasi">{e.time ? dt(e.time) : "Belum dicatat"}</R>
      <R k="Catatan evakuasi">{e.note || "Belum ada"}</R>
      <div className="section-title">Perbarui status evakuasi</div>
      <div className="evac-grid">
        <div><label htmlFor={"evs-" + v.id}>Status</label>
          <select id={"evs-" + v.id} value={status} onChange={(x) => setStatus(x.target.value)}>{EVAC_STATUS.map((s) => <option key={s}>{s}</option>)}</select></div>
        <div><label htmlFor={"evo-" + v.id}>Nama/kode petugas</label>
          <input id={"evo-" + v.id} type="text" maxLength={60} placeholder="Petugas evakuasi" value={officer} onChange={(x) => setOfficer(x.target.value)} /></div>
        <div className="wide"><label htmlFor={"evd-" + v.id}>Tujuan evakuasi</label>
          <input id={"evd-" + v.id} type="text" maxLength={120} placeholder="Contoh: RS / pos medis" value={dest} onChange={(x) => setDest(x.target.value)} /></div>
        <div className="wide"><label htmlFor={"evn-" + v.id}>Catatan pemindahan</label>
          <textarea id={"evn-" + v.id} rows={2} maxLength={250} placeholder="Kondisi saat dipindahkan" value={note} onChange={(x) => setNote(x.target.value)} /></div>
      </div>
      <button className="btn pri" disabled={busy || !!v.pending} onClick={() => void save()}>Simpan pembaruan evakuasi</button>
      <div className="section-title">Riwayat retriase</div>
      {hist.length ? hist.slice().reverse().map((h, i) => <R key={i} k={`${hm(h.t)} · ${h.op || "Petugas sebelumnya"}`}>{KAT[h.k]?.n || h.k || "-"}</R>) : <p className="note">Belum ada riwayat retriase.</p>}
      <div className="section-title">Riwayat evakuasi</div>
      {eh.length ? eh.slice().reverse().map((h, i) => <R key={i} k={`${hm(h.time)} · ${h.officer || "-"}`}>{h.status}</R>) : <p className="note">Belum ada perubahan status evakuasi.</p>}
    </article>
  );
}
