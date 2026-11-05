"use client";
import type { Store } from "../useStore";
import type { ViewName } from "../App";
import { hm, reportText } from "@/lib/format";

async function copy(t: string, ok: string, fail: string, toast: (m: string) => void) {
  try { await navigator.clipboard.writeText(t); toast(ok); }
  catch {
    const a = document.createElement("textarea");
    a.value = t; document.body.appendChild(a); a.select();
    try { document.execCommand("copy"); toast(ok); } catch { toast(fail); }
    a.remove();
  }
}

export function LaporView({ st, go }: { st: Store; go: (v: ViewName) => void }) {
  const text = reportText(st.victims, st.retri, st.me?.name || "", st.me?.role || "", st.now, st.victims.filter(st.overdue).length);
  return (
    <>
      <h2>Laporan ke pos komando</h2>
      <div className="card">
        <pre>{text}</pre>
        <button className="btn pri big" onClick={() => void st.sendReport()}>Kirim ke pos komando</button>
        <button className="btn ghost" onClick={() => void copy(text, "Laporan disalin", "Gagal menyalin, blok teks manual", st.toast)}>Salin teks laporan</button>
        {st.me?.role === "Koordinator" && <button className="btn" onClick={() => go("pos")}>Buka dashboard korlap / komandan</button>}
      </div>
      <div className="card">
        <label htmlFor="ri" style={{ marginTop: 0 }}>Pengingat retriase setiap</label>
        <select id="ri" value={st.retri} onChange={(e) => void st.setRetri(+e.target.value)}>
          {[5, 10, 15, 30].map((m) => <option key={m} value={m}>{m} menit (korban merah dan kuning)</option>)}
        </select>
      </div>
      <div className="card">
        <h2>Riwayat laporan</h2>
        {st.reports.length ? st.reports.map((r, i) => (
          <div key={(r.id ?? "q") + "-" + r.t + "-" + i} className="row"><span>{hm(r.t)} · {r.n} korban · {r.op}</span><b>{r.queued ? "Antre (offline)" : "Terkirim"}</b></div>
        )) : <p className="note">Belum ada laporan.</p>}
      </div>
    </>
  );
}
