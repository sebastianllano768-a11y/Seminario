let app;
let importError = null;

try {
    app = require('../backend/src/server');
} catch (err) {
    importError = err;
    console.error('IMPORT ERROR:', err.stack);
}

module.exports = (req, res) => {
    if (importError) {
        return res.status(500).json({
            error: 'Import failed',
            message: importError.message,
            stack: importError.stack
        });
    }
    return app(req, res);
};
