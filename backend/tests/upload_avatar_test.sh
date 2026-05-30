#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/api_test_helpers.sh"

require_jq

echo "SETUP: registering avatar upload test user"
read -r _ USER_TOKEN _ _ <<<"$(register_test_user avatar_user)"

echo "TEST: avatar upload without auth returns 401"
api_request POST /upload/avatar "" ""
assert_status 401 "avatar upload without auth"
assert_json_eq ".error" "Missing or invalid token." "avatar upload missing auth error"

echo "TEST: avatar upload with auth but no file returns 400"
api_request POST /upload/avatar "$USER_TOKEN" ""
assert_status 400 "avatar upload missing file"
assert_json_eq ".error" "Avatar file is required." "avatar upload missing file error"

echo "TEST PASSED: avatar upload API regression"
