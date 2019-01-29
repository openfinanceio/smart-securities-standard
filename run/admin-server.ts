// MetaMask will not inject web3 unless the page URI matches `https?://` so we need to serve the webapp

import * as express from "express";
import * as program from "commander";

program
  .option("-d, --directory <dir>", "the directory to serve")
  .option("-p, --port <number>", "the port on which to serve the app", 8080)
  .action(env => {
    const app = express();

    app.use(express.static(env.directory));
    app.listen(env.port);
  });

program.parse(process.argv);
