import React from "react";

export interface ToastHandle {
  show: (message: string) => void;
}

export const Toast = React.forwardRef<ToastHandle>((props, ref) => {
  const [message, setMessage] = React.useState<string | null>(null);

  React.useImperativeHandle(ref, () => ({
    show: (msg: string) => {
      setMessage(msg);
      setTimeout(() => setMessage(null), 3000);
    },
  }));

  return (
    <div style={{
      position: "fixed",
      bottom: 20,
      left: "50%",
      transform: "translateX(-50%)",
      background: "var(--saffron)",
      color: "#fff",
      padding: "12px 24px",
      borderRadius: 8,
      display: message ? "block" : "none",
      zIndex: 1000,
    }}>
      {message}
    </div>
  );
});
