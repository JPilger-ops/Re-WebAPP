module.exports = {
  apps: [
    {
      name: "rechnungsapp",
      script: "./src/index.js",
      cwd: "/root/rechnungsapp/backend",
      watch: false,
      env: {
        NODE_ENV: "production"
      }
    }
  ]
};