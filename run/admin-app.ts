// The administration web app is how we do Trezor integration, outsourcing
// transaction signing to MetaMask

import { Administration, TokenFront } from "../src";

import * as ejs from "ethereumjs-util";
import { VNode, createProjector, h } from "maquette";
import * as Web3 from "web3";

const zeroAddress = ejs.zeroAddress();

// ~~~~~ //
// Types //
// ~~~~~ //

// Possible operations
export enum Operation {
  AbortCall,
  SetResolver,
  Clawback,
  Migrate,
  NewAdmin,
  Rotate,
  Bind
}

interface AppEvent extends Event {
  payload: AppL;
}

export type CallData =
  | { method: "AbortCall"; callNumber: number; callRef: number }
  | { method: "Bind"; callNumber: number; logic: string; front: string }
  | {
      method: "Clawback";
      callNumber: number;
      src: string;
      dst: string;
      amount: number;
    }
  | { method: "Migrate"; callNumber: number; newLogic: string }
  | { method: "NewAdmin"; callNumber: number; newAdmin: string }
  | { method: "Rotate"; callNumber: number; sig: 0 | 1 | 2; newSigner: string }
  | { method: "SetResolver"; callNumber: number; resolver: string };

export type CallHandler = (address: string, callData: CallData) => void;

export type Admin = {
  bind: (tokenLogic: string, tokenFront: string) => void;
  clawback: (src: string, dst: string, amount: number) => void;
};

export type AppNode =
  | "start"
  | "operations"
  | "operation"
  | "summary"
  | "error";

export type AppState = {
  adminAddress: string | null;
  binding: { token: string; engine: string } | null;
  fieldStates: Map<string, string>;
  lastCall: CallData | null;
  lastError: Error | null;
  node: AppNode;
  operation: Operation | null;
};

export type AppL =
  | { tag: "block"; xs: AppL[] }
  | { tag: "execute"; call: CallData }
  | { tag: "nav"; node: AppNode }
  | { tag: "newFieldState"; location: string; value: string }
  | { tag: "selectOperation"; operation: Operation }
  | { tag: "reset" }
  | { tag: "withAdminContext"; address: string; next: AppL }
  | { tag: "withFreshCallNumber"; handler: (n: number) => AppL }
  | { tag: "withInput"; location: string; handler: (value: string) => AppL }
  | {
      tag: "withTokenLogic";
      address: string;
      handler: (logic: string) => AppL;
    };

// ~~~~~~~~~~~~~~~~~~ //
// Interface elements //
// ~~~~~~~~~~~~~~~~~~ //

export const header = (text: string): VNode => h("h1", {}, [text]);

export const section = (text: string, nodes: VNode[]) =>
  h("section", { key: text }, [h("p", {}, [text])].concat(nodes));

export const button = (text: string, onClick: () => void): VNode =>
  h("span", { class: "button", key: text, onclick: onClick }, [text]);

export const userInput = (
  inputs: string[],
  emit: (prog: AppL) => void,
  handler: (vals: string[]) => AppL
): VNode => {
  const nodes = inputs.map((name, i) => {
    const input = h(
      "input",
      {
        oninput: e => {
          emit(newFieldState(name, (e.target as any).value));
        }
      },
      []
    );

    return h("div", { key: name }, [h("p", {}, [name]), input]);
  });

  const f = (names: string[], vals: string[]): AppL => {
    if (names.length === 0) {
      return handler(vals);
    }
    const n = names.shift() as string;
    return withInput(n, v => {
      vals.push(v);
      return f(names, vals);
    });
  };

  nodes.push(button("go!", () => emit(f(inputs, []))));

  return h("div", { key: inputs.join("|") }, nodes);
};

// ~~~~~~~ //
// App DSL //
// ~~~~~~~ //

export const block = (xs: AppL[]): AppL => ({ tag: "block", xs });

export const nav = (node: AppNode): AppL => ({ tag: "nav", node });

export const newFieldState = (location: string, value: string): AppL => ({
  tag: "newFieldState",
  location,
  value
});

export const reset: AppL = { tag: "reset" };

export const selectOperation = (operation: Operation): AppL => ({
  tag: "selectOperation",
  operation
});

export const withAdminContext = (address: string, next: AppL): AppL => ({
  tag: "withAdminContext",
  address,
  next
});

export const withFreshCallNumber = (handler: (n: number) => AppL): AppL => ({
  tag: "withFreshCallNumber",
  handler
});

