"use client";

import Alert from "./Alert";

export default function RecordStateAlert({ show, variant = "info", title, children }) {
  if (!show) return null;

  return (
    <Alert variant={variant} title={title}>
      {children}
    </Alert>
  );
}
