module.exports = {
  apps: [
    {
      name: 'stock-backend',
      script: 'node',
      args: 'backend/src/app.js',
      cwd: './',
      env: {
        NODE_ENV: 'development',
        PORT: 3001
      }
    },
    {
      name: 'stock-frontend',
      script: 'npm',
      args: 'run dev -- --host 0.0.0.0',
      cwd: 'frontend',
      env: {
        NODE_ENV: 'development',
        PORT: 5173
      }
    }
  ]
};
