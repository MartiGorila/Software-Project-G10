#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/api_test_helpers.sh"

require_jq

echo "SETUP: registering event test users"
read -r CREATOR_ID CREATOR_TOKEN CREATOR_USERNAME _ <<<"$(register_test_user event_creator)"
read -r USER2_ID USER2_TOKEN USER2_USERNAME _ <<<"$(register_test_user event_user2)"
read -r USER3_ID USER3_TOKEN USER3_USERNAME _ <<<"$(register_test_user event_user3)"

EVENT_ID=""
CAPACITY_EVENT_ID=""

cleanup() {
  if [ -n "$EVENT_ID" ]; then
    api_request DELETE "/events/$EVENT_ID" "$CREATOR_TOKEN" "" || true
  fi
  if [ -n "$CAPACITY_EVENT_ID" ]; then
    api_request DELETE "/events/$CAPACITY_EVENT_ID" "$CREATOR_TOKEN" "" || true
  fi
}
trap cleanup EXIT

EVENT_NAME="CI MVP Event $TEST_RUN_ID"
EVENT_TIME="$(future_iso_time)"
EVENT_BODY="$(jq -n \
  --arg name "$EVENT_NAME" \
  --arg description "CI-created event regression test" \
  --arg event_time "$EVENT_TIME" \
  '{name: $name, description: $description, lat: 41.3851, lng: 2.1734, event_time: $event_time, budget: 25, capacity: 3}')"

echo "TEST: creator can create event"
api_request POST /events "$CREATOR_TOKEN" "$EVENT_BODY"
assert_status 201 "create event"
assert_json_eq ".name" "$EVENT_NAME" "created event name"
assert_json_eq ".creator_id" "$CREATOR_ID" "created event creator"
EVENT_ID="$(jq -r ".id" "$RESPONSE_FILE")"

echo "TEST: GET /events includes created event"
api_request GET /events "" ""
assert_status 200 "list events"
assert_json_true --arg id "$EVENT_ID" 'any(.[]; .id == $id)' "events list includes created event"

echo "TEST: GET /events/:id returns event with creator and participants"
api_request GET "/events/$EVENT_ID" "" ""
assert_status 200 "get event"
assert_json_eq ".id" "$EVENT_ID" "event id"
assert_json_eq ".creator.id" "$CREATOR_ID" "event creator id"
assert_json_eq ".creator.username" "$CREATOR_USERNAME" "event creator username"
assert_json_true ".event_participants | type == \"array\"" "event participants array is present"

echo "TEST: user2 can join event"
api_request POST "/events/$EVENT_ID/join" "$USER2_TOKEN" ""
assert_status 201 "join event"
assert_json_eq ".ok" "true" "join response"

echo "TEST: duplicate join returns 409 Already joined"
api_request POST "/events/$EVENT_ID/join" "$USER2_TOKEN" ""
assert_status 409 "duplicate join"
assert_json_eq ".error" "Already joined." "duplicate join error"

echo "TEST: GET event shows user2 participant"
api_request GET "/events/$EVENT_ID" "" ""
assert_status 200 "get event after join"
assert_json_true --arg id "$USER2_ID" 'any(.event_participants[]; .user_id == $id)' "event participants include user2"
assert_json_true --arg username "$USER2_USERNAME" 'any(.event_participants[]; .user.username == $username)' "event participant includes user2 username"

echo "TEST: user2 can leave event"
api_request DELETE "/events/$EVENT_ID/join" "$USER2_TOKEN" ""
assert_status 204 "leave event"

echo "TEST: GET event no longer shows user2 participant"
api_request GET "/events/$EVENT_ID" "" ""
assert_status 200 "get event after leave"
assert_json_true --arg id "$USER2_ID" '([.event_participants[]? | select(.user_id == $id)] | length) == 0' "event participants do not include user2 after leave"

CAPACITY_EVENT_NAME="CI MVP Capacity Event $TEST_RUN_ID"
CAPACITY_EVENT_BODY="$(jq -n \
  --arg name "$CAPACITY_EVENT_NAME" \
  --arg event_time "$EVENT_TIME" \
  '{name: $name, description: "capacity regression test", lat: 41.3900, lng: 2.1800, event_time: $event_time, capacity: 1}')"

echo "TEST: capacity 1 event rejects second participant"
api_request POST /events "$CREATOR_TOKEN" "$CAPACITY_EVENT_BODY"
assert_status 201 "create capacity event"
CAPACITY_EVENT_ID="$(jq -r ".id" "$RESPONSE_FILE")"

api_request POST "/events/$CAPACITY_EVENT_ID/join" "$USER2_TOKEN" ""
assert_status 201 "join capacity event"

api_request POST "/events/$CAPACITY_EVENT_ID/join" "$USER3_TOKEN" ""
assert_status 409 "full event join"
assert_json_eq ".error" "Event is full." "full event error"

echo "TEST: non-creator cannot update event"
api_request PUT "/events/$EVENT_ID" "$USER2_TOKEN" '{"name":"bad update"}'
assert_status 404 "non-creator update event"
assert_json_eq ".error" "Event not found or not yours." "non-creator update event error"

echo "TEST: non-creator delete returns 204 but does not delete event"
api_request DELETE "/events/$EVENT_ID" "$USER2_TOKEN" ""
assert_status 204 "non-creator delete event"

api_request GET "/events/$EVENT_ID" "" ""
assert_status 200 "event still exists after non-creator delete"
assert_json_eq ".id" "$EVENT_ID" "event survived non-creator delete"

UPDATED_EVENT_NAME="CI MVP Event Updated $TEST_RUN_ID"
echo "TEST: creator can update event"
api_request PUT "/events/$EVENT_ID" "$CREATOR_TOKEN" "$(jq -n --arg name "$UPDATED_EVENT_NAME" '{name: $name}')"
assert_status 200 "creator update event"
assert_json_eq ".name" "$UPDATED_EVENT_NAME" "updated event name"

echo "TEST: creator can delete event"
api_request DELETE "/events/$EVENT_ID" "$CREATOR_TOKEN" ""
assert_status 204 "creator delete event"
DELETED_EVENT_ID="$EVENT_ID"
EVENT_ID=""

api_request GET "/events/$DELETED_EVENT_ID" "" ""
assert_status 404 "get deleted event"
assert_json_eq ".error" "Event not found." "deleted event error"

echo "TEST PASSED: events API regression"
