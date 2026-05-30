#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/api_test_helpers.sh"

require_jq

echo "SETUP: registering plan test users"
read -r CREATOR_ID CREATOR_TOKEN _ _ <<<"$(register_test_user plan_creator)"
read -r NON_CREATOR_ID NON_CREATOR_TOKEN _ _ <<<"$(register_test_user plan_noncreator)"

PLAN_ID=""

cleanup() {
  if [ -n "$PLAN_ID" ]; then
    api_request DELETE "/plans/$PLAN_ID" "$CREATOR_TOKEN" "" || true
  fi
}
trap cleanup EXIT

PLAN_NAME="CI MVP Plan $TEST_RUN_ID"
PLAN_BODY="$(jq -n \
  --arg name "$PLAN_NAME" \
  --arg description "CI-created plan regression test" \
  '{name: $name, description: $description, lat: 41.4000, lng: 2.1600, budget: 40}')"

echo "TEST: creator can create plan"
api_request POST /plans "$CREATOR_TOKEN" "$PLAN_BODY"
assert_status 201 "create plan"
assert_json_eq ".name" "$PLAN_NAME" "created plan name"
assert_json_eq ".creator_id" "$CREATOR_ID" "created plan creator"
PLAN_ID="$(jq -r ".id" "$RESPONSE_FILE")"

echo "TEST: GET /plans includes created plan"
api_request GET /plans "" ""
assert_status 200 "list plans"
assert_json_true --arg id "$PLAN_ID" 'any(.[]; .id == $id)' "plans list includes created plan"

echo "TEST: GET /plans/:id returns created plan"
api_request GET "/plans/$PLAN_ID" "" ""
assert_status 200 "get plan"
assert_json_eq ".id" "$PLAN_ID" "plan id"
assert_json_eq ".creator.id" "$CREATOR_ID" "plan creator id"

echo "TEST: non-creator cannot update plan"
api_request PUT "/plans/$PLAN_ID" "$NON_CREATOR_TOKEN" '{"name":"bad update"}'
assert_status 404 "non-creator update plan"
assert_json_eq ".error" "Plan not found or not yours." "non-creator update plan error"

echo "TEST: non-creator delete returns 204 but does not delete plan"
api_request DELETE "/plans/$PLAN_ID" "$NON_CREATOR_TOKEN" ""
assert_status 204 "non-creator delete plan"

api_request GET "/plans/$PLAN_ID" "" ""
assert_status 200 "plan still exists after non-creator delete"
assert_json_eq ".id" "$PLAN_ID" "plan survived non-creator delete"

UPDATED_PLAN_NAME="CI MVP Plan Updated $TEST_RUN_ID"
echo "TEST: creator can update plan"
api_request PUT "/plans/$PLAN_ID" "$CREATOR_TOKEN" "$(jq -n --arg name "$UPDATED_PLAN_NAME" '{name: $name}')"
assert_status 200 "creator update plan"
assert_json_eq ".name" "$UPDATED_PLAN_NAME" "updated plan name"

echo "TEST: creator can delete plan"
api_request DELETE "/plans/$PLAN_ID" "$CREATOR_TOKEN" ""
assert_status 204 "creator delete plan"
DELETED_PLAN_ID="$PLAN_ID"
PLAN_ID=""

api_request GET "/plans/$DELETED_PLAN_ID" "" ""
assert_status 404 "get deleted plan"
assert_json_eq ".error" "Plan not found." "deleted plan error"

echo "TEST PASSED: plans API regression"
