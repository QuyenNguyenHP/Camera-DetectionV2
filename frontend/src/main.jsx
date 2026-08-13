import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { getAuthStatus, getCurrentUser, logoutUser } from "./api.js";
import EnrollmentPage from "./pages/EnrollmentPage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import ScanPage from "./pages/ScanPage.jsx";
import "./styles.css";

function pageFromHash() {
  return window.location.hash === "#/enrollment" ? "enrollment" : "scan";
}

export function MainPage() {
  const [page, setPage] = useState(pageFromHash);
  const [user, setUser] = useState(null);
  const [setupRequired, setSetupRequired] = useState(false);

  useEffect(() => {
    const loadSession = async () => {
      try {
        setUser(await getCurrentUser());
      } catch {
        setUser(null);
        try {
          const status = await getAuthStatus();
          setSetupRequired(Boolean(status.setupRequired));
        } catch {
          setSetupRequired(false);
        }
      }
    };

    loadSession();
  }, []);

  useEffect(() => {
    const syncPage = () => {
      const requested = pageFromHash();
      if (requested === "enrollment" && user?.role !== "admin") {
        window.location.hash = "/scan";
        setPage("scan");
        return;
      }
      setPage(requested);
    };

    syncPage();
    window.addEventListener("hashchange", syncPage);
    return () => window.removeEventListener("hashchange", syncPage);
  }, [user]);

  useEffect(() => {
    const expireSession = () => setUser(null);
    window.addEventListener("camera-auth-expired", expireSession);
    return () => window.removeEventListener("camera-auth-expired", expireSession);
  }, []);

  const navigate = (nextPage) => {
    const allowedPage = nextPage === "enrollment" && user?.role === "admin" ? "enrollment" : "scan";
    window.location.hash = `/${allowedPage}`;
    setPage(allowedPage);
  };

  const signedIn = (authenticatedUser) => {
    setUser(authenticatedUser);
    setSetupRequired(false);
    navigate("scan");
  };

  const signOut = async () => {
    try {
      await logoutUser();
    } finally {
      setUser(null);
      window.location.hash = "/login";
    }
  };

  if (!user) return <LoginPage onLogin={signedIn} setupRequired={setupRequired} />;

  const authorizedPage = page === "enrollment" && user.role !== "admin" ? "scan" : page;
  return authorizedPage === "enrollment"
    ? <EnrollmentPage user={user} onNavigate={navigate} onLogout={signOut} />
    : <ScanPage user={user} onNavigate={navigate} onLogout={signOut} />;
}

const rootElement = document.getElementById("root");
if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <MainPage />
    </StrictMode>,
  );
}
