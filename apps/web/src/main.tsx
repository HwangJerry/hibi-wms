import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./app";
import { TrpcProvider } from "./providers/trpc-provider";
import "./styles/globals.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element not found.");
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <TrpcProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </TrpcProvider>
  </React.StrictMode>,
);
