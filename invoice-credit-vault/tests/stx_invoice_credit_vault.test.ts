import { describe, expect, it } from "vitest";

const accounts = simnet.getAccounts();
const address1 = accounts.get("wallet_1")!;
const address2 = accounts.get("wallet_2")!;
const address3 = accounts.get("wallet_3")!;
const deployer = accounts.get("deployer")!;

const contractName = "stx_invoice_credit_vault";

describe("Invoice Factoring Platform", () => {
  describe("Business Registration", () => {
    it("should allow new business registration", () => {
      const { result } = simnet.callPublicFn(
        contractName,
        "register-business",
        [Cl.stringAscii("Tech Company Inc")],
        address1
      );
      
      expect(result).toBeOk(Cl.bool(true));
    });

    it("should prevent duplicate business registration", () => {
      // First registration
      simnet.callPublicFn(
        contractName,
        "register-business",
        [Cl.stringAscii("Tech Company Inc")],
        address1
      );

      // Second registration should fail
      const { result } = simnet.callPublicFn(
        contractName,
        "register-business",
        [Cl.stringAscii("Another Name")],
        address1
      );
      
      expect(result).toBeErr(Cl.uint(102)); // err-already-exists
    });

    it("should retrieve registered business information", () => {
      simnet.callPublicFn(
        contractName,
        "register-business",
        [Cl.stringAscii("Tech Company Inc")],
        address1
      );

      const { result } = simnet.callReadOnlyFn(
        contractName,
        "get-business",
        [Cl.principal(address1)],
        address1
      );

      expect(result).toBeSome(
        Cl.tuple({
          name: Cl.stringAscii("Tech Company Inc"),
          verified: Cl.bool(false),
          "total-invoices": Cl.uint(0),
          "total-factored": Cl.uint(0)
        })
      );
    });
  });

  describe("Investor Registration", () => {
    it("should allow new investor registration", () => {
      const { result } = simnet.callPublicFn(
        contractName,
        "register-investor",
        [Cl.stringAscii("Investment Fund LLC")],
        address2
      );
      
      expect(result).toBeOk(Cl.bool(true));
    });

    it("should prevent duplicate investor registration", () => {
      // First registration
      simnet.callPublicFn(
        contractName,
        "register-investor",
        [Cl.stringAscii("Investment Fund LLC")],
        address2
      );

      // Second registration should fail
      const { result } = simnet.callPublicFn(
        contractName,
        "register-investor",
        [Cl.stringAscii("Another Fund")],
        address2
      );
      
      expect(result).toBeErr(Cl.uint(102)); // err-already-exists
    });

    it("should retrieve registered investor information", () => {
      simnet.callPublicFn(
        contractName,
        "register-investor",
        [Cl.stringAscii("Investment Fund LLC")],
        address2
      );

      const { result } = simnet.callReadOnlyFn(
        contractName,
        "get-investor",
        [Cl.principal(address2)],
        address2
      );

      expect(result).toBeSome(
        Cl.tuple({
          name: Cl.stringAscii("Investment Fund LLC"),
          verified: Cl.bool(false),
          "total-invested": Cl.uint(0),
          "active-investments": Cl.uint(0)
        })
      );
    });
  });

  describe("Invoice Creation", () => {
    it("should create a new invoice successfully", () => {
      // Register business first
      simnet.callPublicFn(
        contractName,
        "register-business",
        [Cl.stringAscii("Tech Company Inc")],
        address1
      );

      const currentBlock = simnet.blockHeight;
      const { result } = simnet.callPublicFn(
        contractName,
        "create-invoice",
        [
          Cl.principal(address3), // debtor
          Cl.uint(100000), // amount (1000 STX)
          Cl.uint(currentBlock + 100), // due date
          Cl.uint(500) // discount rate (5%)
        ],
        address1
      );

      expect(result).toBeOk(Cl.uint(1)); // First invoice ID
    });

    it("should fail to create invoice with invalid amount", () => {
      simnet.callPublicFn(
        contractName,
        "register-business",
        [Cl.stringAscii("Tech Company Inc")],
        address1
      );

      const currentBlock = simnet.blockHeight;
      const { result } = simnet.callPublicFn(
        contractName,
        "create-invoice",
        [
          Cl.principal(address3),
          Cl.uint(0), // Invalid amount
          Cl.uint(currentBlock + 100),
          Cl.uint(500)
        ],
        address1
      );

      expect(result).toBeErr(Cl.uint(105)); // err-invalid-amount
    });

    it("should fail to create invoice with expired due date", () => {
      simnet.callPublicFn(
        contractName,
        "register-business",
        [Cl.stringAscii("Tech Company Inc")],
        address1
      );

      const currentBlock = simnet.blockHeight;
      const { result } = simnet.callPublicFn(
        contractName,
        "create-invoice",
        [
          Cl.principal(address3),
          Cl.uint(100000),
          Cl.uint(currentBlock - 1), // Past due date
          Cl.uint(500)
        ],
        address1
      );

      expect(result).toBeErr(Cl.uint(106)); // err-invoice-expired
    });

    it("should fail to create invoice with excessive discount rate", () => {
      simnet.callPublicFn(
        contractName,
        "register-business",
        [Cl.stringAscii("Tech Company Inc")],
        address1
      );

      const currentBlock = simnet.blockHeight;
      const { result } = simnet.callPublicFn(
        contractName,
        "create-invoice",
        [
          Cl.principal(address3),
          Cl.uint(100000),
          Cl.uint(currentBlock + 100),
          Cl.uint(2500) // 25% discount rate (exceeds 20% limit)
        ],
        address1
      );

      expect(result).toBeErr(Cl.uint(108)); // err-invalid-discount-rate
    });

    it("should retrieve created invoice information", () => {
      simnet.callPublicFn(
        contractName,
        "register-business",
        [Cl.stringAscii("Tech Company Inc")],
        address1
      );

      const currentBlock = simnet.blockHeight;
      simnet.callPublicFn(
        contractName,
        "create-invoice",
        [
          Cl.principal(address3),
          Cl.uint(100000),
          Cl.uint(currentBlock + 100),
          Cl.uint(500)
        ],
        address1
      );

      const { result } = simnet.callReadOnlyFn(
        contractName,
        "get-invoice",
        [Cl.uint(1)],
        address1
      );

      expect(result).toBeSome(
        Cl.tuple({
          business: Cl.principal(address1),
          debtor: Cl.principal(address3),
          amount: Cl.uint(100000),
          "due-date": Cl.uint(currentBlock + 100),
          "created-at": Cl.uint(currentBlock),
          "discount-rate": Cl.uint(500),
          factored: Cl.bool(false),
          investor: Cl.none(),
          "factored-amount": Cl.none()
        })
      );
    });
  });

  describe("Invoice Factoring", () => {
    it("should factor invoice successfully", () => {
      // Setup: Register business and investor, create invoice
      simnet.callPublicFn(
        contractName,
        "register-business",
        [Cl.stringAscii("Tech Company Inc")],
        address1
      );

      simnet.callPublicFn(
        contractName,
        "register-investor",
        [Cl.stringAscii("Investment Fund LLC")],
        address2
      );

      const currentBlock = simnet.blockHeight;
      simnet.callPublicFn(
        contractName,
        "create-invoice",
        [
          Cl.principal(address3),
          Cl.uint(100000), // 1000 STX
          Cl.uint(currentBlock + 100),
          Cl.uint(500) // 5% discount
        ],
        address1
      );

      // Factor the invoice
      const { result } = simnet.callPublicFn(
        contractName,
        "factor-invoice",
        [Cl.uint(1)],
        address2
      );

      expect(result).toBeOk(
        Cl.tuple({
          "factored-amount": Cl.uint(95000), // 1000 - 5% discount = 950 STX
          "platform-fee": Cl.uint(2375), // 2.5% of 950 STX
          "net-proceeds": Cl.uint(92625) // 950 - 23.75 fee
        })
      );
    });

    it("should fail to factor already factored invoice", () => {
      // Setup
      simnet.callPublicFn(
        contractName,
        "register-business",
        [Cl.stringAscii("Tech Company Inc")],
        address1
      );

      simnet.callPublicFn(
        contractName,
        "register-investor",
        [Cl.stringAscii("Investment Fund LLC")],
        address2
      );

      const currentBlock = simnet.blockHeight;
      simnet.callPublicFn(
        contractName,
        "create-invoice",
        [
          Cl.principal(address3),
          Cl.uint(100000),
          Cl.uint(currentBlock + 100),
          Cl.uint(500)
        ],
        address1
      );

      // Factor once
      simnet.callPublicFn(
        contractName,
        "factor-invoice",
        [Cl.uint(1)],
        address2
      );

      // Try to factor again
      const { result } = simnet.callPublicFn(
        contractName,
        "factor-invoice",
        [Cl.uint(1)],
        address2
      );

      expect(result).toBeErr(Cl.uint(107)); // err-invoice-already-factored
    });

    it("should fail to factor non-existent invoice", () => {
      simnet.callPublicFn(
        contractName,
        "register-investor",
        [Cl.stringAscii("Investment Fund LLC")],
        address2
      );

      const { result } = simnet.callPublicFn(
        contractName,
        "factor-invoice",
        [Cl.uint(999)], // Non-existent invoice
        address2
      );

      expect(result).toBeErr(Cl.uint(101)); // err-not-found
    });
  });

  describe("Invoice Payment", () => {
    it("should allow debtor to pay factored invoice", () => {
      // Setup complete factoring scenario
      simnet.callPublicFn(
        contractName,
        "register-business",
        [Cl.stringAscii("Tech Company Inc")],
        address1
      );

      simnet.callPublicFn(
        contractName,
        "register-investor",
        [Cl.stringAscii("Investment Fund LLC")],
        address2
      );

      const currentBlock = simnet.blockHeight;
      simnet.callPublicFn(
        contractName,
        "create-invoice",
        [
          Cl.principal(address3),
          Cl.uint(100000),
          Cl.uint(currentBlock + 100),
          Cl.uint(500)
        ],
        address1
      );

      simnet.callPublicFn(
        contractName,
        "factor-invoice",
        [Cl.uint(1)],
        address2
      );

      // Debtor pays the invoice
      const { result } = simnet.callPublicFn(
        contractName,
        "pay-invoice",
        [Cl.uint(1)],
        address3
      );

      expect(result).toBeOk(Cl.uint(100000)); // Full invoice amount paid
    });

    it("should fail if non-debtor tries to pay invoice", () => {
      // Setup
      simnet.callPublicFn(
        contractName,
        "register-business",
        [Cl.stringAscii("Tech Company Inc")],
        address1
      );

      simnet.callPublicFn(
        contractName,
        "register-investor",
        [Cl.stringAscii("Investment Fund LLC")],
        address2
      );

      const currentBlock = simnet.blockHeight;
      simnet.callPublicFn(
        contractName,
        "create-invoice",
        [
          Cl.principal(address3),
          Cl.uint(100000),
          Cl.uint(currentBlock + 100),
          Cl.uint(500)
        ],
        address1
      );

      simnet.callPublicFn(
        contractName,
        "factor-invoice",
        [Cl.uint(1)],
        address2
      );

      // Wrong person tries to pay
      const { result } = simnet.callPublicFn(
        contractName,
        "pay-invoice",
        [Cl.uint(1)],
        address1 // Business owner, not debtor
      );

      expect(result).toBeErr(Cl.uint(104)); // err-unauthorized
    });
  });

  describe("Admin Functions", () => {
    it("should allow owner to verify business", () => {
      simnet.callPublicFn(
        contractName,
        "register-business",
        [Cl.stringAscii("Tech Company Inc")],
        address1
      );

      const { result } = simnet.callPublicFn(
        contractName,
        "verify-business",
        [Cl.principal(address1)],
        deployer
      );

      expect(result).toBeOk(Cl.bool(true));
    });

    it("should prevent non-owner from verifying business", () => {
      simnet.callPublicFn(
        contractName,
        "register-business",
        [Cl.stringAscii("Tech Company Inc")],
        address1
      );

      const { result } = simnet.callPublicFn(
        contractName,
        "verify-business",
        [Cl.principal(address1)],
        address2 // Not the owner
      );

      expect(result).toBeErr(Cl.uint(100)); // err-owner-only
    });

    it("should allow owner to set platform fee rate", () => {
      const { result } = simnet.callPublicFn(
        contractName,
        "set-platform-fee-rate",
        [Cl.uint(300)], // 3%
        deployer
      );

      expect(result).toBeOk(Cl.bool(true));
    });

    it("should prevent setting excessive platform fee rate", () => {
      const { result } = simnet.callPublicFn(
        contractName,
        "set-platform-fee-rate",
        [Cl.uint(1500)], // 15% (exceeds 10% limit)
        deployer
      );

      expect(result).toBeErr(Cl.uint(105)); // err-invalid-amount
    });
  });

  describe("Rating System", () => {
    it("should allow rating a business", () => {
      simnet.callPublicFn(
        contractName,
        "register-business",
        [Cl.stringAscii("Tech Company Inc")],
        address1
      );

      const { result } = simnet.callPublicFn(
        contractName,
        "rate-business",
        [Cl.principal(address1), Cl.uint(4)],
        address2
      );

      expect(result).toBeOk(Cl.uint(4)); // First rating becomes the average
    });

    it("should calculate average rating correctly", () => {
      simnet.callPublicFn(
        contractName,
        "register-business",
        [Cl.stringAscii("Tech Company Inc")],
        address1
      );

      // First rating: 4
      simnet.callPublicFn(
        contractName,
        "rate-business",
        [Cl.principal(address1), Cl.uint(4)],
        address2
      );

      // Second rating: 2, should average to 3
      const { result } = simnet.callPublicFn(
        contractName,
        "rate-business",
        [Cl.principal(address1), Cl.uint(2)],
        address3
      );

      expect(result).toBeOk(Cl.uint(3)); // (4 + 2) / 2 = 3
    });

    it("should reject invalid rating values", () => {
      simnet.callPublicFn(
        contractName,
        "register-business",
        [Cl.stringAscii("Tech Company Inc")],
        address1
      );

      const { result } = simnet.callPublicFn(
        contractName,
        "rate-business",
        [Cl.principal(address1), Cl.uint(6)], // Invalid rating (> 5)
        address2
      );

      expect(result).toBeErr(Cl.uint(105)); // err-invalid-amount
    });
  });

  describe("Utility Functions", () => {
    it("should estimate factoring proceeds correctly", () => {
      const { result } = simnet.callReadOnlyFn(
        contractName,
        "estimate-factoring-proceeds",
        [Cl.uint(100000), Cl.uint(500)], // 1000 STX, 5% discount
        address1
      );

      expect(result).toBeTuple({
        "gross-amount": Cl.uint(95000), // 1000 - 5% = 950
        "platform-fee": Cl.uint(2375), // 2.5% of 950
        "net-proceeds": Cl.uint(92625) // 950 - 23.75
      });
    });

    it("should return current platform fee rate", () => {
      const { result } = simnet.callReadOnlyFn(
        contractName,
        "get-platform-fee-rate",
        [],
        address1
      );

      expect(result).toBe(Cl.uint(250)); // Default 2.5%
    });
  });
});