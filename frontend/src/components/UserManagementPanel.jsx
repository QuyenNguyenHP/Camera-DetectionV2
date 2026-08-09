import { useEffect, useState } from "react";
import { CheckCircle2, ShieldCheck, UserCog, UserPlus, WifiOff } from "lucide-react";
import { createUser, getUsers } from "../api.js";

export default function UserManagementPanel() {
  const [users, setUsers] = useState([]);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("user");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    getUsers().then((payload) => setUsers(payload.users || [])).catch((requestError) => setError(requestError.message));
  }, []);

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const payload = await createUser(username.trim(), password, role);
      setUsers(payload.users || []);
      setUsername("");
      setPassword("");
      setRole("user");
      setNotice(payload.message);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="user-management">
      <form className="panel user-form" onSubmit={submit}>
        <p className="panel-label"><UserCog size={13} /> User management</p>
        <h2>Add application user</h2>
        <p className="muted-copy">Users can scan. Admins can also enroll identities and create accounts.</p>
        <div className="user-form-grid">
          <label>
            Username
            <input
              minLength="3"
              maxLength="32"
              pattern="[A-Za-z0-9][A-Za-z0-9_.-]{2,31}"
              required
              autoComplete="off"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
            />
          </label>
          <label>
            Temporary password
            <input
              type="password"
              minLength="12"
              maxLength="128"
              required
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          <label>
            Role
            <select value={role} onChange={(event) => setRole(event.target.value)}>
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </label>
        </div>
        <button className="primary" disabled={busy} type="submit">
          <UserPlus size={17} /> {busy ? "Creating…" : "Create user"}
        </button>
        {error && <div className="message error"><WifiOff size={17} />{error}</div>}
        {notice && <div className="message success"><CheckCircle2 size={17} />{notice}</div>}
      </form>
      <div className="panel user-list-panel">
        <p className="panel-label"><ShieldCheck size={13} /> Application accounts</p>
        <div className="account-list">
          {users.map((account) => (
            <div key={account.id}>
              <span>{account.username}</span>
              <b className={`role-badge ${account.role}`}>{account.role}</b>
            </div>
          ))}
          {!users.length && <p className="muted-copy">No accounts found.</p>}
        </div>
      </div>
    </section>
  );
}
