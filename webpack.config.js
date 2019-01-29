module.exports = [
  {
    entry: {
      "cli": "./dist/run/cli.js",
      "admin-server": "./dist/run/admin-server.js"
    },
    output: { 
      filename: "[name].js",
      path: __dirname + "/bin"
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
      filename: "bundle.js",
      path: __dirname + "/admin-app"
    },
    resolve: {
      extensions: [".js"]
    },
    target: "web"
  }
];
