"use client";

import React, { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

/**
 * Error Boundary component to catch rendering errors
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[ErrorBoundary] Caught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: "300px",
            color: "var(--muted)",
            flexDirection: "column",
            gap: "8px",
          }}
        >
          <div>コンポーネントの表示中にエラーが発生しました</div>
          {this.state.error && (
            <div style={{ fontSize: "0.85rem", color: "#999" }}>
              {this.state.error.message}
            </div>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
