"use client";

import { Form } from "react-bootstrap";

/**
 * Labelled form control (label + input/select/textarea), used by every modal and form.
 * Pass `error` (string) to show an inline validation message under the control.
 */
export default function Field({ id, label, className, children, error, ...controlProps }) {
  return (
    <Form.Group controlId={id} className={className}>
      <Form.Label>{label}</Form.Label>
      {children ?? <Form.Control {...controlProps} isInvalid={!!error} />}
      {error ? <Form.Control.Feedback type="invalid">{error}</Form.Control.Feedback> : null}
    </Form.Group>
  );
}
