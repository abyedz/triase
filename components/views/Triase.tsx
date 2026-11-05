"use client";
import { useState } from "react";
import type { Store } from "../useStore";
import { ASSESS_KEYS, Assessment, KAT, KATS, Kat, Outcome, ST, STN } from "@/lib/triage";
import type { ViewName } from "../App";

export interface TState {
  stage: "form" | "q" | "res"; id: string; lok: string; anak: boolean; path: string[]; step: string;
  res: Outcome | null; prev: Kat | null; retri: boolean;
}
export const newT = (): TState => ({ stage: "form", id: "", lok: "", anak: false, path: [], step: "walk", res: null, prev: null, retri: false });

const nextId = (ids: string[]) => {
  let m = 0;
  ids.forEach((id) => { const x = /^K-(\d+)$/.exec(id); if (x) m = Math.max(m, +x[1]); });
  return "K-" + String(m + 1).padStart(3, "0");
};

export function TriaseView({ st, T, setT, go }: { st: Store; T: TState; setT: (t: TState) => void; go: (v: ViewName) => void }) {
  const aw = T.anak ? <div className="warn">Korban anak-anak: START dirancang untuk dewasa. Gunakan JumpSTART sesuai protokol setempat.</div> : null;
  const ids = st.victims.map((v) => v.id);

  if (T.stage === "form") return <FormStage st={st} T={T} setT={setT} preview={nextId(ids)} />;

  if (T.stage === "q") {
    const s = ST[T.step], n = STN[T.step];
    const ans = (a: "y" | "n") => {
      const o = s[a][1];
      if (typeof o === "string") setT({ ...T, path: [...T.path, T.step], step: o });
      else setT({ ...T, path: [...T.path, T.step], res: o, stage: "res" });
    };
    const back = () => {
      if (T.path.length) setT({ ...T, step: T.path[T.path.length - 1], path: T.path.slice(0, -1) });
      else if (T.retri) { setT(newT()); go("daftar"); }
      else setT({ ...T, stage: "form" });
    };
    return (
      <>
        <div className="prog"><i style={{ width: n * 25 + "%" }} /></div>
        <div className="meta"><span>{T.id} · {T.lok}{T.retri ? " · retriase" : ""}</span><span>Langkah {n} dari 4</span></div>
        {aw}
        <div className="card">
          <p className="q">{s.q}</p>
          <button className="btn big opt" onClick={() => ans("y")}>{s.y[0]}</button>
          <button className="btn big opt" onClick={() => ans("n")}>{s.n[0]}</button>
        </div>
        <button className="btn ghost" onClick={back}>Kembali</button>
      </>
    );
  }
  return <ResultStage st={st} T={T} setT={setT} aw={aw} />;
}

function FormStage({ st, T, setT, preview }: { st: Store; T: TState; setT: (t: TState) => void; preview: string }) {
  const [lok, setLok] = useState(T.lok);
  const [anak, setAnak] = useState(T.anak);
  const cnt = (k: Kat) => st.victims.filter((v) => v.kat === k).length;
  const start = () => {
    if (!lok.trim()) { st.toast("Isi lokasi temuan"); return; }
    setT({ ...T, id: preview, lok: lok.trim(), anak, stage: "q", step: "walk", path: [] });
  };
  return (
    <>
      <div className="hero">
        <div className="sub2">Korban berikutnya</div>
        <div className="idbox">{preview}</div>
        <div className="strip">{KATS.map((k) => <span key={k} style={{ display: "contents" }}><span className="dot" style={{ background: `var(--${k})` }} /><b>{cnt(k)}</b></span>)}</div>
      </div>
      <div className="card">
        <label htmlFor="lok" style={{ marginTop: 0 }}>Lokasi temuan <span className="note">(jangan tulis identitas korban)</span></label>
        <input type="text" id="lok" maxLength={60} placeholder="Contoh: Zona B, dekat tenda" value={lok} onChange={(e) => setLok(e.target.value)} />
        <label className="chk" style={{ marginTop: 14 }}><input type="checkbox" checked={anak} onChange={(e) => setAnak(e.target.checked)} /> Korban tampak anak-anak</label>
        <button className="btn pri big" onClick={start}>Mulai triase</button>
      </div>
      <p className="note">Alat bantu keputusan berdasarkan algoritma START, bukan pengganti penilaian klinis. Jangan memasukkan identitas asli korban.</p>
    </>
  );
}

