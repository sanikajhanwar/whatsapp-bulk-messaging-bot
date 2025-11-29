import React, { useState, useContext } from 'react'; // <-- IMPORT useContext
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { Sidebar, Menu, MenuItem } from 'react-pro-sidebar';
import { FiUsers, FiBox, FiMonitor, FiClipboard, FiMenu, FiSun, FiMoon } from 'react-icons/fi'; // <-- IMPORT FiSun, FiMoon

// Import our theme context and color objects
import { ThemeContext } from './ThemeContext'; // <-- ADD THIS
import { lightTheme, darkTheme } from './theme'; // <-- ADD THIS

import Employees from './pages/Employees';
import CsvUploader from './CsvUploader';
import CampaignMonitoring from './pages/CampaignMonitoring';
import Dashboard from './components/Dashboard';

// This data remains the same
const menuItems = [
  { name: 'Dashboard', path: '/dashboard', icon: <FiBox /> },
  { name: 'Employees', path: '/', icon: <FiUsers /> },
  { name: 'Upload Campaign', path: '/upload', icon: <FiClipboard /> },
  { name: 'Monitoring', path: '/monitoring', icon: <FiMonitor /> },
];

function AppLayout() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { theme, toggleTheme } = useContext(ThemeContext); // <-- GET THEME FROM CONTEXT
  const currentTheme = theme === 'light' ? lightTheme : darkTheme; // <-- SELECT COLOR PALETTE

  return (
    // <-- APPLY THEME BODY COLOR
    <div style={{ display: 'flex', height: '100vh', minHeight: '100vh', backgroundColor: currentTheme.body }}> 
      <Sidebar 
        collapsed={isCollapsed}
        backgroundColor={currentTheme.sidebarBackground} // <-- APPLY THEME COLOR
        rootStyles={{
            borderRight: `1px solid ${currentTheme.sidebarBorder}` // <-- APPLY THEME COLOR
        }}
      >
        <Menu
          menuItemStyles={{
            button: ({ level, active }) => {
              return {
                padding: '40px 10px 22px 25px', 
                // --- APPLY THEME COLORS ---
                backgroundColor: active ? currentTheme.primary : 'transparent',
                color: active ? currentTheme.primaryText : currentTheme.text,
                '&:hover': {
                  backgroundColor: active ? currentTheme.primary : '#eef6fe',
                  color: active ? currentTheme.primaryText : currentTheme.primary,
                },
              };
            },
          }}
        >
          <MenuItem 
            onClick={() => setIsCollapsed(!isCollapsed)}
            icon={<FiMenu />}
            rootStyles={{
                fontSize: '18px',
                fontWeight: 'bold',
                marginBottom: '24px',
                color: currentTheme.text, // <-- APPLY THEME COLOR
            }}
          >
            WhatsApp Admin
          </MenuItem>
          
          {menuItems.map((item, index) => (
            <MenuItem 
              key={index} 
              icon={item.icon}
              component={<Link to={item.path} />}
            >
              {item.name}
            </MenuItem>
          ))}

          {/* --- ADD THIS THEME TOGGLE BUTTON --- */}
          <MenuItem 
            onClick={toggleTheme}
            icon={theme === 'light' ? <FiMoon /> : <FiSun />}
            rootStyles={{ marginTop: 'auto' }}
           >
            Switch Theme
          </MenuItem>

        </Menu>
      </Sidebar>

      {/* <-- APPLY THEME TEXT COLOR --> */}
      <main style={{ flex: 1, padding: '38px 48px', overflowY: 'auto', color: currentTheme.text }}>
        <Routes>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/" element={<Employees />} />
          <Route path="/upload" element={<CsvUploader />} />
          <Route path="/monitoring" element={<CampaignMonitoring />} />
        </Routes>
      </main>
    </div>
  );
}

function App() {
  return (
    <Router>
      <AppLayout />
    </Router>
  );
}

export default App;
