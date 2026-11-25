"use client";

import { useMemo } from "react";
import { LuBox, LuBoxes, LuIndianRupee, LuTriangleAlert } from "react-icons/lu";
import { formatCompactINR } from "@/lib/format";
import { isLowStock } from "@/lib/stock";
import SummaryCards from "@/components/ui/SummaryCards";

/** Summary cards for the Inventory page, calculated from the real product list. */
export default function InventoryStats({ products, loading }) {
  const stats = useMemo(() => {
    const units = products.reduce((sum, p) => sum + (Number(p.quantity) || 0), 0);
    const value = products.reduce((sum, p) => sum + (Number(p.quantity) || 0) * (Number(p.price) || 0), 0);
    return { total: products.length, units, low: products.filter(isLowStock).length, value };
  }, [products]);

  const show = (v) => (loading ? "…" : v);
  const num = (n) => n.toLocaleString("en-IN");

  return (
    <SummaryCards
      cards={[
        { key: "products", Icon: LuBox, badge: "Overview", title: "Total Products",
          value: show(num(stats.total)), note: "Products registered in system" },
        { key: "units", Icon: LuBoxes, badge: "Stock", title: "Total Stock Units",
          value: show(num(stats.units)), note: "Available quantity across products" },
        { key: "low", Icon: LuTriangleAlert, badge: "Attention", title: "Low Stock Items",
          value: show(num(stats.low)), note: "Products below minimum stock level" },
        { key: "value", Icon: LuIndianRupee, badge: "Valuation", title: "Total Stock Value",
          value: show(formatCompactINR(stats.value)), note: "Current inventory valuation" },
      ]}
    />
  );
}
