import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { Box } from '@mui/material';

// Health check component
const HealthCheck = () => (
  <Box sx={{ p: 2 }}>
    <h1>healthy</h1>
  </Box>
);

// Main App component
const App: React.FC = () => {
  const theme = createTheme({
    palette: {
      primary: {
        main: '#1976d2',
      },
      secondary: {
        main: '#dc004e',
      },
    },
  });

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <Routes>
          <Route path="/health" element={<HealthCheck />} />
          <Route path="/" element={
            <Box sx={{ p: 4 }}>
              <h1>PropelIQ Healthcare Platform</h1>
              <p>Welcome to the patient scheduling and clinical intelligence platform.</p>
            </Box>
          } />
        </Routes>
      </Router>
    </ThemeProvider>
  );
};

export default App;
