"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, Col, Container, Row } from "react-bootstrap";
import { toast } from "react-toastify";
import { api } from "@/lib/api";
import { isLowStock } from "@/lib/stock";
import { monthlyIssued, mostIssuedItem, topUser } from "@/lib/stats";
import SummaryCards from "@/components/ui/SummaryCards";
import { LuBox, LuTriangleAlert, LuTrendingUp, LuUser } from "react-icons/lu";
import BarChart from "@/components/charts/BarChart";

export default function DashboardView() {
  const [products, setProducts] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [p, u] = await Promise.all([api("/storage"), api("/user")]);
        if (!active) return;
        setProducts(p.data);
        setUsers(u.data);
      } catch (error) {
        toast.error(error.message || "Error loading dashboard data");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const cards = useMemo(() => {
    const show = (v) => (loading ? "…" : v);
    const item = mostIssuedItem(users);
    const user = topUser(users);
    return [
      { key: "item", Icon: LuTrendingUp, badge: "Popular", title: "Most Issued Item",
        value: show(item ? item.name : "—"), note: item ? `${item.qty} units issued` : "No components issued yet" },
      { key: "user", Icon: LuUser, badge: "Users", title: "Top User",
        value: show(user ? user.name : "—"), note: user ? `${user.qty} items issued` : "No components issued yet" },
      { key: "products", Icon: LuBox, badge: "Overview", title: "Total Products",
        value: show(products.length), note: "Products registered in system" },
      { key: "low", Icon: LuTriangleAlert, badge: "Attention", title: "Low Stock Items",
        value: show(products.filter(isLowStock).length), note: "Products below minimum stock level" },
    ];
  }, [products, users, loading]);

  const chart = useMemo(() => monthlyIssued(users), [users]);

  return (
    <Container fluid className="flex-grow-1">
      <SummaryCards cards={cards} />

      <Row>
        <Col xs={12}>
          <Card>
            <Card.Body>
              <Card.Title>Graph</Card.Title>
              <div>
                <BarChart label={chart.label} labels={chart.labels} values={chart.values} />
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
}
