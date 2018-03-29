import { ContractAbi } from "web3";

declare module "*.abi" {
  const content: ContractAbi;
  export default content;
}
