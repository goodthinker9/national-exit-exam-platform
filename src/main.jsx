import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import { checkSupabaseConnection } from "./lib/checkConnection.js";
import "./styles.css";

// Check Supabase connection on startup and log result to the console.
checkSupabaseConnection().then(({ ok, status, message, latencyMs }) => {
  const style = ok ? "color: #16a34a; font-weight: bold" : "color: #dc2626; font-weight: bold";
  const icon  = ok ? "✅" : status === "schema_missing" ? "⚠️" : "❌";
  console.log(`%c${icon} Supabase: ${message}`, style);
  if (latencyMs !== undefined) {
    console.log(`   Latency: ${latencyMs} ms`);
  }
  if (status === "schema_missing") {
    console.warn(
      "   → Open Supabase SQL editor and run:\n" +
      "     server/config/wollo-exam-prep-supabase (1).sql",
    );
  }
});

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
