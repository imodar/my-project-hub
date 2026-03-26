import React from "react";
import { RefreshCw, ArrowRight } from "lucide-react";
import { reportError } from "@/lib/errorReporting";

interface Props {
  children: React.ReactNode;
  /** Label used in error reports, e.g. "chat", "calendar" */
  route?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Lightweight Error Boundary for individual routes.
 * Reports to the centralized errorReporting service and offers
 * retry without full page reload.
 */
class RouteErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    reportError(error, {
      source: `route/${this.props.route || "unknown"}`,
      componentStack: info.componentStack || undefined,
    });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  handleGoHome = () => {
    window.location.href = "/";
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          className="min-h-[60vh] flex flex-col items-center justify-center gap-4 p-6 text-center"
          dir="rtl"
        >
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center"
            style={{ background: "hsl(var(--destructive) / 0.1)" }}
          >
            <RefreshCw size={24} style={{ color: "hsl(var(--destructive))" }} />
          </div>
          <h2 className="text-base font-bold text-foreground">
            حدث خطأ في هذه الصفحة
          </h2>
          <p className="text-xs text-muted-foreground max-w-[260px]">
            لا تقلق — باقي التطبيق يعمل بشكل طبيعي
          </p>
          <div className="flex gap-3 mt-2">
            <button
              onClick={this.handleRetry}
              className="px-5 py-2 rounded-xl bg-primary text-primary-foreground font-semibold text-sm active:scale-95 transition-transform"
            >
              إعادة المحاولة
            </button>
            <button
              onClick={this.handleGoHome}
              className="px-5 py-2 rounded-xl font-semibold text-sm active:scale-95 transition-transform flex items-center gap-1.5"
              style={{
                background: "hsl(var(--muted))",
                color: "hsl(var(--muted-foreground))",
              }}
            >
              <ArrowRight size={14} />
              الرئيسية
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default RouteErrorBoundary;
