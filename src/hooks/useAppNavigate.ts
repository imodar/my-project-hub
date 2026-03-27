import { useNavigate, NavigateOptions } from "react-router-dom";
import { flushSync } from "react-dom";

type NavDirection = "forward" | "back" | "tab";

export function useAppNavigate() {
  const navigate = useNavigate();
  return (to: string, options?: NavigateOptions & { direction?: NavDirection }) => {
    const dir = options?.direction ?? "forward";
    document.documentElement.dataset.navDirection = dir;

    if (document.startViewTransition) {
      document.startViewTransition(() => {
        flushSync(() => navigate(to, options));
      });
    } else {
      navigate(to, options);
    }
  };
}
