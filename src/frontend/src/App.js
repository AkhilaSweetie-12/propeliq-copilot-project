import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { Box } from '@mui/material';
// Health check component
const HealthCheck = () => (_jsx(Box, { sx: { p: 2 }, children: _jsx("h1", { children: "healthy" }) }));
// Main App component
const App = () => {
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
    return (_jsxs(ThemeProvider, { theme: theme, children: [_jsx(CssBaseline, {}), _jsx(Router, { children: _jsxs(Routes, { children: [_jsx(Route, { path: "/health", element: _jsx(HealthCheck, {}) }), _jsx(Route, { path: "/", element: _jsxs(Box, { sx: { p: 4 }, children: [_jsx("h1", { children: "PropelIQ Healthcare Platform" }), _jsx("p", { children: "Welcome to the patient scheduling and clinical intelligence platform." })] }) })] }) })] }));
};
export default App;
//# sourceMappingURL=App.js.map