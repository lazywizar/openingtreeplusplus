const express = require('express');
const path = require('path');
const app = express();

console.log('Starting server...');
console.log('Current directory:', __dirname);

// Check if build directory exists
const buildPath = path.join(__dirname, 'build');
console.log('Looking for build directory at:', buildPath);
try {
    require('fs').accessSync(buildPath);
    console.log('Build directory found');
} catch (err) {
    console.error('Build directory not found! Please ensure you run yarn build first');
    process.exit(1);
}

// Serve static files from the React app
app.use(express.static(buildPath));
console.log('Configured static file serving');

// Handle React routing, return all requests to React app
app.get('*', function(req, res) {
    console.log('Received request for:', req.url);
    res.sendFile(path.join(buildPath, 'index.html'));
});

// Add this before the catch-all route
app.get('/health', (req, res) => {
    console.log('Health check requested');
    res.status(200).send('OK');
});

const port = process.env.PORT || 3000;
console.log('Attempting to start server on port:', port);

const server = app.listen(port, '0.0.0.0', () => {
    console.log(`Server is running on port ${port}`);
    console.log(`Server address: ${server.address().address}:${server.address().port}`);
}).on('error', (err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
});

// Handle process termination
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down server');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});