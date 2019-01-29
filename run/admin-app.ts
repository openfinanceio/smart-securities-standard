// The administration web app is how we do Trezor integration, outsourcing
// transaction signing to MetaMask
//

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
