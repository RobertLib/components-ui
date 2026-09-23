import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import App from "./app";
import { installMockApi } from "./mocks/api";

// Answers the examples' fetch calls to /api/… in the browser
installMockApi();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
