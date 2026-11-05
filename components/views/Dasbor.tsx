"use client";
import { useRef, useState } from "react";
import type { Store } from "../useStore";
import { KAT, KATS } from "@/lib/triage";

export function DasborView({ st }: { st: Store }) {
  const [confirm, setConfirm] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isCoord = st.me?.role === "Koordinator";
  const n = st.victims.length;
  const cnt = (k: string) => st.victims.filter((v) => v.kat === k).length;
  const od = st.victims.filter(st.overdue).length, un = st.victims.filter((v) => !v.sent).length;

  let a = 0;
  const g: string[] = [];
  KATS.forEach((k) => { const d = n ? (cnt(k) / n) * 360 : 0; if (d) { g.push(`var(--${k}) ${a}deg ${a + d}deg`); a += d; } });
  const bg = n ? `conic-gradient(${g.join(",")})` : "#2a4a70";

  const clear = () => {
    if (!confirm) {
      setConfirm(true); st.toast("Ketuk sekali lagi untuk menghapus semua data");
      timer.current = setTimeout(() => setConfirm(false), 4000); return;
    }
    if (timer.current) clearTimeout(timer.current);
    setConfirm(false); void st.clearAll();
  };

  return (
    <>
      <h2>Ringkasan korban</h2>
      <div className="hero" style={{ display: "flex", gap: 18, alignItems: "center" }}>
        <div className="donut" style={{ background: bg }}><div className="c"><b>{n}</b><span>korban</span></div></div>
        <div className="leg">{KATS.map((k) => <div key={k}><span className={"dot " + k} />{KAT[k].n}<b>{cnt(k)}</b></div>)}</div>
      </div>
      <div className="tiles">{KATS.map((k) => <div key={k} className={"tile " + k}><b>{cnt(k)}</b><span>{KAT[k].n} · {KAT[k].d}</span></div>)}</div>
      <div className="card">
        <div className="row"><span>Total korban</span><b>{n}</b></div>
        <div className="row"><span>Perlu retriase (&gt;{st.retri} mnt)</span><b style={od ? { color: "#b45309" } : undefined}>{od}</b></div>
        <div className="row"><span>Belum dilaporkan</span><b>{un}</b></div>
      </div>
      {isCoord && (
        <>
          <button className="btn" onClick={() => void st.seedDemo()}>Isi data contoh (demo)</button>
          <button className="btn ghost" onClick={clear}>{confirm ? "Ketuk lagi untuk konfirmasi hapus" : "Hapus semua data"}</button>
        </>
      )}
    </>
  );
}
