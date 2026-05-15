# Mobile Application - Voucher Integration Guide

This document outlines the endpoints and logic for integrating vouchers into the mobile application.

## Endpoints

### 1. List Available Voucher Claims
Get all vouchers issued to/claimed by a specific customer.

- **URL**: `/api/vouchers/claims`
- **Method**: `GET`
- **Auth Required**: Yes (Bearer Token)
- **Query Params**:
  - `customerId` (optional): Filter claims by customer ID.
  - `status` (optional): Filter by status (`claimed`, `partially_redeemed`, `redeemed`). Default is all.

---

### 2. Check Voucher Status/Balance
Check the individual status, balance, and usage history of a voucher code for a customer.

- **URL**: `/api/vouchers/check/:code`
- **Method**: `GET`
- **Auth Required**: Yes (Bearer Token)
- **Query Params**:
  - `customerId` (required): The ID of the customer who owns the voucher.
- **Example Response**:
```json
{
  "id": "claim-id",
  "voucherCode": "VOUCH-123",
  "customerId": "cust-abc",
  "status": "claimed",
  "balance": 50.00,
  "usageHistory": [
    {
      "date": "2026-02-24T12:00:00Z",
      "amount": 10.00,
      "saleNumber": "SALE-001"
    }
  ],
  "voucher": {
    "name": "Gift Voucher",
    "value": 100.00
  }
}
```

---

### 3. Issue/Purchase a Voucher
Issue a new voucher to a customer.

- **URL**: `/api/vouchers/issue`
- **Method**: `POST`
- **Auth Required**: Yes (Bearer Token)
- **Body**:
```json
{
  "voucherId": "campaign-id",
  "customerId": "cust-abc",
  "customerName": "John Doe"
}
```

---

## Sale Creation with Vouchers

When creating a sale (`POST /api/v1/sales`), include the `voucherDiscount` and/or `vouchers` array to deduct the amount from the sale total.

- **voucherDiscount**: A flat amount to deduct from the subtotal.
- **vouchers**: An array of objects for multiple voucher redemptions.

### Example Sale Payload
```json
{
  "customerId": "...",
  "items": [...],
  "voucherDiscount": 50,
  "vouchers": [
    { "code": "VOUCH-01", "amount": 25 },
    { "code": "VOUCH-02", "amount": 25 }
  ],
  "paymentMethod": "cash",
  "paidAmount": 0
}
```

In this example, if the subtotal is 100, the `totalAmount` will be calculated as `100 - 50 - 25 - 25 = 0`. The `balanceAmount` will also be 0.
