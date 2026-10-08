import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './auth';
import { Toaster } from './components/ui';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter><AuthProvider><App /><Toaster /></AuthProvider></BrowserRouter>
);
