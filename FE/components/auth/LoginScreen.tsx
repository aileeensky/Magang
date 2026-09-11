"use client";
import { useState } from "react";
import type { FormEvent } from "react";
import type { AuthUser } from "../../types";

export default function LoginScreen({
  onLogin,
}: {
  onLogin: (user: AuthUser) => void;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const r = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.message || "Login gagal");
      onLogin(data.user);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Login gagal");
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="login-shell">
      <div className="login-panel">
        <div className="login-brand">
          <div className="brand-mark">S</div>
          <div>
            <b>SIMONIK</b>
            <span>Sistem Monitoring Informasi Kinerja KPK</span>
          </div>
        </div>
        <div className="login-content">
          <div className="login-copy">
            <span className="eyebrow">
              SISTEM MONITORING INFORMASI KINERJA KPK
            </span>
            <h1>Selamat datang kembali</h1>
            <p>
              Masuk untuk mengakses dashboard dan modul sesuai kewenangan Anda.
            </p>
          </div>
          <form className="login-form" onSubmit={submit}>
            <label className="field">
              <span>Username</span>
              <div className="input-icon">
                <i className="bi bi-person" />
                <input
                  autoFocus
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Masukkan username"
                  autoComplete="username"
                />
              </div>
            </label>
            <label className="field">
              <span>Password</span>
              <div className="input-icon">
                <i className="bi bi-lock" />
                <input
                  type={show ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Masukkan password"
                  autoComplete="current-password"
                />
                <button type="button" onClick={() => setShow(!show)}>
                  <i className={`bi ${show ? "bi-eye-slash" : "bi-eye"}`} />
                </button>
              </div>
            </label>
            {error && (
              <div className="login-error">
                <i className="bi bi-exclamation-circle" /> {error}
              </div>
            )}
            <button className="login-submit" disabled={loading}>
              {loading ? (
                <>
                  <i className="bi bi-arrow-repeat spin" /> Memproses…
                </>
              ) : (
                <>
                  Masuk ke SIMONIK <i className="bi bi-arrow-right" />
                </>
              )}
            </button>
          </form>
          <div className="login-footer">
            <span>
              <i className="bi bi-shield-check" /> Akses berbasis peran
            </span>
            <span>
              <i className="bi bi-lock" /> Koneksi aman
            </span>
          </div>
        </div>
      </div>
      <div className="login-side">
        <div className="login-orb orb-one" />
        <div className="login-orb orb-two" />
        <div className="login-side-content">
          <span className="eyebrow">GOVERNANCE • RISK • PERFORMANCE</span>
          <h2>Satu platform untuk kinerja dan risiko yang terintegrasi.</h2>
          <p>
            SIMONIK membantu memastikan informasi yang tepat tersedia bagi
            pengguna yang tepat sesuai kewenangan masing-masing.
          </p>
          <div className="login-feature">
            <i className="bi bi-grid-1x2" />
            <div>
              <b>Dashboard terintegrasi</b>
              <span>Ringkasan informasi lintas modul.</span>
            </div>
          </div>
          <div className="login-feature">
            <i className="bi bi-person-check" />
            <div>
              <b>Role-based access</b>
              <span>Menu dan akses disesuaikan dengan peran.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
