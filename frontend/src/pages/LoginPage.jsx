import { ShieldAlert } from "lucide-react";
import logoUrl from "../../photos/DQTENCH.png";
import { loginUser } from "../api.js";
import { LoginTemplate } from "../components/LoginTemplate.tsx";

export default function LoginPage({ onLogin, setupRequired = false }) {
  const setupWarning = setupRequired ? (
    <div className="message warning">
      <ShieldAlert size={17} />
      No administrator exists. Set INITIAL_ADMIN_PASSWORD in runtime.env and restart the container.
    </div>
  ) : null;

  const submit = async ({ username, password }) => {
    const authenticatedUser = await loginUser(username.trim(), password);
    onLogin(authenticatedUser);
  };

  return (
    <LoginTemplate
      logoSrc={logoUrl}
      logoAlt="DQ.Tech"
      defaultUsername="admin"
      footerContent={setupWarning}
      onSubmit={submit}
    />
  );
}
