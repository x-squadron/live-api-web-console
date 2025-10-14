import { useState } from "react";
import AgentsPanel from "./AgentsPanel";
import "../composio-button/composio-button.scss";

export default function AgentsButton() {
  const [open, setOpen] = useState(false);

  return (
    <div className="composio-dialog">
      <button
        className="action-button material-symbols-outlined"
        onClick={() => setOpen((prev) => !prev)}
        title="Manage Agents"
      >
        group
      </button>
      <dialog className="dialog" style={{ display: open ? "block" : "none" }}>
        <div className="dialog-container">
          <AgentsPanel onClose={() => setOpen(false)} />
        </div>
      </dialog>
    </div>
  );
} 