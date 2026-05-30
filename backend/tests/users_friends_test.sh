#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/api_test_helpers.sh"

require_jq

echo "SETUP: registering users/friends test users"
read -r USER1_ID USER1_TOKEN USER1_USERNAME USER1_EMAIL <<<"$(register_test_user friends_user1)"
read -r USER2_ID USER2_TOKEN USER2_USERNAME _ <<<"$(register_test_user friends_user2)"

cleanup() {
  api_request DELETE "/users/me/friends/$USER2_ID" "$USER1_TOKEN" "" || true
}
trap cleanup EXIT

echo "TEST: GET /users/me returns private profile including email"
api_request GET /users/me "$USER1_TOKEN" ""
assert_status 200 "get private profile"
assert_json_eq ".id" "$USER1_ID" "private profile id"
assert_json_eq ".username" "$USER1_USERNAME" "private profile username"
assert_json_eq ".email" "$USER1_EMAIL" "private profile email"

echo "TEST: GET /users/:id returns public profile without email"
api_request GET "/users/$USER1_ID" "" ""
assert_status 200 "get public profile"
assert_json_eq ".id" "$USER1_ID" "public profile id"
assert_json_eq ".username" "$USER1_USERNAME" "public profile username"
assert_json_true 'has("email") | not' "public profile does not expose email"

echo "TEST: initial friends list is empty"
api_request GET /users/me/friends "$USER1_TOKEN" ""
assert_status 200 "initial friends list"
assert_json_true ". == []" "initial friends list is empty"

UPDATED_USERNAME="friends_updated_$TEST_RUN_ID"
AVATAR_URL="https://example.com/avatar-$TEST_RUN_ID.png"
echo "TEST: PUT /users/me updates username and avatar_url"
api_request PUT /users/me "$USER1_TOKEN" "$(jq -n --arg username "$UPDATED_USERNAME" --arg avatar_url "$AVATAR_URL" '{username: $username, avatar_url: $avatar_url}')"
assert_status 200 "update profile"
assert_json_eq ".id" "$USER1_ID" "updated profile id"
assert_json_eq ".username" "$UPDATED_USERNAME" "updated username"
assert_json_eq ".avatar_url" "$AVATAR_URL" "updated avatar url"
assert_json_eq ".email" "$USER1_EMAIL" "updated profile keeps email"

echo "TEST: create mutual friendship"
api_request POST "/users/me/friends/$USER2_ID" "$USER1_TOKEN" ""
assert_status 201 "create friendship"
assert_json_eq ".ok" "true" "friendship create response"

echo "TEST: user1 friends list shows user2"
api_request GET /users/me/friends "$USER1_TOKEN" ""
assert_status 200 "user1 friends list"
assert_json_true --arg id "$USER2_ID" 'any(.[]; .id == $id)' "user1 friends include user2"
assert_json_true --arg username "$USER2_USERNAME" 'any(.[]; .username == $username)' "user1 friends include user2 username"

echo "TEST: user2 friends list shows updated user1"
api_request GET /users/me/friends "$USER2_TOKEN" ""
assert_status 200 "user2 friends list"
assert_json_true --arg id "$USER1_ID" 'any(.[]; .id == $id)' "user2 friends include user1"
assert_json_true --arg username "$UPDATED_USERNAME" 'any(.[]; .username == $username)' "user2 friends include updated user1 username"

echo "TEST: duplicate friendship returns 409 Already friends"
api_request POST "/users/me/friends/$USER2_ID" "$USER1_TOKEN" ""
assert_status 409 "duplicate friendship"
assert_json_eq ".error" "Already friends." "duplicate friendship error"

echo "TEST: delete friendship returns 204"
api_request DELETE "/users/me/friends/$USER2_ID" "$USER1_TOKEN" ""
assert_status 204 "delete friendship"

echo "TEST: both friend lists are empty after deletion"
api_request GET /users/me/friends "$USER1_TOKEN" ""
assert_status 200 "user1 friends after deletion"
assert_json_true ". == []" "user1 friends empty after deletion"

api_request GET /users/me/friends "$USER2_TOKEN" ""
assert_status 200 "user2 friends after deletion"
assert_json_true ". == []" "user2 friends empty after deletion"

echo "TEST PASSED: users/friends API regression"
