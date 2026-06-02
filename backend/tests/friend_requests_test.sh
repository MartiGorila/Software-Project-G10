#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/api_test_helpers.sh"

require_jq

echo "SETUP: registering friend request test users"
read -r USER1_ID USER1_TOKEN USER1_USERNAME _ <<<"$(register_test_user friend_req_user1)"
read -r USER2_ID USER2_TOKEN USER2_USERNAME _ <<<"$(register_test_user friend_req_user2)"
read -r USER3_ID USER3_TOKEN _ _ <<<"$(register_test_user friend_req_user3)"

cleanup() {
  api_request DELETE "/users/me/friends/$USER2_ID" "$USER1_TOKEN" "" || true
  api_request DELETE "/users/me/friends/$USER3_ID" "$USER1_TOKEN" "" || true
}
trap cleanup EXIT

echo "TEST: initial friend request lists are empty"
api_request GET /users/me/friend-requests "$USER1_TOKEN" ""
assert_status 200 "initial friend requests"
assert_json_true '.incoming == [] and .outgoing == []' "initial requests empty"

echo "TEST: user1 sends friend request to user2"
api_request POST "/users/me/friend-requests/$USER2_ID" "$USER1_TOKEN" ""
assert_status 201 "send friend request"
assert_json_eq ".requester_id" "$USER1_ID" "request requester"
assert_json_eq ".recipient_id" "$USER2_ID" "request recipient"
assert_json_eq ".status" "pending" "request pending"
REQUEST_ID="$(jq -r ".id" "$RESPONSE_FILE")"

echo "TEST: duplicate request returns 409"
api_request POST "/users/me/friend-requests/$USER2_ID" "$USER1_TOKEN" ""
assert_status 409 "duplicate friend request"
assert_json_eq ".error" "Friend request already pending." "duplicate request error"

echo "TEST: outgoing and incoming request lists show request"
api_request GET /users/me/friend-requests "$USER1_TOKEN" ""
assert_status 200 "outgoing friend requests"
assert_json_true --arg id "$REQUEST_ID" --arg username "$USER2_USERNAME" \
  'any(.outgoing[]; .id == $id and .recipient.username == $username)' \
  "outgoing request includes recipient"

api_request GET /users/me/friend-requests "$USER2_TOKEN" ""
assert_status 200 "incoming friend requests"
assert_json_true --arg id "$REQUEST_ID" --arg username "$USER1_USERNAME" \
  'any(.incoming[]; .id == $id and .requester.username == $username)' \
  "incoming request includes requester"

echo "TEST: accepting request creates mutual friendship"
api_request POST "/users/me/friend-requests/$REQUEST_ID/accept" "$USER2_TOKEN" ""
assert_status 200 "accept friend request"
assert_json_eq ".ok" "true" "accept response"

api_request GET /users/me/friends "$USER1_TOKEN" ""
assert_status 200 "user1 friends after accept"
assert_json_true --arg id "$USER2_ID" 'any(.[]; .id == $id)' "user1 friends include user2"

api_request GET /users/me/friends "$USER2_TOKEN" ""
assert_status 200 "user2 friends after accept"
assert_json_true --arg id "$USER1_ID" 'any(.[]; .id == $id)' "user2 friends include user1"

echo "TEST: accepted friends cannot send duplicate request"
api_request POST "/users/me/friend-requests/$USER2_ID" "$USER1_TOKEN" ""
assert_status 409 "request existing friend"
assert_json_eq ".error" "Already friends." "request existing friend error"

echo "TEST: reject request does not create friendship"
api_request POST "/users/me/friend-requests/$USER3_ID" "$USER1_TOKEN" ""
assert_status 201 "send rejectable request"
REJECT_REQUEST_ID="$(jq -r ".id" "$RESPONSE_FILE")"

api_request POST "/users/me/friend-requests/$REJECT_REQUEST_ID/reject" "$USER3_TOKEN" ""
assert_status 200 "reject friend request"
assert_json_eq ".ok" "true" "reject response"

api_request GET /users/me/friends "$USER3_TOKEN" ""
assert_status 200 "user3 friends after reject"
assert_json_true --arg id "$USER1_ID" '([.[] | select(.id == $id)] | length) == 0' "reject did not create friendship"

echo "TEST: cancel request does not create friendship"
api_request POST "/users/me/friend-requests/$USER3_ID" "$USER1_TOKEN" ""
assert_status 200 "resend cancelled/rejected request"
CANCEL_REQUEST_ID="$(jq -r ".id" "$RESPONSE_FILE")"

api_request DELETE "/users/me/friend-requests/$CANCEL_REQUEST_ID" "$USER1_TOKEN" ""
assert_status 204 "cancel friend request"

api_request GET /users/me/friend-requests "$USER1_TOKEN" ""
assert_status 200 "outgoing after cancel"
assert_json_true --arg id "$CANCEL_REQUEST_ID" '([.outgoing[] | select(.id == $id)] | length) == 0' "cancel removed outgoing pending request"

echo "TEST PASSED: friend requests API regression"
