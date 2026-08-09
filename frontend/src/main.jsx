import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import EnrollmentPage from "./pages/EnrollmentPage.jsx";
import ScanPage from "./pages/ScanPage.jsx";
import "./styles.css";

function pageFromHash() {
  return window.location.hash === "#/enrollment" ? "enrollment" : "scan";
}

export function MainPage() {
  const [page, setPage] = useState(pageFromHash);

  useEffect(() => {
    const syncPage = () => setPage(pageFromHash());
    window.addEventListener("hashchange", syncPage);
    return () => window.removeEventListener("hashchange", syncPage);
  }, []);

  const navigate = (nextPage) => {
    window.location.hash = nextPage === "enrollment" ? "/enrollment" : "/scan";
    setPage(nextPage);
  };

  return page === "enrollment"
    ? <EnrollmentPage onNavigate={navigate} />
    : <ScanPage onNavigate={navigate} />;
}

const rootElement = document.getElementById("root");
if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <MainPage />
    </StrictMode>,
  );
}
