module.exports = {
  apps: [
    {
      name: 'smarterthings-ngrok',
      script: 'ngrok',
      args: 'http 5181 --domain=smarty.ngrok.app',
      interpreter: 'none',
      autorestart: true,
      watch: false,
      max_memory_restart: '200M',
      restart_delay: 3000,
      max_restarts: 10,
      min_uptime: '10s',
      env: {
        NODE_ENV: 'production'
      },
      error_file: './logs/ngrok-error.log',
      out_file: './logs/ngrok-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true
    }
  ]
};
