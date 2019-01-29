module.exports = [
  {
    entry: {
      "cli": "./dist/run/cli.js",
      "admin-server": "./dist/run/admin-server.js"
    },
    output: { 
      filename: "bin/[name].js",
    },
    resolve: {
      extensions: [".js"]
    },
    node: {
      __dirname: false
    },
    target: "node"
  },
  {
    entry: "./dist/run/admin-app.js",
    output: { 
      filename: "admin-app/bundle.js",
    },
    resolve: {
      extensions: [".js"]
    },
    node: {
      __dirname: false
    },
    target: "web"
  }
];
