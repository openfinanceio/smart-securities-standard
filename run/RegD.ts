// Script: Issue a regulation D 506 (c) token.
//
// This script issues a security based on JSON configuration piped in on
// standard input.

/**
 * Configuration should have this structure.
 */
interface Config {
  capTables: string;
  isFund: boolean;
  restrictor: string;
  investors: {
    address: string;
    amount: number;
  }[];
}

process.stdin.setEncoding("utf8");

let data = "";

process.stdin.on("data", chunk => {
  data += chunk;
});

process.stdin.on("end", () => {
  main(JSON.parse(data));
});

function main(cfg: Config): void {}
