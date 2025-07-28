import { createRoot } from "react-dom/client";
import { ThemeProvider } from "@/contexts/theme-context";
import { AIModelProvider } from "@/contexts/ai-model-context";
import { SecurityManager } from "@/utils/security";
import App from "./App";
import "./index.css";

// Initialize security protection (check mobile immediately)
try {
  SecurityManager.init();
} catch (error) {
  console.log('Security init failed:', error);
}

createRoot(document.getElementById("root")!).render(
  <ThemeProvider>
    <AIModelProvider>
      <App />
    </AIModelProvider>
  </ThemeProvider>
);
