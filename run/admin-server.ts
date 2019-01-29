// MetaMask will not inject web3 unless the page URI matches `https?://` so we need to serve the webapp

import * as express from "express";

const app = express();

app.use(express.static(process.argv[2]));
app.listen(8080);
