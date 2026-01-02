# Sample Report: Checkout Flow Analysis

**Website:** example-store.com  
**Flow:** Complete purchase checkout  
**Outcome:** RISK  
**Date analyzed:** Realistic example (not a real recent scan)

---

## What We Tried

A real user journey:

1. Browse products
2. Add item to cart ($49.99)
3. Click checkout
4. Fill shipping address
5. Select payment method (credit card)
6. Enter card details
7. Click "Complete Purchase"
8. Wait for confirmation

---

## What Worked

- ✅ Product page loaded normally
- ✅ Cart added item successfully
- ✅ Checkout form rendered completely
- ✅ All fields accepted input
- ✅ Form validation passed
- ✅ Payment submission request sent to server

Everything up to the payment button worked. The flow was smooth.

---

## What Broke

After clicking "Complete Purchase":

- ❌ **Confirmation page never appeared**
- ❌ After 3 seconds: loading spinner still spinning
- ❌ After 8 seconds: page timeout error shown
- ❌ Tried reload — same result
- ❌ Tried again — same result
- ❌ After 4 attempts: gave up

### The Critical Problem

**We don't know if the payment went through.**

- The form submission appeared to succeed
- The payment API likely received the request
- But we never got confirmation
- We never got an order number
- We have no proof of purchase

A real customer would:
1. Assume the payment failed (most likely)
2. Try a different card
3. Maybe get charged twice
4. Email customer support
5. Never return to the store

---

## Why This Is RISK

**This is not a code bug.** This is a business failure.

From a code perspective:
- The checkout form works fine
- The payment endpoint is functional
- No errors in the console

From a user perspective:
- The purchase cannot be completed
- There is no way to proceed
- The outcome is unknown
- Trust is broken

Guardian flags this as RISK because:
- The user cannot achieve their goal
- The business cannot complete the transaction
- The user is left in an ambiguous state
- This will cause support tickets and chargebacks

---

## What Should Happen

A healthy checkout flow:

1. User submits payment
2. Server processes payment (1-3 seconds typical)
3. Confirmation page appears immediately
4. User sees: order number, receipt, shipping estimate
5. User can close browser knowing purchase succeeded

Or, if payment fails:

1. User sees: "Card declined" or "Insufficient funds"
2. User can retry with different card
3. User knows exactly what happened

---

## What This Means

**The store is losing sales.**

Not because the code is wrong.  
Not because the infrastructure is down.  
But because the user experience breaks at the critical moment.

Guardian found this before customers did.

---

## How to Fix It

- Check payment confirmation page rendering/loading
- Verify API response time (may be slow)
- Add error boundary so failures show a message, not a timeout
- Add retry logic that tells the user what's happening
- Ensure order confirmation is available even if page initially fails

---

## Confidence Level

**Medium**

We observed the failure consistently across 4 attempts. The pattern is clear. However, the root cause could be:
- Confirmation page rendering issue
- API slow response
- Network timeout
- Session expiration

Guardian reports what it observed (flow blocked at confirmation), not what caused it (that's for the development team).
