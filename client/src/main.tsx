import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { applyDailyTheme, getDailyTheme } from "./lib/daily-theme";

applyDailyTheme();
const theme = getDailyTheme();
console.log(`Today's theme: ${theme.name} - ${theme.description}`);

const observer = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    if (mutation.attributeName === 'class') {
      applyDailyTheme();
    }
  });
});
observer.observe(document.documentElement, { attributes: true });

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('SW registered:', registration.scope);
      })
      .catch((error) => {
        console.log('SW registration failed:', error);
      });
  });
}

createRoot(document.getElementById("root")!).render(<App />);