function ResultStage({ st, T, setT, aw }: { st: Store; T: TState; setT: (t: TState) => void; aw: React.ReactNode }) {
  const r = T.res!;
  const k = KAT[r.r];
  const existing = T.retri ? st.victims.find((v) => v.id === T.id) : undefined;
  const [a, setA] = useState<Assessment>(() => ({ ...(existing?.assessment || {}) }));
  const [busy, setBusy] = useState(false);
  const set = (key: keyof Assessment) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setA({ ...a, [key]: e.target.value });
  const ch = T.prev && T.prev !== r.r ? <p><b>Berubah dari {KAT[T.prev].n} menjadi {k.n}</b></p> : null;

  const save = async () => {
    if (busy) return;
    setBusy(true);
    const clean: Assessment = {};
    for (const key of ASSESS_KEYS) clean[key] = (a[key] || "").trim();
    try {
      if (T.retri) {
        const res = await st.retriVictim(T.id, { kat: r.r, why: r.w, assessment: clean });
        if (!res) return;
        st.toast(T.id + (res.queued ? " (antre offline): " : " tersimpan: ") + k.n);
      } else {
        const res = await st.createVictim({ lok: T.lok, anak: T.anak, kat: r.r, why: r.w, assessment: clean });
        if (!res) return;
        st.toast(res.id + (res.queued ? " (antre offline): " : " tersimpan: ") + k.n);
      }
      setT(newT());
    } finally { setBusy(false); }
  };
  const again = () => setT({ ...T, stage: "q", step: T.path[T.path.length - 1] ?? "walk", path: T.path.slice(0, -1), res: null });

  return (
    <>
      {aw}
      <div className={"tcard " + r.r}>
        <small>Kartu triase {T.id}</small><h2>{k.n}</h2><div className="pr">Prioritas: {k.d}</div><p>{r.w}</p>{ch}
      </div>
      <div className="card">
        <h2>Data pemeriksaan fisik</h2>
        <p className="note" style={{ margin: 0 }}>Isi berdasarkan hasil pemeriksaan. Kosongkan data yang belum diperiksa. Jangan memasukkan nama atau identitas pribadi korban.</p>
        <div className="assess-grid">
          <div><label htmlFor="age">Perkiraan usia (tahun)</label><input id="age" type="text" inputMode="numeric" maxLength={3} placeholder="Contoh: 25" value={a.age || ""} onChange={set("age")} /></div>
          <div><label htmlFor="sex">Jenis kelamin</label>
            <select id="sex" value={a.sex || ""} onChange={set("sex")}><option value="">Belum dicatat</option><option>Laki-laki</option><option>Perempuan</option><option>Tidak diketahui</option></select></div>
          <div><label htmlFor="conscious">Kesadaran</label>
            <select id="conscious" value={a.conscious || ""} onChange={set("conscious")}><option value="">Belum diperiksa</option><option>Sadar penuh</option><option>Merespons suara</option><option>Merespons nyeri</option><option>Tidak merespons</option><option>Bingung / disorientasi</option></select></div>
          <div><label htmlFor="rr">Frekuensi napas (/menit)</label><input id="rr" type="text" inputMode="numeric" maxLength={3} placeholder="Contoh: 24" value={a.rr || ""} onChange={set("rr")} /></div>
          <div><label htmlFor="pulse">Denyut nadi (/menit)</label><input id="pulse" type="text" inputMode="numeric" maxLength={3} placeholder="Contoh: 96" value={a.pulse || ""} onChange={set("pulse")} /></div>
          <div><label htmlFor="bp">Tekanan darah (mmHg)</label><input id="bp" type="text" maxLength={15} placeholder="Contoh: 120/80" value={a.bp || ""} onChange={set("bp")} /></div>
          <div><label htmlFor="spo2">SpO₂ (%)</label><input id="spo2" type="text" inputMode="numeric" maxLength={3} placeholder="Contoh: 98" value={a.spo2 || ""} onChange={set("spo2")} /></div>
          <div><label htmlFor="temp">Suhu (°C)</label><input id="temp" type="text" inputMode="decimal" maxLength={5} placeholder="Contoh: 36.8" value={a.temp || ""} onChange={set("temp")} /></div>
          <div><label htmlFor="bleeding">Perdarahan</label>
            <select id="bleeding" value={a.bleeding || ""} onChange={set("bleeding")}><option value="">Belum diperiksa</option><option>Tidak ada</option><option>Ringan</option><option>Sedang</option><option>Berat / mengancam jiwa</option></select></div>
          <div><label htmlFor="pain">Skala nyeri (0–10)</label><input id="pain" type="text" inputMode="numeric" maxLength={2} placeholder="Contoh: 5" value={a.pain || ""} onChange={set("pain")} /></div>
        </div>
        <label htmlFor="injury">Cedera / kondisi fisik yang ditemukan</label>
        <textarea id="injury" rows={2} maxLength={300} placeholder="Contoh: luka terbuka pada lengan kiri, dugaan fraktur tungkai" value={a.injury || ""} onChange={set("injury")} />
        <label htmlFor="intervention">Tindakan awal yang diberikan</label>
        <textarea id="intervention" rows={2} maxLength={300} placeholder="Contoh: penekanan langsung pada luka, imobilisasi" value={a.intervention || ""} onChange={set("intervention")} />
        <label htmlFor="cat">Catatan tambahan</label>
        <textarea id="cat" rows={2} maxLength={200} placeholder="Catatan singkat tanpa identitas pribadi" value={a.note || ""} onChange={set("note")} />
      </div>
      <button className="btn pri big" disabled={busy} onClick={save}>Simpan dan korban berikutnya</button>
      <button className="btn ghost" onClick={again}>Ulangi penilaian</button>
    </>
  );
}
