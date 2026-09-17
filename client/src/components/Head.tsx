import { useEffect } from "react";
import { useLocation } from "wouter";
import { prefetchForPath } from "../ssr/prefetch";

export function Head() {
  const [location] = useLocation();

  useEffect(() => {
    document.title = prefetchForPath(location).title;
  }, [location]);

  return null;
}
