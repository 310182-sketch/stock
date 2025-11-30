/**
 * Clean server entrypoint for development/testing
 * Use this file if `app.js` is in an inconsistent state.
 */

// During recovery/testing use the clean temporary app. Change back to './app' when ready.
const app = require('./app');
const PORT = process.env.PORT || 3001;

if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Dev server listening on http://0.0.0.0:${PORT}`);
  });
}

module.exports = app;
