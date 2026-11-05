"use client";
import { useState } from "react";
import { api } from "./api";
import type { Role } from "@/lib/triage";

type Mode = "password" | "email" | "forgot";

export default function Login({ onDone, toast }: { onDone: (role: Role) => void; toast: (m: string) => void }) {
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("Perawat");
  const [mode, setMode] = useState<Mode>("password");
  const [pw, setPw] = useState("");
  const [locked, setLocked] = useState(false);
  const [note, setNote] = useState("Maksimal 3 percobaan. Setelah itu, pemulihan melalui email diperlukan.");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [resetEmail, setResetEmail] = useState("");
  const [resetOtp, setResetOtp] = useState("");
  const [newPw, setNewPw] = useState("");
  const [busy, setBusy] = useState(false);

  const coord = role === "Koordinator";
  const needName = () => { if (!name.trim()) { toast("Isi nama petugas dulu"); return false; } return true; };

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    try { await fn(); } catch { toast("Tidak dapat terhubung ke server"); } finally { setBusy(false); }
  }

  const login = () => run(async () => {
    if (!needName()) return;
    if (coord) {
      if (locked) { toast("Login sandi dikunci. Gunakan pemulihan melalui email."); setMode("forgot"); return; }
      if (!pw) { toast("Masukkan kata sandi koordinator"); return; }
    }
    const r = await api("/api/auth/login", { method: "POST", body: { name: name.trim(), role, password: coord ? pw : undefined } });
    if (r.ok) { setPw(""); onDone(role); return; }
    setPw("");
    if (r.data.locked) { setLocked(true); setMode("forgot"); setNote("Tiga percobaan gagal. Pulihkan sandi melalui email."); }
    else if (typeof r.data.remaining === "number") setNote(`Sandi salah. Sisa percobaan: ${r.data.remaining} dari 3.`);
    toast(r.data.message || "Gagal masuk");
  });

  const sendCode = (purpose: "login" | "reset") => run(async () => {
    const em = (purpose === "login" ? email : resetEmail).trim().toLowerCase();
    if (!em) { toast("Masukkan email terdaftar"); return; }
    const r = await api("/api/auth/code", { method: "POST", body: { action: purpose === "login" ? "send-login" : "send-reset", email: em } });
    toast(r.data.message || "Gagal mengirim kode");
  });

  const verifyLogin = () => run(async () => {
    if (!needName()) return;
    const r = await api("/api/auth/code", { method: "POST", body: { action: "verify-login", email: email.trim().toLowerCase(), code: otp.trim(), name: name.trim() } });
    if (r.ok) { onDone("Koordinator"); return; }
    toast(r.status === 422 ? "Masukkan email dan kode 6 digit" : r.data.message || "Kode tidak valid atau kedaluwarsa");
  });

  const completeReset = () => run(async () => {
    const r = await api("/api/auth/code", { method: "POST", body: { action: "reset", email: resetEmail.trim().toLowerCase(), code: resetOtp.trim(), newPassword: newPw } });
    if (!r.ok) { toast(r.status === 422 ? "Isi email, kode 6 digit, dan sandi minimal 8 karakter" : r.data.message || "Kode tidak valid atau kedaluwarsa"); return; }
    setLocked(false); setNewPw(""); setResetOtp(""); setPw(""); setNote("Kata sandi berhasil diperbarui. Silakan login.");
    setMode("password"); toast("Kata sandi berhasil diperbarui.");
  });

  return (
    <div id="login">
      <div className="card" style={{ marginTop: 40 }}>
        <div className="login-heading">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="brand-logo" src="/logo-login.png" alt="Logo organisasi" />
          <div className="login-kicker">SISTEM INFORMASI TRIase</div>
          <h1>TriaSiap</h1>
          <p className="sub">Triase START, pencatatan korban, dan pemantauan evakuasi dalam satu dashboard.</p>
        </div>
        <label htmlFor="nm">Nama petugas</label>
        <input type="text" id="nm" maxLength={40} placeholder="Masukkan nama petugas" value={name} onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !coord) void login(); }} />
        <label htmlFor="rl">Peran</label>
        <select id="rl" value={role} onChange={(e) => { setRole(e.target.value as Role); setMode("password"); setPw(""); }}>
          <option>Perawat</option><option>Relawan</option><option>Koordinator</option>
        </select>

        {coord && (
          <div>
            <div className="auth-switch">
              <button type="button" className={"btn ghost " + (mode === "password" ? "active" : "")} onClick={() => setMode("password")}>Kata sandi</button>
              <button type="button" className={"btn ghost " + (mode === "email" ? "active" : "")} onClick={() => setMode("email")}>Kode email</button>
            </div>
            {mode === "password" && (
              <div className="auth-panel">
                <label htmlFor="coordinator-password">Kata sandi koordinator</label>
                <input type="password" id="coordinator-password" maxLength={64} autoComplete="current-password" placeholder="Masukkan kata sandi"
                  value={pw} onChange={(e) => setPw(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void login(); }} />
                <button className="btn pri big" disabled={locked || busy} onClick={login}>{locked ? "Login sandi dikunci" : "Masuk sebagai koordinator"}</button>
                <button className="btn ghost" onClick={() => setMode("forgot")}>Lupa sandi?</button>
                <p className="note">{note}</p>
              </div>
            )}
            {mode === "email" && (
              <div className="auth-panel">
                <label htmlFor="login-email">Email terdaftar</label>
                <input type="email" id="login-email" maxLength={120} placeholder="nama@email.com" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                <button className="btn pri big" disabled={busy} onClick={() => sendCode("login")}>Kirim kode login ke email</button>
                <label htmlFor="login-otp">Kode verifikasi</label>
                <input type="text" id="login-otp" inputMode="numeric" maxLength={6} placeholder="Masukkan 6 digit kode" value={otp} onChange={(e) => setOtp(e.target.value)} />
                <button className="btn ghost" disabled={busy} onClick={verifyLogin}>Verifikasi dan masuk</button>
              </div>
            )}
            {mode === "forgot" && (
              <div className="auth-panel">
                <p><b>Pemulihan kata sandi</b></p>
                <p className="note">Masukkan email terdaftar untuk menerima kode verifikasi.</p>
                <label htmlFor="reset-email">Email terdaftar</label>
                <input type="email" id="reset-email" maxLength={120} placeholder="nama@email.com" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} />
                <button className="btn pri" disabled={busy} onClick={() => sendCode("reset")}>Kirim kode pemulihan</button>
                <label htmlFor="reset-otp">Kode verifikasi</label>
                <input type="text" id="reset-otp" inputMode="numeric" maxLength={6} placeholder="Masukkan 6 digit kode" value={resetOtp} onChange={(e) => setResetOtp(e.target.value)} />
                <label htmlFor="new-password">Kata sandi baru</label>
                <input type="password" id="new-password" minLength={8} maxLength={64} placeholder="Minimal 8 karakter" value={newPw} onChange={(e) => setNewPw(e.target.value)} />
                <button className="btn" disabled={busy} onClick={completeReset}>Atur ulang kata sandi</button>
                <button className="btn ghost" onClick={() => setMode("password")}>Kembali ke login</button>
              </div>
            )}
          </div>
        )}

        {!coord && <div><button className="btn pri big" disabled={busy} onClick={login}>Mulai tugas</button></div>}
        <p className="note">Jangan memasukkan identitas asli korban.</p>
      </div>
    </div>
  );
}
