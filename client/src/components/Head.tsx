import { useEffect } from "react";
import { useLocation } from "wouter";
import { HOME_TITLE, SITE_NAME } from "../ssr/prefetch";

export function Head() {
  const [location] = useLocation();

  useEffect(() => {
    document.title = (location.replace(/\/+$/, "") || "/") === "/"
      ? HOME_TITLE
      : `Страница не найдена — ${SITE_NAME}`;
  }, [location]);

  return null;
}
