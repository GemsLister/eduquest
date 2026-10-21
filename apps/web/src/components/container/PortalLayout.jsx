import { createElement, useState } from "react";
import { Outlet } from "react-router-dom";
import { Header } from "../Header.jsx";
import { useEscapeKey } from "../../hooks/useEscapeKey.jsx";

/**
 * Shell shared by the Instructor, Senior Faculty and Department Head portals.
 * On desktop the sidebar sits beside the page; below `md` it becomes a drawer
 * opened from the header's menu button.
 */
export const PortalLayout = ({ sidebar }) => {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const closeMobileNav = () => setMobileNavOpen(false);
  useEscapeKey(closeMobileNav, mobileNavOpen);

  return (
    <div className="flex h-screen overflow-hidden bg-authentic-white">
      {mobileNavOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={closeMobileNav}
          aria-hidden="true"
        />
      )}
      {createElement(sidebar, {
        mobileOpen: mobileNavOpen,
        onNavigate: closeMobileNav,
      })}
      {/* Stable gutter: the page keeps its width whether or not the current
          filter's content is tall enough to need a scrollbar */}
      <div className="flex flex-col flex-1 min-w-0 h-screen overflow-y-auto [scrollbar-gutter:stable]">
        <Header
          onMenuClick={() => setMobileNavOpen(true)}
          menuOpen={mobileNavOpen}
        />
        <main>
          <Outlet />
        </main>
      </div>
    </div>
  );
};
