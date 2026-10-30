import { useEffect, useRef, useState } from "react";
import { useEscapeKey } from "../../hooks/useEscapeKey.jsx";
import { REVISION_TEMPLATES } from "../../utils/revisionTemplates.js";

// Room the full menu needs; it opens upward when there isn't this much below
const MENU_HEIGHT = 380;
const EDGE_GAP = 12;

/**
 * "Suggest Revision" button with quick feedback templates. The menu opens
 * below the button, or above it when the button is near the bottom of the
 * screen, and scrolls if neither side has room for all of it.
 */
export const RevisionTemplateMenu = ({ onPick, disabled = false }) => {
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState({ up: false, maxHeight: MENU_HEIGHT });
  const wrapperRef = useRef(null);
  const buttonRef = useRef(null);

  useEscapeKey(() => setOpen(false), open);

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (e) => {
      if (!wrapperRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, [open]);

  const toggle = () => {
    if (open) {
      setOpen(false);
      return;
    }
    const rect = buttonRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - EDGE_GAP;
    const spaceAbove = rect.top - EDGE_GAP;
    const up = spaceBelow < MENU_HEIGHT && spaceAbove > spaceBelow;
    setPlacement({ up, maxHeight: Math.max(160, Math.min(MENU_HEIGHT, up ? spaceAbove : spaceBelow)) });
    setOpen(true);
  };

  return (
    <div ref={wrapperRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={toggle}
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-brand-navy bg-brand-navy/5 hover:bg-brand-navy/10 border border-brand-navy/20 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60"
      >
        Suggest Revision
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div
          role="menu"
          style={{ maxHeight: placement.maxHeight }}
          className={`absolute right-0 z-30 w-72 max-w-[calc(100vw-2rem)] bg-white border border-gray-200 rounded-xl shadow-xl flex flex-col overflow-hidden ${
            placement.up ? "bottom-full mb-1" : "top-full mt-1"
          }`}
        >
          <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 shrink-0">
            <p className="text-xs font-bold text-gray-600">Quick Revision Templates</p>
            <p className="text-[10px] text-gray-400">Click a template to add it to the feedback field</p>
          </div>
          <ul className="py-1 overflow-y-auto">
            {REVISION_TEMPLATES.map((template) => (
              <li key={template.label}>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    onPick(template.text);
                    setOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-brand-navy/5 focus-visible:bg-brand-navy/5 focus-visible:outline-none transition-colors"
                >
                  <span className="font-semibold text-brand-navy block">{template.label}</span>
                  <span className="text-gray-500 line-clamp-1">{template.text}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
