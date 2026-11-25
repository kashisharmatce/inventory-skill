"use client";

import { Button, Modal } from "react-bootstrap";

/**
 * Permission popup shown before a destructive or changing action (delete / edit).
 * Pass `show` plus onConfirm / onCancel. `busy` disables the buttons while the request runs.
 */
export default function ConfirmModal({
  show,
  title = "Are you sure?",
  message,
  confirmLabel = "Confirm",
  busyLabel = "Please wait...",
  danger = false,
  busy = false,
  onConfirm,
  onCancel,
}) {
  return (
    <Modal show={show} onHide={busy ? undefined : onCancel} centered backdrop="static" keyboard={!busy}>
      <Modal.Header closeButton={!busy}>
        <Modal.Title>{title}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p className="mb-0">{message}</p>
      </Modal.Body>
      <Modal.Footer>
        <Button className="cancel" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button
          className={danger ? "confirm-danger" : "save"}
          style={danger ? undefined : { width: "auto", minWidth: 100 }}
          onClick={onConfirm}
          disabled={busy}
          autoFocus
        >
          {busy ? busyLabel : confirmLabel}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
