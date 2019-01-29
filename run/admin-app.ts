// The administration web app is how we do Trezor integration, outsourcing
// transaction signing to MetaMask

import { Administration, TokenFront } from "../src";

import { VNode, h } from "maquette";
import * as Web3 from "web3";

// Injected by MetaMask
declare const web3: Web3;

// Possible operations
export enum Operation {
  AbortCall,
  SetResolver,
  Clawback,
  Migrate,
  NewAdmin,
  NewLogic,
  Rotate,
  Bind
}

export const opNames = [
  "AbortCall",
  "SetResolver",
  "Clawback",
  "Migrate",
  "NewAdmin",
  "NewLogic",
  "Rotate",
  "Bind"
];

export class AppEvent extends Event {
  payload: AppL;
}

export const randomKey = () => Math.random().toString();

// ~~~~~~~~~~~~~~~~~~ //
// Interface elements //
// ~~~~~~~~~~~~~~~~~~ //

export const header = (text: string): VNode => h("h1", {}, [text]);

export const button = (text: string, onClick: () => void): VNode =>
  h("span", { class: "button", onclick: onClick }, [text]);

export const userInput = (
  inputs: string[],
  handler: (vals: string[]) => void
): VNode => {
  const vals: string[] = [];
  const nodes = inputs.map((name, i) =>
    h("div", { key: randomKey() }, [
      name,
      h(
        "input",
        {
          oninput: ev => {
            vals[i] = (ev.target as any).value;
          }
        },
        []
      )
    ])
  );
  nodes.push(
    button("go!", () => {
      handler(vals);
    })
  );
  return h("div", { key: randomKey() }, nodes);
};

// Application

export type CallData =
  | { method: "Clawback"; src: string; dst: string; amount: number }
  | { method: "Bind"; logic: string; front: string };

export type CallHandler = (address: string, callData: CallData) => void;

export type Admin = {
  bind: (tokenLogic: string, tokenFront: string) => void;
  clawback: (src: string, dst: string, amount: number) => void;
};

export type AppNode = "start" | "operations" | "operation";

export type AppState = {
  node: AppNode;
  adminAddress: string | null;
  callNumber: number | null;
  operation: Operation | null;
};

export type AppL =
  | { tag: "block"; xs: AppL[] }
  | { tag: "execute"; call: CallData }
  | { tag: "nav"; node: AppNode }
  | { tag: "selectOperation"; operation: Operation }
  | { tag: "withAdminContext"; address: string; next: AppL }
  | {
      tag: "withTokenLogic";
      address: string;
      handler: (logic: string) => AppL;
    };

export const block = (xs: AppL[]): AppL => ({ tag: "block", xs });

export const nav = (node: AppNode): AppL => ({ tag: "nav", node });

export const selectOperation = (operation: Operation): AppL => ({
  tag: "selectOperation",
  operation
});

export const withAdminContext = (address: string, next: AppL): AppL => ({
  tag: "withAdminContext",
  address,
  next
});

export const withTokenLogic = (
  address: string,
  handler: (logic: string) => AppL
): AppL => ({
  tag: "withTokenLogic",
  address,
  handler
});

export const executeCall = (call: CallData): AppL => ({ tag: "execute", call });

export type Evaluator<A> = (prog: AppL) => A;

export const render = (state: AppState, send: (prog: AppL) => void): VNode => {
  const start = h("div", { key: randomKey() }, [
    header("please enter the administration address"),
    userInput(["administration address"], ([address]) =>
      send(withAdminContext(address, nav("operations")))
    )
  ]);

  switch (state.node) {
    case "start":
      return start;

    case "operations":
      const select = (name: string, op: Operation) =>
        button(name, () => send(selectOperation(op)));
      return h("div", { key: randomKey() }, [
        header("please select an operation"),
        select("Bind", Operation.Bind),
        select("Clawback", Operation.Clawback)
      ]);

    case "operation":
      switch (state.operation) {
        case Operation.Bind:
          return h("div", { key: randomKey() }, [
            header("please enter the token address"),
            userInput(["token address"], ([address]) => {
              send(
                withTokenLogic(address, logic =>
                  block([
                    executeCall({
                      method: "Bind",
                      logic,
                      front: address
                    }),
                    nav("start")
                  ])
                )
              );
            })
          ]);

        case Operation.Clawback:
          return h("div", { key: randomKey() }, [
            header("please enter the following"),
            userInput(
              ["source", "destination", "amount"],
              ([src, dst, amount]) =>
                block([
                  executeCall({
                    method: "Clawback",
                    src,
                    dst,
                    amount: parseInt(amount)
                  }),
                  nav("start")
                ])
            )
          ]);

        default:
          return start;
      }
  }
};

export const run = () => {
  const state: AppState = {
    node: "start",
    adminAddress: null,
    callNumber: null,
    operation: null
  };

  const evaluate = (x: AppL) => {
    switch (x.tag) {
      case "block":
        x.xs.forEach(evaluate);
        break;

      case "execute":
        // Here we need to make sure we have the call number
        if (state.adminAddress !== null) {
          const admin = web3.eth
            .contract(Administration.abi)
            .at(state.adminAddress);
          const c = x.call;
          switch (c.method) {
            case "Bind":
              admin.bind(callNumber, c.logic, c.front, { gas: 3e5 });
              break;
            case "Clawback":
              admin.clawback(callNumber, c.src, c.dst, c.amount, { gas: 3e5 });
              break;
          }
        }
        break;

      case "nav":
        state.node = x.node;
        break;

      case "selectOperation":
        state.node = "operation";
        state.operation = x.operation;
        break;

      case "withAdminContext":
        state.adminAddress = x.address;
        break;

      case "withTokenLogic":
        const tf = web3.eth.contract(TokenFront.abi).at(x.address);
        evaluate(x.handler(tf.tokenLogic.call()));
        break;
    }
  };
};
