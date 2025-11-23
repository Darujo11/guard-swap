// Carregar polyfills primeiro (para Android 8+ e navegadores antigos)
import './polyfills';

import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { ErrorBoundary } from "./components/ErrorBoundary";

// Global Error Handlers para capturar erros JavaScript
window.onerror = (message, source, lineno, colno, error) => {
  console.error('🚨 [Global Error Handler]', {
    message,
    source,
    lineno,
    colno,
    error,
    timestamp: new Date().toISOString()
  });
  
  // Salvar no localStorage para debug
  try {
    const errorLog = {
      type: 'onerror',
      message: String(message),
      source,
      lineno,
      colno,
      timestamp: new Date().toISOString()
    };
    localStorage.setItem('last_js_error', JSON.stringify(errorLog));
  } catch (e) {
    console.error('Não foi possível salvar erro no localStorage', e);
  }
  
  return false; // Não suprimir o erro
};

// Handler para promises não tratadas
window.onunhandledrejection = (event) => {
  console.error('🚨 [Unhandled Promise Rejection]', {
    reason: event.reason,
    promise: event.promise,
    timestamp: new Date().toISOString()
  });
  
  // Salvar no localStorage para debug
  try {
    const errorLog = {
      type: 'unhandledrejection',
      reason: event.reason instanceof Error ? event.reason.message : String(event.reason),
      timestamp: new Date().toISOString()
    };
    localStorage.setItem('last_promise_error', JSON.stringify(errorLog));
  } catch (e) {
    console.error('Não foi possível salvar erro no localStorage', e);
  }
};

// Service Worker error handler
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('error', (event) => {
    console.error('🚨 [Service Worker Error]', event);
  });
}

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
