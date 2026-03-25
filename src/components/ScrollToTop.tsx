import React, { useEffect } from "react";
import { useLocation } from "react-router-dom";

const ScrollToTop = React.forwardRef<HTMLDivElement>((_props, ref) => {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return <div ref={ref} style={{ display: "none" }} />;
});

ScrollToTop.displayName = "ScrollToTop";

export default ScrollToTop;
