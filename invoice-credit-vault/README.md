# Invoice Factoring Platform

A decentralized invoice factoring platform built on Stacks blockchain that enables businesses to sell their invoices to investors for immediate cash flow.

## Overview

Invoice factoring is a financial service where businesses sell their accounts receivable (invoices) to third parties at a discount in exchange for immediate cash. This smart contract automates the entire process on the blockchain, providing transparency, security, and efficiency.

## Features

### Core Functionality
- **Business Registration**: Companies can register and create invoices
- **Investor Registration**: Investors can register to purchase invoices
- **Invoice Creation**: Businesses create invoices with debtor information and discount rates
- **Invoice Factoring**: Investors purchase invoices at discounted rates for immediate cash to businesses
- **Payment Processing**: Debtors pay full invoice amount directly to investors
- **Rating System**: Rate businesses based on payment history and reliability

### Smart Contract Features
- **Automated Calculations**: Discount rates, platform fees, and net proceeds
- **Access Control**: Role-based permissions for different user types
- **Verification System**: Admin verification for businesses and investors
- **Fee Management**: Configurable platform fees with limits
- **Anti-Fraud**: Prevention of double-factoring and unauthorized payments

## Smart Contract Architecture

### Data Structures

```clojure
;; Invoice Structure
{
  business: principal,
  debtor: principal,
  amount: uint,
  due-date: uint,
  created-at: uint,
  discount-rate: uint,
  factored: bool,
  investor: (optional principal),
  factored-amount: (optional uint)
}

;; Business Profile
{
  name: string-ascii,
  verified: bool,
  total-invoices: uint,
  total-factored: uint
}

;; Investor Profile
{
  name: string-ascii,
  verified: bool,
  total-invested: uint,
  active-investments: uint
}
```

### Key Functions

#### Public Functions
- `register-business(name)` - Register as a business
- `register-investor(name)` - Register as an investor
- `create-invoice(debtor, amount, due-date, discount-rate)` - Create new invoice
- `factor-invoice(invoice-id)` - Purchase invoice at discount
- `pay-invoice(invoice-id)` - Pay invoice (debtor only)
- `rate-business(business, rating)` - Rate business (1-5 scale)

#### Admin Functions (Owner Only)
- `verify-business(business)` - Verify business account
- `verify-investor(investor)` - Verify investor account
- `set-platform-fee-rate(rate)` - Set platform fee (max 10%)

#### Read-Only Functions
- `get-invoice(invoice-id)` - Get invoice details
- `get-business(business)` - Get business profile
- `get-investor(investor)` - Get investor profile
- `estimate-factoring-proceeds(amount, discount-rate)` - Calculate proceeds

## Installation & Setup

### Prerequisites
- [Clarinet](https://github.com/hirosystems/clarinet) installed
- [Node.js](https://nodejs.org/) (for testing)
- [Git](https://git-scm.com/)

### Clone Repository
```bash
git clone https://github.com/your-username/invoice-factoring-platform.git
cd invoice-factoring-platform
```

### Install Dependencies
```bash
npm install
```

### Project Structure
```
invoice-factoring-platform/
├── contracts/
│   └── stx_invoice_credit_vault.clar
├── tests/
│   └── stx_invoice_credit_vault.test.ts
├── Clarinet.toml
├── package.json
└── README.md
```

## Usage Examples

### 1. Business Registration & Invoice Creation
```clojure
;; Register business
(contract-call? .stx_invoice_credit_vault register-business "TechCorp Inc")

;; Create invoice
(contract-call? .stx_invoice_credit_vault create-invoice 
  'SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7  ;; debtor
  u100000  ;; 1000 STX amount
  u1050    ;; due at block 1050
  u500)    ;; 5% discount rate
```

### 2. Investor Registration & Factoring
```clojure
;; Register investor  
(contract-call? .stx_invoice_credit_vault register-investor "Investment Fund LLC")

;; Factor invoice (buy at discount)
(contract-call? .stx_invoice_credit_vault factor-invoice u1)
```

### 3. Payment Process
```clojure
;; Debtor pays full amount to investor
(contract-call? .stx_invoice_credit_vault pay-invoice u1)
```

## Economic Model

### Fee Structure
- **Platform Fee**: 2.5% (default, configurable up to 10%)
- **Discount Rate**: Set by business (max 20%)

### Example Transaction
- Invoice Amount: 1,000 STX
- Discount Rate: 5%
- Factored Amount: 950 STX
- Platform Fee: 23.75 STX (2.5% of factored amount)
- Net to Business: 926.25 STX
- Investor Pays: 950 STX
- Investor Receives: 1,000 STX (when debtor pays)
- Investor Profit: 50 STX

## Testing

### Run Tests
```bash
npm test
```

### Test Coverage
- Business and investor registration
- Invoice creation and validation
- Factoring operations and calculations
- Payment processing
- Admin functions and access control
- Rating system
- Error handling and edge cases

### Example Test
```typescript
it("should factor invoice successfully", () => {
  const { result } = simnet.callPublicFn(
    contractName,
    "factor-invoice",
    [Cl.uint(1)],
    address2
  );

  expect(result).toBeOk(
    Cl.tuple({
      "factored-amount": Cl.uint(95000),
      "platform-fee": Cl.uint(2375),
      "net-proceeds": Cl.uint(92625)
    })
  );
});
```

## Security Considerations

### Access Control
- Only registered businesses can create invoices
- Only registered investors can factor invoices
- Only debtors can pay their invoices
- Only contract owner can verify accounts and set fees

### Validation
- Amount validation (must be > 0)
- Due date validation (must be in future)
- Discount rate limits (max 20%)
- Platform fee limits (max 10%)
- Balance checks before transfers

### Anti-Fraud Measures
- Prevention of double-factoring
- Unique invoice IDs
- Authorization checks for all payments
- Immutable invoice records

## Deployment

### Testnet Deployment
```bash
clarinet deployments generate --testnet
clarinet deployments apply -p testnet
```

### Mainnet Deployment
```bash
clarinet deployments generate --mainnet
clarinet deployments apply -p mainnet
```

## Error Codes

| Code | Constant | Description |
|------|----------|-------------|
| 100 | err-owner-only | Only contract owner can perform this action |
| 101 | err-not-found | Resource not found |
| 102 | err-already-exists | Resource already exists |
| 103 | err-insufficient-funds | Insufficient balance |
| 104 | err-unauthorized | Unauthorized access |
| 105 | err-invalid-amount | Invalid amount provided |
| 106 | err-invoice-expired | Invoice due date has passed |
| 107 | err-invoice-already-factored | Invoice has already been factored |
| 108 | err-invalid-discount-rate | Discount rate exceeds maximum |

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines
- Write comprehensive tests for new features
- Follow Clarinet best practices
- Update documentation for API changes
- Ensure all tests pass before submitting PR

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For questions and support:
- Create an issue on GitHub
- Join our Discord community
- Check the documentation

## Roadmap

### Version 1.1 (Planned)
- [ ] Multi-currency support
- [ ] Automated credit scoring
- [ ] Insurance integration
- [ ] Mobile app interface

### Version 1.2 (Planned)
- [ ] Partial invoice factoring
- [ ] Recurring invoice templates
- [ ] Advanced analytics dashboard
- [ ] API for third-party integrations

## Acknowledgments

- Built on [Stacks](https://stacks.co/) blockchain
- Developed with [Clarinet](https://github.com/hirosystems/clarinet)
- Tested with [Vitest](https://vitest.dev/)