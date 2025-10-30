// components/alerts/Alert.tsx
import { ReactNode } from "react";

type AlertType = "success" | "error" | "info";

type AlertProps = {
  children: ReactNode;
  type?: AlertType;
};

const getAlertStyles = (type: AlertType) => {
  switch (type) {
    case "success":
      return {
        background: "#d4edda",
        color: "#155724",
        border: "1px solid #c3e6cb",
      };
    case "error":
      return {
        background: "#f8d7da",
        color: "#721c24",
        border: "1px solid #f5c6cb",
      };
    case "info":
    default:
      return {
        background: "#d1ecf1",
        color: "#0c5460",
        border: "1px solid #bee5eb",
      };
  }
};

export const Alert = ({ children, type = "info" }: AlertProps) => {
  const styles = getAlertStyles(type);

  return (
    <div
      style={{
        position: "fixed",
        top: 20,
        right: 20,
        zIndex: 1000,
        padding: "16px 24px",
        borderRadius: 8,
        boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
        fontWeight: 500,
        ...styles,
      }}
    >
      {children}
    </div>
  );
};
