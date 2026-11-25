"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Image, Nav } from "react-bootstrap";
import { toast } from "react-toastify";
import { MdFactCheck, MdInventory, MdLogout, MdMenu, MdSpaceDashboard } from "react-icons/md";
import { BiSolidUserAccount } from "react-icons/bi";
import { RiHomeSmileFill } from "react-icons/ri";
import { api } from "@/lib/api";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", Icon: MdSpaceDashboard },
  { href: "/inventory", label: "Inventory", Icon: MdInventory },
  { href: "/user-track", label: "Tracking", Icon: BiSolidUserAccount },
  { href: "/audit-report", label: "Audit Report", Icon: MdFactCheck },
];

/** Sidebar (with logout) shared by every logged-in page. On small screens it is a slide-in drawer. */
export default function AppShell({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [loggingOut, setLoggingOut] = useState(false);
  // Mobile/tablet drawer state (the sidebar is always visible from the lg breakpoint up).
  const [navOpen, setNavOpen] = useState(false);
  const closeNav = () => setNavOpen(false);

  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!navOpen) return;
    const onKey = (e) => e.key === "Escape" && setNavOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navOpen]);

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await api("/admin/logout", { method: "POST" });
      router.replace("/login");
      router.refresh();
    } catch (error) {
      toast.error(error.message);
      setLoggingOut(false);
    }
  };

  return (
    <div className="dashboard">
      {navOpen && <div className="sidebar-backdrop" onClick={closeNav} aria-hidden="true" />}

      {/* Menu button (phones and tablets only) */}
      <button
        type="button"
        className="menu-toggle"
        onClick={() => setNavOpen((open) => !open)}
        aria-label="Toggle navigation menu"
        aria-controls="app-sidebar"
        aria-expanded={navOpen}
      >
        <MdMenu size={24} />
      </button>

      {/* Sidebar */}
      <aside id="app-sidebar" className={`sidebar p-3${navOpen ? " open" : ""}`}>
        <div className="logo-image my-3">
          <Image src="/images/logo.svg" alt="Logo" fluid className="logo-image" />
        </div>

        <Nav className="flex-column">
          {NAV_ITEMS.map(({ href, label, Icon }) => (
            <Nav.Link
              key={href}
              as={Link}
              href={href}
              onClick={closeNav}
              className={pathname === href || pathname.startsWith(`${href}/`) ? "active" : ""}
            >
              <Icon /> {label}
            </Nav.Link>
          ))}
        </Nav>

        <div className="sidebar-footer">
          {pathname !== "/dashboard" && (
            <Link href="/dashboard" className="sidebar-icon-btn" aria-label="Home" title="Home" onClick={closeNav}>
              <RiHomeSmileFill size={18} />
            </Link>
          )}
          <button
            type="button"
            className="sidebar-icon-btn sidebar-icon-btn--logout"
            onClick={handleLogout}
            disabled={loggingOut}
            aria-label="Logout"
            title={loggingOut ? "Logging out..." : "Logout"}
          >
            <MdLogout size={18} />
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="main-content">{children}</div>
    </div>
  );
}
