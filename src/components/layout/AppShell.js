"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Button, Dropdown, Image, Nav, Navbar } from "react-bootstrap";
import { toast } from "react-toastify";
import { CgProfile } from "react-icons/cg";
import { MdInventory, MdLogout, MdSpaceDashboard } from "react-icons/md";
import { BiSolidUserAccount } from "react-icons/bi";
import { RiHomeSmileFill } from "react-icons/ri";
import { api } from "@/lib/api";

/** Sidebar + header shared by every logged-in page (was copy-pasted into each page originally). */
export default function AppShell({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [loggingOut, setLoggingOut] = useState(false);

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
      {/* Sidebar */}
      <aside className="sidebar p-3">
        <div className="logo-image my-3">
          <Image src="/images/logo.svg" alt="Logo" fluid className="logo-image" />
        </div>

        <Nav className="flex-column">
          <Nav.Link as={Link} href="/dashboard">
            <MdSpaceDashboard /> Dashboard
          </Nav.Link>
          <Nav.Link as={Link} href="/inventory">
            <MdInventory /> Inventory
          </Nav.Link>
          <Nav.Link as={Link} href="/user-track">
            <BiSolidUserAccount /> Tracking
          </Nav.Link>
        </Nav>

        {pathname !== "/dashboard" && (
          <Nav.Link as={Link} href="/dashboard" className="text-danger mt-auto">
            <Button className="button-add-product2" aria-label="Home">
              <RiHomeSmileFill size={25} />
            </Button>
          </Nav.Link>
        )}
      </aside>

      {/* Main content */}
      <div className="main-content">
        <header>
          <Navbar className="d-flex justify-content-end" bg="light" expand="lg">
            <Navbar.Brand as="div">
              <Dropdown>
                <Dropdown.Toggle variant="light" id="dropdown-basic">
                  <i className="fas fa-caret-down fa-lg" style={{ fontSize: "20px" }}>
                    <CgProfile />
                  </i>
                </Dropdown.Toggle>
                <Dropdown.Menu>
                  <Dropdown.Item onClick={handleLogout} disabled={loggingOut}>
                    <MdLogout /> {loggingOut ? "Logging out..." : "Logout"}
                  </Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown>
            </Navbar.Brand>
          </Navbar>
        </header>

        {children}
      </div>
    </div>
  );
}
