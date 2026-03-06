import React from "react";
import ReactDOM from "react-dom/client";
import BodyTracker from "./App.jsx";

// window.storage: localStorage wrapper matching the API used in the component
window.storage = {
  async get(key) {
    const value = localStorage.getItem(key);
    return value !== null ? { value } : null;
  },
  async set(key, value) {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (e) {
      console.error("Storage full or blocked:", e);
      return false;
    }
  },
};

// Register service worker
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register(import.meta.env.BASE_URL + "sw.js")
      .then((r) => console.log("SW registered:", r.scope))
      .catch((e) => console.log("SW registration failed:", e));
  });
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BodyTracker />
  </React.StrictMode>
);
