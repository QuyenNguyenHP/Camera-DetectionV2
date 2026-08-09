import { ArrowLeft, UserRoundPlus } from "lucide-react";

export default function Navigator({ page, user, onNavigate }) {
  if (page === "scan" && user.role !== "admin") return null;
  const destination = page === "scan" ? "enrollment" : "scan";

  return (
    <button className="page-link" onClick={() => onNavigate(destination)}>
      {page === "scan" ? <UserRoundPlus size={16} /> : <ArrowLeft size={16} />}
      {page === "scan" ? "Identity enrollment" : "Back to live scan"}
    </button>
  );
}
