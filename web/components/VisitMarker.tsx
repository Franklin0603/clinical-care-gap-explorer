"use client";

import { useEffect } from "react";
import { markVisited } from "@/lib/visit";

/** Records that this browser has used the application, so arriving at the
 *  landing page later does not greet a returning visitor as new. */
export function VisitMarker() {
  useEffect(() => { markVisited(); }, []);
  return null;
}
