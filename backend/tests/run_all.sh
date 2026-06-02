#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

"$SCRIPT_DIR/user_registration_test.sh"
"$SCRIPT_DIR/events_test.sh"
"$SCRIPT_DIR/plans_test.sh"
"$SCRIPT_DIR/users_friends_test.sh"
"$SCRIPT_DIR/friend_requests_test.sh"
"$SCRIPT_DIR/upload_avatar_test.sh"
"$SCRIPT_DIR/tags_test.sh"
"$SCRIPT_DIR/suggestions_test.sh"
"$SCRIPT_DIR/visibility_test.sh"
