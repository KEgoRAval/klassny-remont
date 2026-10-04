import { useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { trackPageView } from "@/lib/metrika";
import { prefetchForPath } from "../ssr/prefetch";

export function Head() {
  const [location] = useLocation();

  const firstRender = useRef(true);

  useEffect(() => {
    document.title = prefetchForPath(location).title;
    // The first page view is reported by the counter itself when it loads.
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    trackPageView(window.location.pathname + window.location.search);
  }, [location]);

  return null;
}
