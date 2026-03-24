import React, { useEffect } from "react";
import { useLocation } from "react-router-dom";

const ScrollToTop = React.forwardRef<HTMLDivElement>((_props, _ref) => {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
});
ScrollToTop.displayName = "ScrollToTop";

export default ScrollToTop;
