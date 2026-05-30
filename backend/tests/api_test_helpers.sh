#!/bin/bash

set -euo pipefail

API_BASE="${API_BASE:-http://localhost:3000}"
TEST_RUN_ID="${TEST_RUN_ID:-$(date +%s)-$$}"
PASSWORD="${PASSWORD:-test123}"

HTTP_CODE=""
RESPONSE_FILE=""

fail() {
  echo "FAIL: $*" >&2
  if [ -n "${RESPONSE_FILE:-}" ] && [ -f "$RESPONSE_FILE" ]; then
    echo "Response body:" >&2
    cat "$RESPONSE_FILE" >&2
    echo >&2
  fi
  exit 1
}

require_jq() {
  if ! command -v jq >/dev/null 2>&1; then
    fail "jq is required for backend API tests"
  fi
}

api_request() {
  local method="$1"
  local path="$2"
  local token="${3:-}"
  local body="${4:-}"

  RESPONSE_FILE="$(mktemp)"

  local args=(-s -o "$RESPONSE_FILE" -w "%{http_code}" -X "$method")
  if [ -n "$token" ]; then
    args+=(-H "Authorization: Bearer $token")
  fi
  if [ -n "$body" ]; then
    args+=(-H "Content-Type: application/json" -d "$body")
  fi
  args+=("$API_BASE$path")

  HTTP_CODE="$(curl "${args[@]}")"
}

assert_status() {
  local expected="$1"
  local label="$2"

  if [ "$HTTP_CODE" != "$expected" ]; then
    fail "$label: expected HTTP $expected, got $HTTP_CODE"
  fi
}

assert_json_eq() {
  local filter="$1"
  local expected="$2"
  local label="$3"
  local actual

  actual="$(jq -r "$filter" "$RESPONSE_FILE")"
  if [ "$actual" != "$expected" ]; then
    fail "$label: expected '$expected', got '$actual'"
  fi
}

assert_json_true() {
  local label="${!#}"
  local filter_index=$(($# - 1))
  local filter="${!filter_index}"
  local jq_args=("${@:1:$#-2}")

  if [ "$#" -gt 2 ]; then
    if ! jq -e "${jq_args[@]}" "$filter" "$RESPONSE_FILE" >/dev/null; then
      fail "$label"
    fi
  else
    if ! jq -e "$filter" "$RESPONSE_FILE" >/dev/null; then
      fail "$label"
    fi
  fi
}

register_test_user() {
  local prefix="$1"
  local username="${prefix}_${TEST_RUN_ID}"
  local email="${username}@example.com"
  local body

  body="$(jq -n \
    --arg username "$username" \
    --arg email "$email" \
    --arg password "$PASSWORD" \
    '{username: $username, email: $email, password: $password}')"

  api_request POST /auth/register "" "$body"
  assert_status 201 "register $username"
  assert_json_eq ".user.username" "$username" "registered username"
  assert_json_eq ".user.email" "$email" "registered email"
  assert_json_true ".user.id | length > 0" "registered user id is present"
  assert_json_true ".token | length > 0" "registration token is present"

  jq -r --arg username "$username" --arg email "$email" \
    '[.user.id, .token, $username, $email] | @tsv' "$RESPONSE_FILE"
}

future_iso_time() {
  node -e 'console.log(new Date(Date.now() + 60 * 60 * 1000).toISOString())'
}
