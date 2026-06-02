#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/api_test_helpers.sh"

require_jq

echo "SETUP: registering visibility test users"
read -r CREATOR_ID CREATOR_TOKEN _ _ <<<"$(register_test_user visibility_creator)"
read -r FRIEND_ID FRIEND_TOKEN _ _ <<<"$(register_test_user visibility_friend)"
read -r STRANGER_ID STRANGER_TOKEN _ _ <<<"$(register_test_user visibility_stranger)"

PUBLIC_EVENT_ID=""
FRIENDS_EVENT_ID=""
PRIVATE_EVENT_ID=""
PUBLIC_PLAN_ID=""
FRIENDS_PLAN_ID=""
PRIVATE_PLAN_ID=""

cleanup() {
  api_request DELETE "/events/$PUBLIC_EVENT_ID" "$CREATOR_TOKEN" "" || true
  api_request DELETE "/events/$FRIENDS_EVENT_ID" "$CREATOR_TOKEN" "" || true
  api_request DELETE "/events/$PRIVATE_EVENT_ID" "$CREATOR_TOKEN" "" || true
  api_request DELETE "/plans/$PUBLIC_PLAN_ID" "$CREATOR_TOKEN" "" || true
  api_request DELETE "/plans/$FRIENDS_PLAN_ID" "$CREATOR_TOKEN" "" || true
  api_request DELETE "/plans/$PRIVATE_PLAN_ID" "$CREATOR_TOKEN" "" || true
  api_request DELETE "/users/me/friends/$FRIEND_ID" "$CREATOR_TOKEN" "" || true
}
trap cleanup EXIT

echo "SETUP: creating accepted friendship"
api_request POST "/users/me/friends/$FRIEND_ID" "$CREATOR_TOKEN" ""
assert_status 201 "create setup friendship"

EVENT_TIME="$(future_iso_time)"
PUBLIC_EVENT_NAME="CI Visibility Public Event $TEST_RUN_ID"
FRIENDS_EVENT_NAME="CI Visibility Friends Event $TEST_RUN_ID"
PRIVATE_EVENT_NAME="CI Visibility Private Event $TEST_RUN_ID"
PUBLIC_PLAN_NAME="CI Visibility Public Plan $TEST_RUN_ID"
FRIENDS_PLAN_NAME="CI Visibility Friends Plan $TEST_RUN_ID"
PRIVATE_PLAN_NAME="CI Visibility Private Plan $TEST_RUN_ID"

create_event() {
  local name="$1"
  local visibility="$2"
  api_request POST /events "$CREATOR_TOKEN" "$(jq -n \
    --arg name "$name" \
    --arg event_time "$EVENT_TIME" \
    --arg visibility "$visibility" \
    '{name: $name, description: "visibility test event", lat: 41.3851, lng: 2.1734, event_time: $event_time, budget: 10, visibility: $visibility}')"
  assert_status 201 "create $visibility event"
  jq -r ".id" "$RESPONSE_FILE"
}

create_plan() {
  local name="$1"
  local visibility="$2"
  api_request POST /plans "$CREATOR_TOKEN" "$(jq -n \
    --arg name "$name" \
    --arg visibility "$visibility" \
    '{name: $name, description: "visibility test plan", lat: 41.3860, lng: 2.1740, budget: 5, visibility: $visibility}')"
  assert_status 201 "create $visibility plan"
  jq -r ".id" "$RESPONSE_FILE"
}

PUBLIC_EVENT_ID="$(create_event "$PUBLIC_EVENT_NAME" public)"
FRIENDS_EVENT_ID="$(create_event "$FRIENDS_EVENT_NAME" friends)"
PRIVATE_EVENT_ID="$(create_event "$PRIVATE_EVENT_NAME" private)"
PUBLIC_PLAN_ID="$(create_plan "$PUBLIC_PLAN_NAME" public)"
FRIENDS_PLAN_ID="$(create_plan "$FRIENDS_PLAN_NAME" friends)"
PRIVATE_PLAN_ID="$(create_plan "$PRIVATE_PLAN_NAME" private)"

echo "TEST: logged-out list sees public only"
api_request GET /events "" ""
assert_status 200 "logged-out events list"
assert_json_true --arg id "$PUBLIC_EVENT_ID" 'any(.[]; .id == $id)' "logged-out sees public event"
assert_json_true --arg id "$FRIENDS_EVENT_ID" '([.[] | select(.id == $id)] | length) == 0' "logged-out hides friends event"
assert_json_true --arg id "$PRIVATE_EVENT_ID" '([.[] | select(.id == $id)] | length) == 0' "logged-out hides private event"

