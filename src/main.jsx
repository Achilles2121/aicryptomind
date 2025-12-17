import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { UserTierProvider } from "./context/UserTierContext";
import ErrorBoundary from "./components/ErrorBoundary";

// Build: v2.1.0 - Added professional ErrorBoundary and WelcomeModal

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <ErrorBoundary>
    <React.StrictMode>
      <UserTierProvider>
        <App />
      </UserTierProvider>
    </React.StrictMode>
  </ErrorBoundary>
);
