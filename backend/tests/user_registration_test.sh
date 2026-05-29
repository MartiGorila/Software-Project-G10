#!/bin/bash
set -e

echo "SETUP: preparing test data"

TIMESTAMP=$(date +%s)
USERNAME="ci_user_$TIMESTAMP"
EMAIL="ci_user_$TIMESTAMP@example.com"
PASSWORD="test123"

echo "TEST: registering user"

HTTP_CODE=$(curl -s -o /tmp/user_registration_response.json -w "%{http_code}" \
  -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d "{
    \"username\": \"$USERNAME\",
    \"email\": \"$EMAIL\",
    \"password\": \"$PASSWORD\"
  }")

echo "ASSERT: checking response status"

if [ "$HTTP_CODE" -ne 201 ]; then
  echo "FAIL: expected 201, got $HTTP_CODE"
  cat /tmp/user_registration_response.json
  exit 1
fi

echo "ASSERT: checking response contains username"

grep "$USERNAME" /tmp/user_registration_response.json

echo "TEST PASSED"