api_request GET /plans "" ""
assert_status 200 "logged-out plans list"
assert_json_true --arg id "$PUBLIC_PLAN_ID" 'any(.[]; .id == $id)' "logged-out sees public plan"
assert_json_true --arg id "$FRIENDS_PLAN_ID" '([.[] | select(.id == $id)] | length) == 0' "logged-out hides friends plan"
assert_json_true --arg id "$PRIVATE_PLAN_ID" '([.[] | select(.id == $id)] | length) == 0' "logged-out hides private plan"

echo "TEST: accepted friend sees friends-only but not private"
api_request GET /events "$FRIEND_TOKEN" ""
assert_status 200 "friend events list"
assert_json_true --arg id "$FRIENDS_EVENT_ID" 'any(.[]; .id == $id)' "friend sees friends event"
assert_json_true --arg id "$PRIVATE_EVENT_ID" '([.[] | select(.id == $id)] | length) == 0' "friend hides private event"

api_request GET /plans "$FRIEND_TOKEN" ""
assert_status 200 "friend plans list"
assert_json_true --arg id "$FRIENDS_PLAN_ID" 'any(.[]; .id == $id)' "friend sees friends plan"
assert_json_true --arg id "$PRIVATE_PLAN_ID" '([.[] | select(.id == $id)] | length) == 0' "friend hides private plan"

echo "TEST: non-friend sees public only"
api_request GET /events "$STRANGER_TOKEN" ""
assert_status 200 "stranger events list"
assert_json_true --arg id "$FRIENDS_EVENT_ID" '([.[] | select(.id == $id)] | length) == 0' "stranger hides friends event"
assert_json_true --arg id "$PRIVATE_EVENT_ID" '([.[] | select(.id == $id)] | length) == 0' "stranger hides private event"

echo "TEST: creator sees own private content"
api_request GET /events "$CREATOR_TOKEN" ""
assert_status 200 "creator events list"
assert_json_true --arg id "$PRIVATE_EVENT_ID" 'any(.[]; .id == $id)' "creator sees private event"

api_request GET /plans "$CREATOR_TOKEN" ""
assert_status 200 "creator plans list"
assert_json_true --arg id "$PRIVATE_PLAN_ID" 'any(.[]; .id == $id)' "creator sees private plan"

echo "TEST: detail routes enforce visibility"
api_request GET "/events/$FRIENDS_EVENT_ID" "$STRANGER_TOKEN" ""
assert_status 404 "stranger cannot get friends event"
assert_json_eq ".error" "Event not found." "hidden friends event error"

api_request GET "/plans/$PRIVATE_PLAN_ID" "$FRIEND_TOKEN" ""
assert_status 404 "friend cannot get private plan"
assert_json_eq ".error" "Plan not found." "hidden private plan error"

api_request GET "/events/$FRIENDS_EVENT_ID" "$FRIEND_TOKEN" ""
assert_status 200 "friend can get friends event"
assert_json_eq ".id" "$FRIENDS_EVENT_ID" "friend event detail id"

echo "TEST: suggestions respect visibility"
api_request GET "/suggestions?lat=41.3851&lng=2.1734&radius=3&type=all" "" ""
assert_status 200 "logged-out suggestions"
assert_json_true --arg id "$PUBLIC_EVENT_ID" 'any(.results[]; .id == $id)' "logged-out suggestions include public event"
assert_json_true --arg id "$FRIENDS_EVENT_ID" '([.results[] | select(.id == $id)] | length) == 0' "logged-out suggestions hide friends event"
assert_json_true --arg id "$PRIVATE_PLAN_ID" '([.results[] | select(.id == $id)] | length) == 0' "logged-out suggestions hide private plan"

api_request GET "/suggestions?lat=41.3851&lng=2.1734&radius=3&type=all" "$FRIEND_TOKEN" ""
assert_status 200 "friend suggestions"
assert_json_true --arg id "$FRIENDS_EVENT_ID" 'any(.results[]; .id == $id)' "friend suggestions include friends event"
assert_json_true --arg id "$PRIVATE_EVENT_ID" '([.results[] | select(.id == $id)] | length) == 0' "friend suggestions hide private event"

echo "TEST PASSED: visibility API regression"
