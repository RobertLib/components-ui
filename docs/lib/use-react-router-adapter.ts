import { useLocation, useNavigate } from "react-router";
import { useMemo } from "react";
import type { RouterAdapter } from "components-ui";
import RouterLink from "./router-link";

/**
 * Connects components-ui to React Router - pass the result to
 * `<UIProvider router={…}>` inside the router. The docs use exactly this,
 * see the Routing page.
 */
export default function useReactRouterAdapter(): RouterAdapter {
  const location = useLocation();
  const navigate = useNavigate();

  return useMemo(
    () => ({
      back: () => navigate(-1),
      Link: RouterLink,
      navigate: (href, options) =>
        navigate(href, { replace: options?.replace }),
      pathname: location.pathname,
      search: location.search,
    }),
    [location.pathname, location.search, navigate],
  );
}
