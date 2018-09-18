import { readFileSync, writeFileSync } from "fs";
import * as Web3 from "web3";
import { init } from "../../src";
import { Config, GasReport } from "./Types";

export async function initS3(this: void, config: Config, outputFile: string) {
  // We'll need to figure out gas prices
  const gasPrice = () => {
    const gasReport: GasReport = JSON.parse(
      readFileSync(config.gasReportPath, "utf8")
    );
    return web3.toWei(gasReport.safeLow, "gwei");
  };
  const web3 = new Web3(
    new Web3.providers.HttpProvider(
      `http://${config.net.host}:${config.net.port}`
    )
  );
  // deploy the new cap tables instance
  const [capTables, transcript] = await init(
    config.controller,
    gasPrice(),
    web3.eth
  );
  writeFileSync(
    outputFile,
    JSON.stringify({
      capTables,
      transcript
    }),
    "utf8"
  );
}
