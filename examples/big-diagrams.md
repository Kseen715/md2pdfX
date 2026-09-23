---
title: Big diagrams
---

# Big diagrams

A diagram that does not fit the page does not turn into unreadable specks.
md2pdfX tries in turn: a landscape page → another direction (top-down ⇄
left-right) → another layout → snake wrapping → and only then cuts it into
pieces by page height. Nothing to configure.

## Wide: turns top-down

A twelve-step build pipeline in one row is smaller than 60 % even on a
landscape page, so its steps stack one under another, and it stays on a
portrait page.

```mermaid
flowchart LR
    A[Sources] --> B[Linter] --> C[Types] --> D[Unit tests] --> E[Build]
    E --> F[Integration<br/>tests] --> G[Docker image] --> H[Vulnerability<br/>scanner]
    H --> I[Staging] --> J[Load<br/>tests] --> K[Canary 5 %] --> L[Production]
```

## Very long: wraps like a snake

The same pipeline together with incident review — twenty-four steps. It fits
neither in a row nor in a column on any page, so instead of being cut across
pages the chain wraps like a snake: row after row, and every arrow, including
the ones between rows, stays whole.

```mermaid
flowchart LR
    A[Sources] --> B[Linter] --> C[Types] --> D[Unit tests]
    D --> E[Build] --> F[Integration<br/>tests] --> G[Docker image] --> H[Vulnerability<br/>scanner]
    H --> I[Staging] --> J[Load<br/>tests] --> K[Canary 5 %] --> L[Production]
    L --> M[Monitoring] --> N[Alerts] --> O[On-call] --> P[Incident<br/>review]
    P --> Q[Ticket] --> R[Fix] --> S[Code review] --> T[Merge]
    T --> U[Release<br/>candidate] --> V[Regression] --> W[Rollout] --> X[Report]
```

## Long: cut across pages

Services talking during checkout — forty messages. The diagram is cut only
horizontally and only between messages, so no arrow or label is split.

```mermaid
sequenceDiagram
    autonumber
    actor U as Customer
    participant W as Website
    participant A as API
    participant C as Cart
    participant S as Warehouse
    participant P as Payments
    participant N as Notifications
    U->>W: Open catalog
    W->>A: GET /products
    A-->>W: 200, 48 products
    U->>W: Add to cart
    W->>C: POST /cart/items
    C->>S: Check stock
    S-->>C: 12 in stock
    C-->>W: Cart updated
    U->>W: Check out
    W->>A: POST /orders
    A->>C: Freeze cart
    C-->>A: OK
    A->>S: Reserve
    S-->>A: Reservation #7731
    A->>P: Create payment
    P-->>A: Payment link
    A-->>W: 201, order #1042
    W-->>U: Go to payment
    U->>P: Enter card
    P->>P: 3-D Secure
    P-->>U: Confirm the code
    U->>P: Code from SMS
    P->>A: Webhook: paid
    A->>S: Deduct reserved stock
    S-->>A: Deducted
    A->>N: Email “Order paid”
    N-->>U: Email
    A->>S: Send to picking
    S->>S: Pick the order
    S->>A: Picked
    A->>N: Push “Order picked”
    N-->>U: Push
    S->>A: Handed to courier
    A->>N: SMS with tracking number
    N-->>U: SMS
    Note over U,N: Two days later
    U->>W: Review ⭐⭐⭐⭐⭐
    W->>A: POST /reviews
    A-->>W: 201
    W-->>U: Thank you!
```
