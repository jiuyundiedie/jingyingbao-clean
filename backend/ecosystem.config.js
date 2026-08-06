module.exports = {
  apps: [{
    name: 'jingyingbao-backend',
    script: './server.js',
    cwd: __dirname,
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '256M',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
    },
    env_development: {
      NODE_ENV: 'development',
      PORT: 3000,
    },
  }]
};
