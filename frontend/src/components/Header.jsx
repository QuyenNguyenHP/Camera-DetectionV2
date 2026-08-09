import { ShieldCheck } from "lucide-react";
import logoUrl from "../../photos/DQTENCH.png";
import Navigator from "./Navigator.jsx";

export default function Header({ page, onNavigate }) {
  return (
    <header>
      <button className="brand brand-button" onClick={() => onNavigate("scan")}>
        <img src={logoUrl} alt="DQ.Tech" />
      </button>
      <div className="header-actions">
        <Navigator page={page} onNavigate={onNavigate} />
      </div>
    </header>
  );
}
