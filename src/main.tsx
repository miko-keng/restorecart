import "@radix-ui/themes/styles.css";
import "./restorecart/payments-ui.css";
import React from "react";
import { createRoot } from "react-dom/client";
import RestoreCart from "./restorecart/RestoreCartApp";
import "@fontsource-variable/dm-sans";
import "@fontsource-variable/manrope";
import "./base.css";
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RestoreCart />
  </React.StrictMode>,
);
