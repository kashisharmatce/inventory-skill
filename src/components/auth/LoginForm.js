"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Card, Col, Container, Form, Row } from "react-bootstrap";
import { FaLock } from "react-icons/fa";
import { api } from "@/lib/api";
import Field from "@/components/ui/Field";

export default function LoginForm() {
  const router = useRouter();
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api("/admin/login", { method: "POST", body: { passcode } });
      router.replace("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err.message);
      setPasscode("");
      setLoading(false);
    }
  };

  return (
    <Container className="mt-4 mt-md-5 login-container">
      <Row className="justify-content-md-center">
        <Col xs={12} md={5}>
          <Card>
            <Card.Body>
              <Card.Title>Admin Login</Card.Title>
              {error && <Alert variant="danger">{error}</Alert>}
              <Form onSubmit={handleSubmit}>
                <Field
                  id="accessCode"
                  className="mb-3"
                  label={<><FaLock /> Access Code</>}
                  type="password"
                  name="passcode"
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  placeholder="Enter access code"
                  autoComplete="current-password"
                  autoFocus
                  required
                />
                <Button variant="primary" type="submit" disabled={loading}>
                  {loading ? "Logging in..." : "Login"}
                </Button>
              </Form>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
}
