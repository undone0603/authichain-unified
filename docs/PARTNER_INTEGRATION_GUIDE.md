# AuthiChain License Verification API - Partner Integration Guide

This guide describes how to integrate with the AuthiChain License Verification API, enabling your application to securely validate AuthiChain license keys and unlock features based on the customer's subscription tier.

## Overview
By integrating this API, your platform can perform real-time validation of AuthiChain license keys. This allows for seamless cross-platform feature unlocking and federated trust.

## API Endpoint
`GET /api/license/verify`

### Parameters
| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `key` | string | Yes | The AuthiChain license key to be verified. |

## Response Structure

### 1. Success (`200 OK`)
When a valid key is provided, the API returns the following JSON object:

```json
{
  "valid": true,
  "tier": "pro",
  "seats": 5,
  "email": "user@example.com",
  "expires_at": "2026-12-31T23:59:59Z"
}
```

### 2. Invalid or Expired (`200 OK` or `404 Not Found`)
If the key is found but invalid (expired or revoked), or not found at all:

```json
// Example for revoked key (200 OK)
{
  "valid": false,
  "reason": "License revoked"
}
```

```json
// Example for missing key (404 Not Found)
{
  "valid": false,
  "reason": "Key not found"
}
```

### 3. Error (`400 Bad Request`)
If the `key` parameter is missing from the query string:

```json
{
  "error": "Missing key parameter"
}
```

## Integration Workflow
1.  **Collect Key:** Capture the AuthiChain license key from your user (e.g., via a dashboard setting).
2.  **Verify:** Make a `GET` request to `[AUTHICHAIN_API_BASE_URL]/api/license/verify?key=[USER_KEY]`.
3.  **Handle Response:**
    *   If `valid` is `true`, map the `tier` to your internal feature flags.
    *   If `valid` is `false`, prompt the user to check their key status on the AuthiChain dashboard.
4.  **Cache (Optional):** You may cache the result for a short duration (e.g., 1 hour) to reduce API load, as long as you respect the `expires_at` field if provided.
