"use client";
import { useState } from "react";
import Login from "./Login";
import { useStore } from "./useStore";
import { TriaseView, TState, newT } from "./views/Triase";
import { DaftarView } from "./views/Daftar";
import { DasborView } from "./views/Dasbor";
import { LaporView } from "./views/Lapor";
import { InfoView } from "./views/Info";
import { PosView } from "./views/Pos";
import type { Role } from "@/lib/triage";

export type ViewName = "triase" | "daftar" | "dasbor" | "lapor" | "info" | "pos";

const NAV: { v: ViewName; label: string; icon: string }[] = [
  { v: "triase", label: "Triase", icon: "M12 5v14M5 12h14" },
  { v: "daftar", label: "Daftar", icon: "M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" },
  { v: "dasbor", label: "Dasbor", icon: "M5 20V10M12 20V4M19 20v-7" },
  { v: "lapor", label: "Lapor", icon: "M21 3 10 14M21 3l-7 18-4-7-7-4z" },
];

export default function App() {
  const st = useStore();
  const [V, setV] = useState<ViewName>("triase");
  const [T, setT] = useState<TState>(newT());

  if (!st.ready) return <div className="wrap"><p className="note" style={{ textAlign: "center", marginTop: 80 }}>Memuat…</p></div>;

  const go = (v: ViewName) => { setV(v); if (v === "triase" && T.stage === "form" && !T.retri) setT(newT()); };
  const onLogin = async (role: Role) => { await st.refresh(true); setT(newT()); setV(role === "Koordinator" ? "pos" : "triase"); };
  const toastEl = <div id="toast" className={st.toastState.show ? "show" : ""} role="status" aria-live="polite">{st.toastState.m}</div>;

  if (!st.me) return <><div className="wrap"><Login onDone={onLogin} toast={st.toast} /></div>{toastEl}</>;

  const view = V === "pos" && st.me.role !== "Koordinator" ? "lapor" : V;
  return (
    <>
      <div className="wrap">
        <div id="app">
          <header>
            <div className="brand">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="lg" src="/logo.png" alt="Logo" />
              <div><h1>TriaSiap</h1><div className="sub">{st.me.name} · {st.me.role}</div></div>
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <button className={"pill " + (st.isOn ? "on" : "off")} onClick={st.toggleSim} title="Ketuk untuk simulasi offline">
                {st.isOn ? "Online" : "Offline"}{st.queued ? ` · ${st.queued} antre` : ""}
              </button>
              <button className="btn sm ghost" onClick={() => { void st.logout(); }}>Keluar</button>
            </div>
          </header>
          <div id="main">
            {view === "triase" && <TriaseView st={st} T={T} setT={setT} go={go} />}
            {view === "daftar" && <DaftarView st={st} onRetri={(id) => {
              const v = st.victims.find((x) => x.id === id); if (!v) return;
              setT({ stage: "q", id: v.id, lok: v.lok, anak: v.anak, path: [], step: "walk", res: null, prev: v.kat, retri: true }); setV("triase");
            }} />}
            {view === "dasbor" && <DasborView st={st} />}
            {view === "lapor" && <LaporView st={st} go={go} />}
            {view === "info" && <InfoView st={st} />}
            {view === "pos" && <PosView st={st} go={go} />}
          </div>
        </div>
      </div>
      <nav id="nav" style={{ display: "flex" }}>
        {NAV.map((n) => (
          <button key={n.v} className={view === n.v ? "act" : ""} onClick={() => go(n.v)}>
            <svg viewBox="0 0 24 24"><path d={n.icon} /></svg>
            {n.label}{n.v === "daftar" ? ` (${st.victims.length})` : ""}
          </button>
        ))}
        <button className={view === "info" ? "act" : ""} onClick={() => go("info")}>
          <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></svg>Info
        </button>
      </nav>
      {toastEl}
    </>
  );
}
