#!/usr/bin/env bash
# Temporary: learn where DCC licence data can be read. Removed before merge.
set -u
API=https://as-dcc-pub-cann-w-p-002.azurewebsites.net/licenses/AdvancedSearch
for q in "licenseType=Cultivation&pageSize=5&pageNumber=1&sortOrder=issueDate%20desc" "licenseType=Cultivation&licenseStatus=Active&pageSize=5&pageNumber=1&sortOrder=issueDate%20desc" "licenseType=Cultivation&issueDateStart=2026-09-01&pageSize=5&pageNumber=1"; do
  echo "--- $q"
  curl -sS -m 40 -w '\nHTTP %{http_code}\n' "$API?$q" | jq -c '.metadata, (.data[]? | {licenseNumber,licenseStatus,licenseType,issueDate,businessLegalName,premiseCounty})' 2>&1 | head -12
done
