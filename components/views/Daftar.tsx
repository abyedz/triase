"use client";
import { useState } from "react";
import type { Store } from "../useStore";
import { KAT, KATS } from "@/lib/triage";
import { ago, hm } from "@/lib/format";

export function DaftarView({ st, onRetri }: { st: Store; onRetri: (id: string) => void }) {
  const [F, setF] = useState<string>("semua");
  const list = st.victims.filter((v) => F === "semua" || v.kat === F).sort((a, b) => KAT[a.kat].o - KAT[b.kat].o || a.ts - b.ts);
  return (
    <>
      <h2>Daftar korban</h2>
      <div className="chips">
        {["semua", ...KATS].map((f) => (
          <button key={f} className={"chip " + (F === f ? "act" : "")} onClick={() => setF(f)}>{f === "semua" ? "Semua" : KAT[f as keyof typeof KAT].n}</button>
        ))}
      </div>
      {list.map((v) => (
        <div key={v.id} className="card" style={{ borderLeft: `6px solid var(--${v.kat})` }}>
          <div className="vi">
            <div>
              <b style={{ fontSize: 18 }}>{v.id}</b> <span className={"badge " + v.kat}>{KAT[v.kat].n}</span>{" "}
              {st.overdue(v) && <span className="tag">Perlu retriase</span>}
              {v.pending && <span className="tag" style={{ background: "#6b7280" }}>Menunggu sinkron</span>}
              <div className="sub">{v.lok} · dinilai {hm(v.ts)} ({ago(v.ts, st.now)}){v.hist.length ? " · " + (v.hist.length + 1) + "x dinilai" : ""}</div>
              {v.note && <div className="sub">Catatan: {v.note}</div>}
            </div>
            {v.kat !== "hitam" && !v.pending && <button className="btn sm pri" onClick={() => onRetri(v.id)}>Retriase</button>}
          </div>
        </div>
      ))}
      {!list.length && <p className="note">Belum ada korban pada filter ini.</p>}
    </>
  );
}
