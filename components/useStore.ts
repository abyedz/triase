"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, NetError } from "./api";
import {
  Assessment, Kat, Report, Session, UsabilityTest, Victim, applyEvac, applyRetri, buildReport, defaultEvac, isOverdue,
} from "@/lib/triage";

type Server = { victims: Victim[]; reports: Report[]; tests: UsabilityTest[]; retri: number };
type Op = {
  key: string; kind: "create" | "retri" | "evac" | "report"; method: "POST" | "PUT" | "PATCH"; url: string; body: unknown;
  victim?: Victim; report?: Report;
};
const OB_KEY = "triasiap_outbox", CACHE_KEY = "triasiap_cache";
const EMPTY: Server = { victims: [], reports: [], tests: [], retri: 10 };

const lsGet = <T,>(k: string): T | null => { try { const s = localStorage.getItem(k); return s ? (JSON.parse(s) as T) : null; } catch { return null; } };
const lsSet = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* penyimpanan penuh/diblokir */ } };

export function useStore() {
  const [ready, setReady] = useState(false);
  const [me, setMe] = useState<Session | null>(null);
  const [srv, setSrv] = useState<Server>(EMPTY);
  const [outbox, setOutboxState] = useState<Op[]>([]);
  const [simOff, setSimOff] = useState(false);
  const [netOn, setNetOn] = useState(true);
  const [now, setNow] = useState(() => Date.now());
  const [toastState, setToastState] = useState({ m: "", show: false });

  const outRef = useRef<Op[]>([]);
  const simRef = useRef(false);
  const netRef = useRef(true);
  const flushing = useRef(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const online = () => netRef.current && !simRef.current;
  const toast = useCallback((m: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToastState({ m, show: true });
    toastTimer.current = setTimeout(() => setToastState((s) => ({ ...s, show: false })), 2400);
  }, []);
  const setOutbox = (list: Op[]) => { outRef.current = list; setOutboxState(list); lsSet(OB_KEY, list); };

  const applyBootstrap = (d: { me: Session; victims: Victim[]; reports: Report[]; tests: UsabilityTest[]; retri: number }) => {
    setMe(d.me);
    setSrv({ victims: d.victims, reports: d.reports, tests: d.tests, retri: d.retri });
    lsSet(CACHE_KEY, d);
  };

  /** Ambil data terbaru dari server. Dilewati bila masih ada antrean offline. */
  const refresh = useCallback(async (force = false) => {
    if (!force && outRef.current.length) return;
    try {
      const r = await api("/api/bootstrap");
      if (r.ok && r.data.me) applyBootstrap(r.data);
      else if (r.ok) { setMe(null); setSrv(EMPTY); }
      else if (!me) { const c = lsGet<Parameters<typeof applyBootstrap>[0]>(CACHE_KEY); if (c) applyBootstrap(c); }
    } catch (e) {
      if (e instanceof NetError) {
        const c = lsGet<Parameters<typeof applyBootstrap>[0]>(CACHE_KEY);
        if (c && !me) { setMe(c.me); setSrv({ victims: c.victims, reports: c.reports, tests: c.tests, retri: c.retri }); }
      }
    } finally {
      setReady(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me]);

  const flush = useCallback(async () => {
    if (flushing.current || !online() || !outRef.current.length) return;
    flushing.current = true;
    let sent = 0;
    try {
      while (outRef.current.length) {
        const op = outRef.current[0];
        let r;
        try { r = await api(op.url, { method: op.method, body: op.body }); } catch { break; }
        if (r.status === 401 || r.status >= 500) break; // coba lagi nanti
        if (!r.ok) toast(r.data.message || "Satu data antrean ditolak server");
        else sent++;
        setOutbox(outRef.current.slice(1));
      }
      if (sent) toast(sent + " data antrean terkirim");
      if (!outRef.current.length) await refresh(true);
    } finally {
      flushing.current = false;
    }
  }, [refresh, toast]);

  // Inisialisasi
  useEffect(() => {
    const ob = lsGet<Op[]>(OB_KEY) || [];
    outRef.current = ob; setOutboxState(ob);
    netRef.current = navigator.onLine; setNetOn(navigator.onLine);
    void refresh(true).then(() => flush());
    const on = () => { netRef.current = true; setNetOn(true); void flush(); };
    const off = () => { netRef.current = false; setNetOn(false); };
    const vis = () => { if (!document.hidden && online()) void flush().then(() => refresh()); };
    window.addEventListener("online", on); window.addEventListener("offline", off); document.addEventListener("visibilitychange", vis);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); document.removeEventListener("visibilitychange", vis); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Polling data (sinkron antar-HP) + penyegaran waktu relatif
  useEffect(() => {
    if (!me) return;
    const poll = setInterval(() => { if (!document.hidden && online()) void flush().then(() => refresh()); }, 10_000);
    const clock = setInterval(() => setNow(Date.now()), 30_000);
    return () => { clearInterval(poll); clearInterval(clock); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me]);

  const toggleSim = () => {
    simRef.current = !simRef.current; setSimOff(simRef.current);
    toast(simRef.current ? "Mode offline (simulasi)" : "Kembali online");
    if (online()) void flush().then(() => refresh());
  };

  const enqueue = (op: Omit<Op, "key">) => setOutbox([...outRef.current, { ...op, key: Math.random().toString(36).slice(2) }]);
  const expired = (status: number) => { if (status === 401) { setMe(null); toast("Sesi berakhir. Silakan masuk kembali."); return true; } return false; };

  // ---------- Aksi ----------
  const pendingVictims = outbox.filter((o) => o.kind === "create" && o.victim).map((o) => o.victim!);
  const victims = [...srv.victims, ...pendingVictims];
  const queuedReports = outbox.filter((o) => o.kind === "report" && o.report).map((o) => ({ ...o.report!, queued: true }));
  const reports = [...queuedReports, ...srv.reports].sort((a, b) => b.t - a.t);

  async function createVictim(b: { lok: string; anak: boolean; kat: Kat; why: string; assessment: Assessment }) {
    const ts = Date.now();
    const body = { ...b, ts };
    if (online()) {
      try {
        const r = await api("/api/victims", { method: "POST", body });
        if (r.ok) { setSrv((s) => ({ ...s, victims: [...s.victims, r.data.victim] })); return { id: r.data.victim.id as string, queued: false }; }
        if (!expired(r.status)) toast(r.data.message || "Gagal menyimpan korban");
        return null;
      } catch { /* jatuh ke antrean */ }
    }
    const id = "ANTRE-" + (pendingVictims.length + 1);
    const victim: Victim = { id, lok: b.lok, anak: b.anak, kat: b.kat, ts, why: b.why, op: me?.name || "", note: b.assessment.note || "", sent: false, assessment: b.assessment, evac: defaultEvac(), hist: [], evacHist: [], pending: true };
    enqueue({ kind: "create", method: "POST", url: "/api/victims", body, victim });
    return { id, queued: true };
  }

  async function retriVictim(id: string, b: { kat: Kat; why: string; assessment: Assessment }) {
    const ts = Date.now(), body = { ...b, ts };
    const optimistic = () => setSrv((s) => ({ ...s, victims: s.victims.map((v) => (v.id === id ? applyRetri(v, { ...b, ts }, me?.name || "") : v)) }));
    if (online()) {
      try {
        const r = await api("/api/victims/" + encodeURIComponent(id), { method: "PUT", body });
        if (r.ok) { setSrv((s) => ({ ...s, victims: s.victims.map((v) => (v.id === id ? r.data.victim : v)) })); return { queued: false }; }
        if (!expired(r.status)) toast(r.data.message || "Gagal menyimpan");
        return null;
      } catch { /* antre */ }
    }
    optimistic();
    enqueue({ kind: "retri", method: "PUT", url: "/api/victims/" + encodeURIComponent(id), body });
    return { queued: true };
  }

  async function saveEvac(id: string, b: { status: string; officer: string; destination: string; note: string }) {
    const ts = Date.now(), body = { ...b, ts };
    if (b.status === "Sudah dievakuasi" && !b.destination) { toast("Isi tujuan evakuasi terlebih dahulu"); return false; }
    const cur = srv.victims.find((v) => v.id === id);
    if (!cur) { toast("Data pasien tidak ditemukan"); return false; }
    const next = applyEvac(cur, { ...b, ts }, me?.name || "");
    if (!next) { toast("Tidak ada perubahan"); return false; }
    const local = () => setSrv((s) => ({ ...s, victims: s.victims.map((v) => (v.id === id ? next : v)) }));
    if (online()) {
      try {
        const r = await api("/api/victims/" + encodeURIComponent(id), { method: "PATCH", body });
        if (r.ok) { setSrv((s) => ({ ...s, victims: s.victims.map((v) => (v.id === id ? r.data.victim : v)) })); toast("Status evakuasi " + id + " diperbarui"); return true; }
        if (!expired(r.status)) toast(r.data.message || "Gagal menyimpan");
        return false;
      } catch { /* antre */ }
    }
    local();
    enqueue({ kind: "evac", method: "PATCH", url: "/api/victims/" + encodeURIComponent(id), body });
    toast("Offline: pembaruan evakuasi masuk antrean");
    return true;
  }

  async function sendReport() {
    if (!victims.length) { toast("Belum ada data korban"); return; }
    if (online()) {
      try {
        const r = await api("/api/reports", { method: "POST", body: {} });
        if (r.ok) { toast("Laporan terkirim ke pos komando"); await refresh(true); return; }
        if (!expired(r.status)) toast(r.data.message || "Gagal mengirim laporan");
        return;
      } catch { /* antre */ }
    }
    const t = Date.now();
    const report = buildReport(victims, srv.retri, me?.name || "", me?.role || "", t) as Report;
    setSrv((s) => ({ ...s, victims: s.victims.map((v) => ({ ...v, sent: true })) }));
    enqueue({ kind: "report", method: "POST", url: "/api/reports", body: { t }, report });
    toast("Offline: laporan masuk antrean");
  }

  async function setRetri(m: number) {
    if (!online()) { toast("Pengaturan perlu koneksi internet"); return; }
    setSrv((s) => ({ ...s, retri: m }));
    try {
      const r = await api("/api/settings", { method: "PUT", body: { retri: m } });
      if (!r.ok) { expired(r.status); await refresh(true); }
    } catch { toast("Gagal menyimpan pengaturan"); }
  }

  async function saveTest(b: { role: string; r: string[]; sk: number; kd: string; pb: string }) {
    try {
      const r = await api("/api/tests", { method: "POST", body: b });
      if (r.ok) { setSrv((s) => ({ ...s, tests: r.data.tests })); toast("Hasil peserta tercatat"); return true; }
      if (!expired(r.status)) toast(r.data.message || "Gagal menyimpan");
    } catch { toast("Perlu koneksi internet"); }
    return false;
  }
  async function delTest(id: string) {
    try {
      const r = await api("/api/tests/" + encodeURIComponent(id), { method: "DELETE" });
      if (r.ok) setSrv((s) => ({ ...s, tests: r.data.tests }));
      else if (!expired(r.status)) toast(r.data.message || "Gagal menghapus");
    } catch { toast("Perlu koneksi internet"); }
  }

  async function clearAll() {
    try {
      const r = await api("/api/victims", { method: "DELETE" });
      if (!r.ok) { if (!expired(r.status)) toast(r.data.message || "Gagal menghapus"); return; }
      toast("Semua data dihapus"); await refresh(true);
    } catch { toast("Perlu koneksi internet"); }
  }

  async function seedDemo() {
    const d: [string, number, Kat, number][] = [["Zona A, reruntuhan", 2, "merah", 25], ["Zona A, reruntuhan", 2, "kuning", 8], ["Zona B, tenda", 0, "hijau", 30], ["Zona B, tenda", 0, "hijau", 22], ["Zona C, jalan utama", 0, "merah", 4], ["Zona C, jalan utama", 0, "hitam", 15], ["Zona A, pintu masuk", 0, "kuning", 14]];
    try {
      for (const [lok, , kat, min] of d) {
        const r = await api("/api/victims", { method: "POST", body: { lok, anak: false, kat, why: "Data contoh", assessment: {}, ts: Date.now() - min * 60000 } });
        if (!r.ok) { if (!expired(r.status)) toast(r.data.message || "Gagal memuat data contoh"); return; }
      }
      toast("Data contoh dimuat"); await refresh(true);
    } catch { toast("Perlu koneksi internet"); }
  }

  async function importData(text: string) {
    let payload;
    try { payload = JSON.parse(text); } catch { toast("Gagal membaca file: format tidak valid"); return; }
    try {
      const r = await api("/api/import", { method: "POST", body: payload });
      if (r.ok) { toast("Data berhasil digabungkan: " + r.data.imported + " pasien"); await refresh(true); }
      else if (!expired(r.status)) toast(r.status === 422 ? "Gagal membaca file: format file tidak sesuai" : r.data.message || "Gagal impor");
    } catch { toast("Perlu koneksi internet"); }
  }

  async function logout() {
    if (online()) await flush();
    try { await api("/api/auth/logout", { method: "POST" }); } catch { /* abaikan */ }
    setMe(null); setSrv(EMPTY);
    try { localStorage.removeItem(CACHE_KEY); } catch { /* abaikan */ }
  }

  const overdue = (v: Victim) => isOverdue(v, srv.retri, now);
  return {
    ready, me, setMe, victims, reports, tests: srv.tests, retri: srv.retri, now, overdue,
    isOn: netOn && !simOff, toggleSim, toast, toastState, queued: outbox.length,
    refresh, createVictim, retriVictim, saveEvac, sendReport, setRetri, saveTest, delTest, clearAll, seedDemo, importData, logout,
  };
}
export type Store = ReturnType<typeof useStore>;
