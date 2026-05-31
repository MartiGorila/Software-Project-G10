#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/api_test_helpers.sh"

require_jq

echo "SETUP: registering tag test user"
read -r CREATOR_ID CREATOR_TOKEN _ _ <<<"$(register_test_user tag_creator)"

TAG_ID=""
EVENT_ID=""
PLAN_ID=""

cleanup() {
  if [ -n "$EVENT_ID" ]; then
    api_request DELETE "/events/$EVENT_ID" "$CREATOR_TOKEN" "" || true
  fi
  if [ -n "$PLAN_ID" ]; then
    api_request DELETE "/plans/$PLAN_ID" "$CREATOR_TOKEN" "" || true
  fi
}
trap cleanup EXIT

echo "TEST: GET /tags returns an array"
api_request GET /tags "" ""
assert_status 200 "list tags"
assert_json_true ". | type == \"array\"" "tags list is an array"

TAG_NAME="ci-tag-$TEST_RUN_ID"
echo "TEST: authenticated user can create tag"
api_request POST /tags "$CREATOR_TOKEN" "$(jq -n --arg name "$TAG_NAME" '{name: $name}')"
assert_status 201 "create tag"
assert_json_eq ".name" "$TAG_NAME" "created tag name"
TAG_ID="$(jq -r ".id" "$RESPONSE_FILE")"

echo "TEST: duplicate tag returns existing tag"
api_request POST /tags "$CREATOR_TOKEN" "$(jq -n --arg name "$TAG_NAME" '{name: $name}')"
assert_status 200 "create duplicate tag"
assert_json_eq ".id" "$TAG_ID" "duplicate tag id"
assert_json_eq ".name" "$TAG_NAME" "duplicate tag name"

EVENT_NAME="CI Tagged Event $TEST_RUN_ID"
EVENT_TIME="$(future_iso_time)"
EVENT_BODY="$(jq -n \
  --arg name "$EVENT_NAME" \
  --arg event_time "$EVENT_TIME" \
  --argjson tag_id "$TAG_ID" \
  '{name: $name, description: "tagged event regression test", lat: 41.3851, lng: 2.1734, event_time: $event_time, tag_ids: [$tag_id]}')"

echo "TEST: creating event with tag_ids persists tag association"
api_request POST /events "$CREATOR_TOKEN" "$EVENT_BODY"
assert_status 201 "create tagged event"
EVENT_ID="$(jq -r ".id" "$RESPONSE_FILE")"

api_request GET "/events/$EVENT_ID" "" ""
assert_status 200 "get tagged event"
assert_json_true --argjson tag_id "$TAG_ID" 'any(.tags[]?; .id == $tag_id)' "event includes tag id"
assert_json_true --arg tag_name "$TAG_NAME" 'any(.tags[]?; .name == $tag_name)' "event includes tag name"

api_request GET /events "" ""
assert_status 200 "list events with tags"
assert_json_true --arg id "$EVENT_ID" --argjson tag_id "$TAG_ID" \
  'any(.[]; .id == $id and any(.tags[]?; .id == $tag_id))' \
  "events list includes tagged event"

PLAN_NAME="CI Tagged Plan $TEST_RUN_ID"
PLAN_BODY="$(jq -n \
  --arg name "$PLAN_NAME" \
  --argjson tag_id "$TAG_ID" \
  '{name: $name, description: "tagged plan regression test", lat: 41.4000, lng: 2.1600, tag_ids: [$tag_id]}')"

echo "TEST: creating plan with tag_ids persists tag association"
api_request POST /plans "$CREATOR_TOKEN" "$PLAN_BODY"
assert_status 201 "create tagged plan"
PLAN_ID="$(jq -r ".id" "$RESPONSE_FILE")"

api_request GET "/plans/$PLAN_ID" "" ""
assert_status 200 "get tagged plan"
assert_json_true --argjson tag_id "$TAG_ID" 'any(.tags[]?; .id == $tag_id)' "plan includes tag id"
assert_json_true --arg tag_name "$TAG_NAME" 'any(.tags[]?; .name == $tag_name)' "plan includes tag name"

api_request GET /plans "" ""
assert_status 200 "list plans with tags"
assert_json_true --arg id "$PLAN_ID" --argjson tag_id "$TAG_ID" \
  'any(.[]; .id == $id and any(.tags[]?; .id == $tag_id))' \
  "plans list includes tagged plan"

echo "TEST PASSED: tags API regression"
