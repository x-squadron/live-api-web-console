import { useState } from "react";
import { ComposioAppList } from "./composioAppList";
import "./composio-button.scss";

export default function ComposioButton() {
  const [open, setOpen] = useState(false);

  return (
    <div className="composio-dialog">
      <button
        className="action-button material-symbols-outlined"
        onClick={() => setOpen((prev) => !prev)}
      >
        apps
      </button>

      <dialog className="dialog" style={{ display: open ? "block" : "none" }}>
        <div className="dialog-container">
          <ComposioAppList />
        </div>
      </dialog>
    </div>
  );
}
