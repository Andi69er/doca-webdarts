import React from "react";
import ReactDOM from "react-dom/client";
import "@livekit/components-styles";
import "./styles.css";
import { App } from "./App";
import { isEmbedded } from "./embed";

if (isEmbedded) document.body.classList.add("webdarts-embedded");

const mount =
  document.getElementById("webdarts-root") ?? document.getElementById("root");

ReactDOM.createRoot(mount!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
