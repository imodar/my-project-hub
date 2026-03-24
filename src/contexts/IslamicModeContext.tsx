import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface IslamicModeContextType {
  islamicMode: boolean;
  setIslamicMode: (value: boolean) => void;
}

const IslamicModeContext = createContext<IslamicModeContextType>({
  islamicMode: true,
  setIslamicMode: () => {},
});

export const useIslamicMode = () => useContext(IslamicModeContext);

export const IslamicModeProvider = React.forwardRef<HTMLDivElement, { children: ReactNode }>(({ children }, _ref) => {
  const [islamicMode, setIslamicMode] = useState(() => {
    const stored = localStorage.getItem("islamicMode");
    return stored === null ? true : stored === "true";
  });

  useEffect(() => {
    localStorage.setItem("islamicMode", String(islamicMode));
  }, [islamicMode]);

  return (
    <IslamicModeContext.Provider value={{ islamicMode, setIslamicMode }}>
      {children}
    </IslamicModeContext.Provider>
  );
});
IslamicModeProvider.displayName = "IslamicModeProvider";
