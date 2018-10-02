module.exports = {
  mode: "development",
  devtool: "inline-source-map",
  entry: {
    "cli": "./dist/run/cli.js"
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
};
