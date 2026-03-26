import React from "react";
import { RefreshCw, WifiOff } from "lucide-react";
import { reportError } from "@/lib/errorReporting";

interface ErrorBoundaryState {
  hasError: boolean;
}

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    reportError(error, { source: "AppErrorBoundary", componentStack: info.componentStack || undefined });
  }

  handleReload = () => {
    this.setState({ hasError: false });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      const isOffline = !navigator.onLine;
      return (
        <div
          className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-center bg-background"
          dir="rtl"
        >
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
            {isOffline ? (
              <WifiOff size={28} className="text-muted-foreground" />
            ) : (
              <RefreshCw size={28} className="text-muted-foreground" />
            )}
          </div>
          <h2 className="text-lg font-bold text-foreground">
            {isOffline ? "لا يوجد اتصال بالإنترنت" : "حدث خطأ غير متوقع"}
          </h2>
          <p className="text-sm text-muted-foreground max-w-xs">
            {isOffline
              ? "تحقق من اتصالك بالإنترنت وحاول مرة أخرى"
              : "نعتذر عن هذا الخطأ. يرجى إعادة تحميل الصفحة"}
          </p>
          <button
            onClick={this.handleReload}
            className="mt-2 px-6 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm active:scale-95 transition-transform"
          >
            إعادة تحميل
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
