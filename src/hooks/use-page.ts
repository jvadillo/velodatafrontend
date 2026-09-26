import { useEffect, useState } from "react";

export function usePage() {
  const [page, setPage] = useState(() => location.hash.slice(1) || "/");
  useEffect(() => {
    const change = () => {
      setPage(location.hash.slice(1) || "/");
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", change);
    return () => window.removeEventListener("hashchange", change);
  }, []);
  return page;
}