export const withInput = (
  location: string,
  handler: (v: string) => AppL
): AppL => ({
  tag: "withInput",
  location,
  handler
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

export const operation = (call: (n: number) => CallData): AppL =>
  withFreshCallNumber(n => block([executeCall(call(n)), nav("summary")]));

// ~~~~~~~~~ //
// Rendering //
// ~~~~~~~~~ //

export const render = (state: AppState, send: (prog: AppL) => void): VNode => {
  const start = h("div", {}, [
    header("welcome to S3 administration"),
    section("initiate operation", [
      userInput(["administration address"], send, ([address]) =>
        withAdminContext(address, nav("operations"))
      )
    ]),
    section("cosign operation", [
      userInput(["operation blob"], send, ([callBlob]) => {
        const call = JSON.parse(callBlob);
        return withAdminContext(
          call.adminAddress,
          block([executeCall(call), nav("summary")])
        );
      })
    ])
  ]);

  const operationPage = (text: string, input: VNode) =>
    h("div", {}, [
      header(text),
      input,
      button("back to operations menu", () => send(nav("operations")))
    ]);

  switch (state.node) {
    case "start":
      return start;

    case "operations":
      const select = (name: string, op: Operation) =>
        button(name, () => send(selectOperation(op)));
      return h(
        "div",
        {},
        [
          header("operations:"),
          h("div", { key: "binding" }, [
            state.binding === null
              ? "admin contract not bound"
              : `token = ${state.binding.token}; engine = ${
                  state.binding.engine
                }`
          ]),
          select("Bind", Operation.Bind)
        ].concat(
          state.binding === null
            ? []
            : [
                select("Clawback", Operation.Clawback),
                select("Migrate", Operation.Migrate),
                select("NewAdmin", Operation.NewAdmin),
                select("Rotate", Operation.Rotate),
                select("SetResolver", Operation.SetResolver)
              ]
        )
      );

    case "operation":
      switch (state.operation) {
        case Operation.AbortCall:
          return operationPage(
            "Enter the number of the call to abort",
            userInput(["call number"], send, ([call]) =>
              operation(callNumber => ({
                method: "AbortCall",
                callNumber,
                callRef: parseInt(call)
              }))
            )
          );

        case Operation.Bind:
          return operationPage(
            "Please enter the token address",
            userInput(["token address"], send, ([front]) =>
              withTokenLogic(front, logic =>
                operation(callNumber => ({
                  method: "Bind",
                  callNumber,
                  logic,
                  front
                }))
              )
            )
          );

        case Operation.Clawback:
          return operationPage(
            "please enter the following",
            userInput(
              ["source", "destination", "amount"],
              send,
              ([src, dst, amount]) =>
                operation(callNumber => ({
                  method: "Clawback",
                  callNumber,
                  src,
                  dst,
                  amount: parseInt(amount)
                }))
            )
          );

        case Operation.Migrate:
          return operationPage(
            "Migrate to new token logic",
            userInput(["new logic"], send, ([newLogic]) =>
              operation(callNumber => ({
                method: "Migrate",
                callNumber,
                newLogic
              }))
            )
          );

        case Operation.NewAdmin:
          return operationPage(
            "Enter the new administrator contract",
            userInput(["new admin"], send, ([newAdmin]) =>
              operation(callNumber => ({
                method: "NewAdmin",
                callNumber,
                newAdmin
              }))
            )
          );

        case Operation.Rotate:
          return operationPage(
            "Enter the sig position and new key",
            userInput(
              ["sig position", "new cosigner"],
              send,
              ([sigPos, newSigner]) =>
                operation(callNumber => ({
                  method: "Rotate",
                  callNumber,
                  sig: parseInt(sigPos) as 0 | 1 | 2,
                  newSigner
                }))
            )
          );

        case Operation.SetResolver:
          return operationPage(
            "Enter the new resolver",
            userInput(["new resolver"], send, ([resolver]) =>
              operation(callNumber => ({
                method: "SetResolver",
                callNumber,
                resolver
              }))
            )
          );

        default:
          return start;
      }

    case "summary":
      const summary = { adminAddress: state.adminAddress, ...state.lastCall };
      return h("div", {}, [
        header("Call summary"),
        state.lastCall === null
          ? "no call to display"
          : h("pre", {}, [JSON.stringify(summary, undefined, 2)]),
        button("reset", () => send(reset))
      ]);

    case "error":
      return h("div", {}, [
        header("there was a problem"),
        state.lastError === null
          ? h("pre", { class: "error" }, ["we cannot find the error"])
          : h("pre", { class: "error" }, [state.lastError.message])
      ]);
  }
};

// ~~~~~~~~ //
// App body //
// ~~~~~~~~ //

const emptyState = (): AppState => ({
  adminAddress: null,
  binding: null,
  fieldStates: new Map(),
  lastCall: null,
  lastError: null,
  node: "start",
  operation: null
});

export const run = () => {
  console.log("starting app..");

  const state = emptyState();

  (window as any).ethereum.enable();
  const web3 = new Web3((window as any).ethereum);

  const proj = createProjector();

  const withAdmin = <T>(cb: (admin: any) => T): T | null => {
    if (state.adminAddress !== null) {
      console.log("instantiating the admin");

      const admin = web3.eth
        .contract(Administration.abi)
        .at(state.adminAddress);

      return cb(admin);
    }
    console.log("Admin address missing");
    return null;
  };

  const trigger = (err: Error | null) => {
    if (err !== null) {
      state.lastError = err;
      state.node = "error";
    }
    proj.scheduleRender();
  };

  const evaluate = (x: AppL) => {
    console.log(x.tag);

    switch (x.tag) {
      case "block":
        console.log("{");
        for (let step of x.xs) {
          evaluate(step);
        }
        console.log("}");
        break;

      case "execute":
        state.lastCall = x.call;
        withAdmin(admin => {
          const c = x.call;
          console.log(admin.address);
          console.log(c);
          switch (c.method) {
            case "AbortCall":
              admin.abortCall(
                c.callNumber,
                c.callRef,
                { gas: 3e5, from: web3.eth.accounts[0] },
                trigger
              );
              break;

            case "Bind":
              admin.bind(
                c.callNumber,
                c.logic,
                c.front,
                { gas: 3e5, from: web3.eth.accounts[0] },
                trigger
              );
              break;

            case "Clawback":
              admin.clawback(
                c.callNumber,
                c.src,
                c.dst,
                c.amount,
                {
                  gas: 3e5,
                  from: web3.eth.accounts[0]
                },
                trigger
              );
              break;

            case "Migrate":
              admin.migrate(
                c.callNumber,
                c.newLogic,
                { gas: 3e5, from: web3.eth.accounts[0] },
                trigger
              );
              break;

            case "NewAdmin":
              admin.newAdmin(
                c.callNumber,
                c.newAdmin,
                { gas: 3e5, from: web3.eth.accounts[0] },
                trigger
              );
              break;

            case "Rotate":
              admin.rotate(
                c.callNumber,
                c.sig,
                c.newSigner,
                { gas: 3e5, from: web3.eth.accounts[0] },
                trigger
              );
              break;

            case "SetResolver":
              admin.setResolver(
                c.callNumber,
                c.resolver,
                { gas: 3e5, from: web3.eth.accounts[0] },
                trigger
              );
              break;
          }
        });
        break;

      case "nav":
        state.node = x.node;
        break;

      case "newFieldState":
        state.fieldStates.set(x.location, x.value);
        break;

      case "reset":
        Object.assign(state, emptyState());
        break;

      case "selectOperation":
        state.node = "operation";
        state.operation = x.operation;
        break;

      case "withAdminContext":
        state.adminAddress = x.address;
        withAdmin(admin =>
          admin.targetFront.call((err: Error | null, front: string) => {
            if (err !== null) {
              throw err;
            }
            admin.targetLogic.call((err: Error | null, logic: string) => {
              if (err !== null) {
                throw err;
              }
              if (front !== zeroAddress && logic !== zeroAddress) {
                state.binding = { token: front, engine: logic };
              }
              evaluate(x.next);
              proj.scheduleRender();
            });
          })
        );
        break;

      case "withFreshCallNumber":
        withAdmin(admin =>
          admin.maximumClaimedCallNumber.call((err: Error, res: any) => {
            if (err === null) {
              const n = res.toNumber() + 1;
              console.log("fresh call number: ", n);
              evaluate(x.handler(n));
            } else {
              throw err;
            }
          })
        );
        break;

      case "withInput":
        evaluate(
          x.handler(
            state.fieldStates.has(x.location)
              ? state.fieldStates.get(x.location)!
              : ""
          )
        );
        break;

      case "withTokenLogic":
        const tf = web3.eth.contract(TokenFront.abi).at(x.address);
        tf.tokenLogic.call((err: Error, logic: string) => {
          if (err === null) {
            console.log("token logic: ", logic);
            evaluate(x.handler(logic));
          } else {
            throw err;
          }
        });
        break;
    }
  };

  document.addEventListener("app-event", (e: AppEvent) => {
    try {
      evaluate(e.payload);
    } catch (err) {
      state.node = "error";
      state.lastError = err;
    }

    console.log(state);
  });

  const main = document.getElementById("main");

  if (main !== null) {
    proj.replace(main, () =>
      render(state, x => {
        const ev = new Event("app-event") as AppEvent;
        ev.payload = x;
        document.dispatchEvent(ev);
      })
    );
  }
};

run();
