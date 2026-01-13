import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import DashboardLayout from './layouts/DashboardLayout';
import Dashboard from './pages/Dashboard';
import Matchmaker from './pages/Matchmaker';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<DashboardLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="match" element={<Matchmaker />} />
          <Route path="reports" element={<div className="text-white p-6 pt-24 md:pt-6">Reports Coming Soon</div>} />
          <Route path="settings" element={<div className="text-white p-6 pt-24 md:pt-6">Settings Coming Soon</div>} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
