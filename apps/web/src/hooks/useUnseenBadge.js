import { useEffect, useMemo } from "react";
import { useLocation } from "react-router-dom";

/**
 * Sidebar badges count items that need attention and haven't been looked at
 * yet. Opening one of `paths` (or a page under it) marks every current item as
 * seen, so the badge clears once viewed and only comes back for new items.
 * Put the item's status in its key (e.g. `${id}:${status}`) so an item that
 * changes state counts again.
 *
 * Seen keys live in localStorage per user; if storage is blocked the badge
 * simply counts every item.
 */
const storageKey = (userId, badge) => `sidebarSeen:${userId}:${badge}`;

const readSeen = (key) => {
  try {
    return new Set(JSON.parse(localStorage.getItem(key) || "[]"));
  } catch {
    return new Set();
  }
};

const writeSeen = (key, keys) => {
  try {
    localStorage.setItem(key, JSON.stringify(keys));
  } catch {
    // Storage blocked: the badge just won't remember what was seen
  }
};

export const useUnseenCount = (userId, badge, itemKeys, paths) => {
  const { pathname } = useLocation();
  const onPage = paths.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const keysSignature = itemKeys.join("|");

  useEffect(() => {
    if (!userId || !onPage) return;
    // Everything currently listed has now been seen; older keys are dropped
    writeSeen(storageKey(userId, badge), keysSignature ? keysSignature.split("|") : []);
  }, [userId, badge, onPage, keysSignature]);

  // While on the page the badge is 0; leaving it (onPage flips) re-reads
  // storage, which the effect above has updated by then
  return useMemo(() => {
    if (!userId || onPage || !keysSignature) return 0;
    const seen = readSeen(storageKey(userId, badge));
    return keysSignature.split("|").filter((k) => !seen.has(k)).length;
  }, [userId, badge, onPage, keysSignature]);
};
