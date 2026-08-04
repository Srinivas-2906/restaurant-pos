import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import LoginScreen from "./screens/Login";
import FloorScreen from "./screens/Floor";
import OrderScreen from "./screens/Order";
import PaymentScreen from "./screens/Payment";
import KotPreviewScreen from "./screens/KotPreview";
import InboxScreen from "./screens/Inbox";
import DayCloseScreen from "./screens/DayClose";
import DiagnosticsScreen from "./screens/Diagnostics";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LoginScreen />} />
        <Route path="/floor" element={<FloorScreen />} />
        <Route path="/order/:orderId" element={<OrderScreen />} />
        <Route path="/kot/:orderId" element={<KotPreviewScreen />} />
        <Route path="/payment/:orderId" element={<PaymentScreen />} />
        <Route path="/inbox" element={<InboxScreen />} />
        <Route path="/day-close" element={<DayCloseScreen />} />
        <Route path="/diagnostics" element={<DiagnosticsScreen />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
);
