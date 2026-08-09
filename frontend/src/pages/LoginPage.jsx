import { useState } from "react";
import { LockKeyhole, LogIn, ShieldAlert } from "lucide-react";
import logoUrl from "../../photos/DQTENCH.png";
import { loginUser } from "../api.js";

export default function LoginPage({ onLogin, setupRequired = false }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      onLogin(await loginUser(username.trim(), password));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="login-page">
      <section className="login-shell">
        <div className="login-intro">
          <img src={logoUrl} alt="DQ.Tech" />
          <p className="eyebrow"><LockKeyhole size={14} /> Protected vision console</p>
          <h1>Sign in to continue.</h1>
          <p>Camera analysis and identity information are available only to authorized users.</p>
        </div>
        <form className="panel login-card" onSubmit={submit}>
          <p className="panel-label">Account access</p>
          <label>
            Username
            <input
              autoComplete="username"
              autoFocus
              required
              value={username}
              onChange={(event) => setUsername(event.target.value)}
            />
          </label>
          <label>
            Password
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          <button className="primary full" disabled={busy} type="submit">
            <LogIn size={17} /> {busy ? "Signing in…" : "Sign in"}
          </button>
          {setupRequired && (
            <div className="message warning">
              <ShieldAlert size={17} />
              No administrator exists. Set INITIAL_ADMIN_PASSWORD in runtime.env and restart the container.
            </div>
          )}
          {error && <div className="message error"><ShieldAlert size={17} />{error}</div>}
        </form>
      </section>
    </main>
  );
}
