;; Invoice Factoring Platform Smart Contract
;; Allows businesses to sell invoices to investors for immediate cash

(define-constant contract-owner tx-sender)
(define-constant err-owner-only (err u100))
(define-constant err-not-found (err u101))
(define-constant err-already-exists (err u102))
(define-constant err-insufficient-funds (err u103))
(define-constant err-unauthorized (err u104))
(define-constant err-invalid-amount (err u105))
(define-constant err-invoice-expired (err u106))
(define-constant err-invoice-already-factored (err u107))
(define-constant err-invalid-discount-rate (err u108))

;; Data Variables
(define-data-var platform-fee-rate uint u250) ;; 2.5% (250 basis points)
(define-data-var next-invoice-id uint u1)

;; Data Maps
(define-map invoices
  { invoice-id: uint }
  {
    business: principal,
    debtor: principal,
    amount: uint,
    due-date: uint,
    created-at: uint,
    discount-rate: uint, ;; basis points (e.g., 500 = 5%)
    factored: bool,
    investor: (optional principal),
    factored-amount: (optional uint)
  }
)

(define-map businesses
  { business: principal }
  {
    name: (string-ascii 50),
    verified: bool,
    total-invoices: uint,
    total-factored: uint
  }
)

(define-map investors
  { investor: principal }
  {
    name: (string-ascii 50),
    verified: bool,
    total-invested: uint,
    active-investments: uint
  }
)

(define-map business-ratings
  { business: principal }
  { rating: uint, total-reviews: uint }
)

;; Helper Functions
(define-private (calculate-factored-amount (amount uint) (discount-rate uint))
  (let ((discount (/ (* amount discount-rate) u10000)))
    (- amount discount)
  )
)

(define-private (calculate-platform-fee (amount uint))
  (/ (* amount (var-get platform-fee-rate)) u10000)
)

;; Read-only Functions
(define-read-only (get-invoice (invoice-id uint))
  (map-get? invoices { invoice-id: invoice-id })
)

(define-read-only (get-business (business principal))
  (map-get? businesses { business: business })
)

(define-read-only (get-investor (investor principal))
  (map-get? investors { investor: investor })
)

(define-read-only (get-business-rating (business principal))
  (map-get? business-ratings { business: business })
)

(define-read-only (get-platform-fee-rate)
  (var-get platform-fee-rate)
)

(define-read-only (estimate-factoring-proceeds (amount uint) (discount-rate uint))
  (let (
    (factored-amount (calculate-factored-amount amount discount-rate))
    (platform-fee (calculate-platform-fee factored-amount))
  )
    {
      gross-amount: factored-amount,
      platform-fee: platform-fee,
      net-proceeds: (- factored-amount platform-fee)
    }
  )
)

;; Business Registration
(define-public (register-business (name (string-ascii 50)))
  (begin
    (asserts! (is-none (map-get? businesses { business: tx-sender })) err-already-exists)
    (map-set businesses
      { business: tx-sender }
      {
        name: name,
        verified: false,
        total-invoices: u0,
        total-factored: u0
      }
    )
    (ok true)
  )
)

;; Investor Registration
(define-public (register-investor (name (string-ascii 50)))
  (begin
    (asserts! (is-none (map-get? investors { investor: tx-sender })) err-already-exists)
    (map-set investors
      { investor: tx-sender }
      {
        name: name,
        verified: false,
        total-invested: u0,
        active-investments: u0
      }
    )
    (ok true)
  )
)

;; Create Invoice
(define-public (create-invoice 
  (debtor principal) 
  (amount uint) 
  (due-date uint) 
  (discount-rate uint))
  (let (
    (invoice-id (var-get next-invoice-id))
    (business-info (unwrap! (map-get? businesses { business: tx-sender }) err-not-found))
  )
    (asserts! (> amount u0) err-invalid-amount)
    (asserts! (> due-date stacks-block-height) err-invoice-expired)
    (asserts! (<= discount-rate u2000) err-invalid-discount-rate) ;; Max 20% discount
    
    ;; Create the invoice
    (map-set invoices
      { invoice-id: invoice-id }
      {
        business: tx-sender,
        debtor: debtor,
        amount: amount,
        due-date: due-date,
        created-at: stacks-block-height,
        discount-rate: discount-rate,
        factored: false,
        investor: none,
        factored-amount: none
      }
    )
    
    ;; Update business stats
    (map-set businesses
      { business: tx-sender }
      (merge business-info { total-invoices: (+ (get total-invoices business-info) u1) })
    )
    
    ;; Increment invoice ID
    (var-set next-invoice-id (+ invoice-id u1))
    
    (ok invoice-id)
  )
)

