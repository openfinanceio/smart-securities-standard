module.exports = {
  mode: "development",
  devtool: "inline-source-map",
  entry: {
    "cli": "./run/cli.ts"
  },
  output: { 
    filename: "bin/[name].js",
  },
  resolve: {
    extensions: [".ts", ".js"]
  },
  module: {
    rules: [
      // all files with a `.ts` or `.tsx` extension will be handled by `ts-loader`
      { test: /\.tsx?$/, loader: "ts-loader" }
    ]
  },
  node: {
    __dirname: false
  },
  target: "node"
};
