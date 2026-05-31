import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';

const originalFetch = window.fetch;
window.fetch = async (...args) => {
    const [resource] = args;
    let config = args[1] as RequestInit | undefined;
    const branchId = localStorage.getItem("rosmarium_branch_id");
    if (branchId) {
        config = config || {};
        config.headers = {
            ...config.headers,
            'X-Branch-Id': branchId
        };
    }
    return originalFetch(resource, config);
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
