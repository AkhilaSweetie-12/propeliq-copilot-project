import { jsx as _jsx } from "react/jsx-runtime";
import { render, screen } from '@testing-library/react';
import App from './App';
test('renders welcome message', () => {
    render(_jsx(App, {}));
    const welcomeElement = screen.getByText(/PropelIQ Healthcare Platform/i);
    expect(welcomeElement).toBeInTheDocument();
});
test('renders health check route', () => {
    window.history.pushState({}, '', '/health');
    render(_jsx(App, {}));
    const healthElement = screen.getByText(/healthy/i);
    expect(healthElement).toBeInTheDocument();
});
//# sourceMappingURL=App.test.js.map