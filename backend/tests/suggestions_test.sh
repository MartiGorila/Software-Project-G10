#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/api_test_helpers.sh"

require_jq

echo "SETUP: registering suggestion test user"
read -r CREATOR_ID CREATOR_TOKEN _ _ <<<"$(register_test_user suggestion_creator)"

TAG_ID=""
TAGGED_EVENT_ID=""
FAR_EVENT_ID=""
NEAR_PLAN_ID=""
OVER_BUDGET_PLAN_ID=""

cleanup() {
  if [ -n "$TAGGED_EVENT_ID" ]; then
    api_request DELETE "/events/$TAGGED_EVENT_ID" "$CREATOR_TOKEN" "" || true
  fi
  if [ -n "$FAR_EVENT_ID" ]; then
    api_request DELETE "/events/$FAR_EVENT_ID" "$CREATOR_TOKEN" "" || true
  fi
  if [ -n "$NEAR_PLAN_ID" ]; then
    api_request DELETE "/plans/$NEAR_PLAN_ID" "$CREATOR_TOKEN" "" || true
  fi
  if [ -n "$OVER_BUDGET_PLAN_ID" ]; then
    api_request DELETE "/plans/$OVER_BUDGET_PLAN_ID" "$CREATOR_TOKEN" "" || true
  fi
}
trap cleanup EXIT

BASE_LAT="40.4168"
BASE_LNG="-3.7038"

echo "TEST: missing lat/lng returns 400"
api_request GET /suggestions "" ""
assert_status 400 "missing suggestion coordinates"

echo "TEST: invalid type returns 400"
api_request GET "/suggestions?lat=$BASE_LAT&lng=$BASE_LNG&type=bad" "" ""
assert_status 400 "invalid suggestion type"

TAG_NAME="ci-suggestion-tag-$TEST_RUN_ID"
echo "SETUP: creating suggestion tag"
api_request POST /tags "$CREATOR_TOKEN" "$(jq -n --arg name "$TAG_NAME" '{name: $name}')"
assert_status 201 "create suggestion tag"
TAG_ID="$(jq -r ".id" "$RESPONSE_FILE")"

EVENT_TIME="$(future_iso_time)"
TAGGED_EVENT_NAME="CI Suggestion Tagged Event $TEST_RUN_ID"
TAGGED_EVENT_BODY="$(jq -n \
  --arg name "$TAGGED_EVENT_NAME" \
  --arg event_time "$EVENT_TIME" \
  --argjson tag_id "$TAG_ID" \
  '{name: $name, description: "near tagged event", lat: 40.4168, lng: -3.7038, event_time: $event_time, budget: 10, tag_ids: [$tag_id]}')"

echo "SETUP: creating near tagged event"
api_request POST /events "$CREATOR_TOKEN" "$TAGGED_EVENT_BODY"
assert_status 201 "create near tagged event"
TAGGED_EVENT_ID="$(jq -r ".id" "$RESPONSE_FILE")"

FAR_EVENT_NAME="CI Suggestion Far Event $TEST_RUN_ID"
FAR_EVENT_BODY="$(jq -n \
  --arg name "$FAR_EVENT_NAME" \
  --arg event_time "$EVENT_TIME" \
  '{name: $name, description: "far event", lat: 40.9000, lng: -3.7038, event_time: $event_time, budget: 10}')"

echo "SETUP: creating far event"
api_request POST /events "$CREATOR_TOKEN" "$FAR_EVENT_BODY"
assert_status 201 "create far event"
FAR_EVENT_ID="$(jq -r ".id" "$RESPONSE_FILE")"

NEAR_PLAN_NAME="CI Suggestion Near Plan $TEST_RUN_ID"
NEAR_PLAN_BODY="$(jq -n \
  --arg name "$NEAR_PLAN_NAME" \
  '{name: $name, description: "near plan", lat: 40.4172, lng: -3.7040, budget: 15}')"

echo "SETUP: creating near plan"
api_request POST /plans "$CREATOR_TOKEN" "$NEAR_PLAN_BODY"
assert_status 201 "create near plan"
NEAR_PLAN_ID="$(jq -r ".id" "$RESPONSE_FILE")"

OVER_BUDGET_PLAN_NAME="CI Suggestion Over Budget Plan $TEST_RUN_ID"
OVER_BUDGET_PLAN_BODY="$(jq -n \
  --arg name "$OVER_BUDGET_PLAN_NAME" \
  '{name: $name, description: "over budget plan", lat: 40.4173, lng: -3.7041, budget: 200}')"

echo "SETUP: creating over-budget plan"
api_request POST /plans "$CREATOR_TOKEN" "$OVER_BUDGET_PLAN_BODY"
assert_status 201 "create over-budget plan"
OVER_BUDGET_PLAN_ID="$(jq -r ".id" "$RESPONSE_FILE")"

echo "TEST: GET /suggestions returns mixed event and plan results"
api_request GET "/suggestions?lat=$BASE_LAT&lng=$BASE_LNG&radius=2&type=all" "" ""
assert_status 200 "mixed suggestions"
assert_json_true ".results | type == \"array\"" "suggestions results is an array"
assert_json_true --arg id "$TAGGED_EVENT_ID" 'any(.results[]; .type == "event" and .id == $id)' "suggestions include tagged event"
assert_json_true --arg id "$NEAR_PLAN_ID" 'any(.results[]; .type == "plan" and .id == $id)' "suggestions include near plan"

echo "TEST: type=events only returns events"
api_request GET "/suggestions?lat=$BASE_LAT&lng=$BASE_LNG&radius=2&type=events" "" ""
assert_status 200 "event suggestions"
assert_json_true '.results | length > 0 and all(.[]; .type == "event")' "event suggestions only contain events"

echo "TEST: type=plans only returns plans"
api_request GET "/suggestions?lat=$BASE_LAT&lng=$BASE_LNG&radius=2&type=plans" "" ""
assert_status 200 "plan suggestions"
assert_json_true '.results | length > 0 and all(.[]; .type == "plan")' "plan suggestions only contain plans"

echo "TEST: radius excludes known far item"
api_request GET "/suggestions?lat=$BASE_LAT&lng=$BASE_LNG&radius=2&type=all" "" ""
assert_status 200 "radius suggestions"
assert_json_true --arg id "$FAR_EVENT_ID" '([.results[] | select(.id == $id)] | length) == 0' "far event is excluded by radius"

echo "TEST: tag_ids improves tagged item ranking"
api_request GET "/suggestions?lat=$BASE_LAT&lng=$BASE_LNG&radius=2&type=all&tag_ids=$TAG_ID" "" ""
assert_status 200 "tag-ranked suggestions"
assert_json_eq ".results[0].id" "$TAGGED_EVENT_ID" "tagged event ranks first"

echo "TEST: budget_max prefers within-budget plan over over-budget plan"
api_request GET "/suggestions?lat=$BASE_LAT&lng=$BASE_LNG&radius=2&type=plans&budget_max=20" "" ""
assert_status 200 "budget-ranked suggestions"
assert_json_true --arg within "$NEAR_PLAN_ID" --arg over "$OVER_BUDGET_PLAN_ID" '
  ([.results[].id] | index($within)) < ([.results[].id] | index($over))
' "within-budget plan ranks before over-budget plan"

echo "TEST PASSED: suggestions API regression"
