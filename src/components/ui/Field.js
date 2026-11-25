"use client";

import { Form } from "react-bootstrap";

/** Labelled form control (label + input/select/textarea), used by every modal and form. */
export default function Field({ id, label, className, children, ...controlProps }) {
  return (
    <Form.Group controlId={id} className={className}>
      <Form.Label>{label}</Form.Label>
      {children ?? <Form.Control {...controlProps} />}
    </Form.Group>
  );
}
