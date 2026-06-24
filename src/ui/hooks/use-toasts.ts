import { useState } from "react";

export type Toast = {
  id: number;
  type: "success" | "warning" | "info";
  message: string;
};

export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  function showToast(message: string, type: Toast["type"] = "success") {
    const id = Date.now();
    setToasts((current) => [...current, { id, type, message }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 3400);
  }

  return { toasts, showToast };
}
