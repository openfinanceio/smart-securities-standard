describe("Regulation D", () => {
  describe("user status", () => {
    it("should prevent unaccredited investors from buying");
    it("should prevent unverified (KYC) investors from buying");
    it("should prevent unverified (KYC) investors from selling");
  });
  describe("limits", () => {
    it("should prevent more than 99 shareholders");
    it("should prevent more than 2000 shareholders");
  });
  describe("vesting period", () => {
    it("should prevent transfer before the vesting period has finished");
  });
});
