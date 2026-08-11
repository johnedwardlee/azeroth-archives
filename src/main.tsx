import { Component, StrictMode, type ErrorInfo, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { CharacterManager } from "./character-manager";
import "./globals.css";

class AppErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error("Azeroth Archives renderer failed", error, info); }
  render() {
    if (!this.state.error) return this.props.children;
    return <main className="startup-error"><h1>Azeroth Archives could not open</h1><p>{this.state.error.message}</p><button onClick={() => window.location.reload()}>Reload application</button></main>;
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppErrorBoundary><CharacterManager /></AppErrorBoundary>
  </StrictMode>,
);
