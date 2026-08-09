import { LogOut, ShieldCheck } from "lucide-react";
import logoUrl from "../../photos/DQTENCH.png";
import Navigator from "./Navigator.jsx";

export default function Header({ page, user, onNavigate, onLogout }) {
  return (
    <header>
      <button className="brand brand-button" onClick={() => onNavigate("scan")}>
        <img src={logoUrl} alt="DQ.Tech" />
      </button>
      <div className="header-actions">
        <Navigator page={page} user={user} onNavigate={onNavigate} />
        <span className="user-chip"><ShieldCheck size={14} />{user.username}<b>{user.role}</b></span>
        <button className="logout-button secondary" onClick={onLogout}><LogOut size={15} />Sign out</button>
      </div>
    </header>
  );
}
