#!/bin/bash
set -e

echo "SETUP: preparing test data"
USERNAME="laia_$(date +%s)"
EMAIL="laia_$(date +%s)@example.com"
PASSWORD="test123"

echo "TEST: registering user"

http_code=$(curl -s -o response.json -w "%{http_code}" \
  -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d "{
    \"username\": \"$USERNAME\",
    \"email\": \"$EMAIL\",
    \"password\": \"$PASSWORD\"
  }")

echo "ASSERT: checking response"
if [ "$http_code" -ne 201 ]; then
  echo "FAIL: expected 201, got $http_code"
  exit 1
fi

grep "$USERNAME" response.json

echo "TEARDOWN: cleaning up test data"

curl -s -X DELETE http://localhost:3000/test/user \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$EMAIL\"
  }" || true

echo "TEST PASSED"