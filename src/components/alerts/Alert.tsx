import { ReactNode } from "react";

type AlertProps = {
  children: ReactNode;
  type?: "success" | "error";
};

export const Alert = ({ children, type }: AlertProps) => {
  return (
    <div
      style={{
        position: "fixed",
        top: 20,
        right: 20,
        zIndex: 1000,
        padding: "16px 24px",
        background: type === "success" ? "#d4edda" : "#f8d7da",
        color: type === "success" ? "#155724" : "#721c24",
        border: `1px solid ${type === "success" ? "#c3e6cb" : "#f5c6cb"}`,
        borderRadius: 8,
        boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
        fontWeight: 500,
      }}
    >
      {children}
    </div>
  );
};