;; Factor Invoice (Investor buys invoice)
(define-public (factor-invoice (invoice-id uint))
  (let (
    (invoice (unwrap! (map-get? invoices { invoice-id: invoice-id }) err-not-found))
    (investor-info (unwrap! (map-get? investors { investor: tx-sender }) err-not-found))
    (business-info (unwrap! (map-get? businesses { business: (get business invoice) }) err-not-found))
    (factored-amount (calculate-factored-amount (get amount invoice) (get discount-rate invoice)))
    (platform-fee (calculate-platform-fee factored-amount))
    (net-proceeds (- factored-amount platform-fee))
  )
    (asserts! (not (get factored invoice)) err-invoice-already-factored)
    (asserts! (> (get due-date invoice) stacks-block-height) err-invoice-expired)
    (asserts! (>= (stx-get-balance tx-sender) factored-amount) err-insufficient-funds)
    
    ;; Transfer STX from investor to business (net proceeds)
    (try! (stx-transfer? net-proceeds tx-sender (get business invoice)))
    
    ;; Transfer platform fee to contract owner
    (try! (stx-transfer? platform-fee tx-sender contract-owner))
    
    ;; Update invoice
    (map-set invoices
      { invoice-id: invoice-id }
      (merge invoice {
        factored: true,
        investor: (some tx-sender),
        factored-amount: (some factored-amount)
      })
    )
    
    ;; Update business stats
    (map-set businesses
      { business: (get business invoice) }
      (merge business-info { 
        total-factored: (+ (get total-factored business-info) u1)
      })
    )
    
    ;; Update investor stats
    (map-set investors
      { investor: tx-sender }
      (merge investor-info {
        total-invested: (+ (get total-invested investor-info) factored-amount),
        active-investments: (+ (get active-investments investor-info) u1)
      })
    )
    
    (ok {
      factored-amount: factored-amount,
      platform-fee: platform-fee,
      net-proceeds: net-proceeds
    })
  )
)

;; Pay Invoice (Debtor pays the investor)
(define-public (pay-invoice (invoice-id uint))
  (let (
    (invoice (unwrap! (map-get? invoices { invoice-id: invoice-id }) err-not-found))
    (investor (unwrap! (get investor invoice) err-not-found))
    (investor-info (unwrap! (map-get? investors { investor: investor }) err-not-found))
  )
    (asserts! (get factored invoice) err-not-found)
    (asserts! (is-eq tx-sender (get debtor invoice)) err-unauthorized)
    (asserts! (>= (stx-get-balance tx-sender) (get amount invoice)) err-insufficient-funds)
    
    ;; Transfer full invoice amount from debtor to investor
    (try! (stx-transfer? (get amount invoice) tx-sender investor))
    
    ;; Update investor active investments
    (map-set investors
      { investor: investor }
      (merge investor-info {
        active-investments: (- (get active-investments investor-info) u1)
      })
    )
    
    (ok (get amount invoice))
  )
)

;; Admin Functions
(define-public (verify-business (business principal))
  (let ((business-info (unwrap! (map-get? businesses { business: business }) err-not-found)))
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (map-set businesses
      { business: business }
      (merge business-info { verified: true })
    )
    (ok true)
  )
)

(define-public (verify-investor (investor principal))
  (let ((investor-info (unwrap! (map-get? investors { investor: investor }) err-not-found)))
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (map-set investors
      { investor: investor }
      (merge investor-info { verified: true })
    )
    (ok true)
  )
)

(define-public (set-platform-fee-rate (new-rate uint))
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (asserts! (<= new-rate u1000) err-invalid-amount) ;; Max 10%
    (var-set platform-fee-rate new-rate)
    (ok true)
  )
)

;; Rate Business
(define-public (rate-business (business principal) (rating uint))
  (let (
    (current-rating (default-to { rating: u0, total-reviews: u0 } 
                                (map-get? business-ratings { business: business })))
    (total-reviews (get total-reviews current-rating))
    (current-total-rating (* (get rating current-rating) total-reviews))
    (new-total-reviews (+ total-reviews u1))
    (new-average-rating (/ (+ current-total-rating rating) new-total-reviews))
  )
    (asserts! (and (>= rating u1) (<= rating u5)) err-invalid-amount)
    (map-set business-ratings
      { business: business }
      {
        rating: new-average-rating,
        total-reviews: new-total-reviews
      }
    )
    (ok new-average-rating)
  )
)