import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initSentry, installGlobalErrorHandlers } from "./lib/errorReporting";

// Initialize Sentry first (no-op if VITE_SENTRY_DSN not set)
initSentry();
installGlobalErrorHandlers();

createRoot(document.getElementById("root")!).render(<App />);
