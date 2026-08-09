import { CheckCircle2, FolderOpen, ScanFace, UserRoundPlus, WifiOff } from "lucide-react";

export default function EnrollmentSidebar({
  name,
  names,
  source,
  busy,
  error,
  notice,
  onNameChange,
  onEnroll,
}) {
  return (
    <aside>
      <div className="panel enroll enrollment-form">
        <p className="panel-label">Identity details</p>
        <div className="enroll-title">
          <UserRoundPlus size={22}/>
          <div><b>Add a known face</b><span>Exactly one face must be visible</span></div>
        </div>
        <label>
          Person's name
          <input aria-label="Person name" placeholder="e.g. Alex Morgan" value={name} onChange={onNameChange} />
        </label>
        <button className="primary full" disabled={busy || source === "empty"} onClick={onEnroll}>
          {busy ? "Enrolling…" : "Enroll identity"}
        </button>
        <small>Photos are stored in <code>backend/data/people/&lt;person&gt;/</code>. Face embeddings remain in <code>faces.json</code>.</small>
      </div>
      <div className="panel people-panel">
        <p className="panel-label"><FolderOpen size={13} /> Enrolled people</p>
        {names.length ? (
          <div className="people-list">{names.map((person) => <span key={person}><ScanFace size={14} />{person}</span>)}</div>
        ) : <p className="muted-copy">No identities enrolled yet.</p>}
      </div>
      {error && <div className="message error"><WifiOff size={17}/>{error}</div>}
      {notice && <div className="message success"><CheckCircle2 size={17}/>{notice}</div>}
    </aside>
  );
}
