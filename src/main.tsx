import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { AppProvider } from "./context";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppProvider>
      <App />
    </AppProvider>
  </StrictMode>
);

// Netlify's free plan adds a "Powered by Netlify" badge (an iframe, fixed bottom-right) that can't be
// turned off. When it's there, flag it so the tab bar and rest bar move up and stay tappable.
const flagHostBadge = () => {
  if (document.getElementById("nl-badge-frame")) {
    document.documentElement.dataset.hostBadge = "";
    return true;
  }
  return false;
};
if (!flagHostBadge()) {
  const watcher = new MutationObserver(() => flagHostBadge() && watcher.disconnect());
  watcher.observe(document.body, { childList: true, subtree: true });
}

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => void navigator.serviceWorker.register("/sw.js"));
}
