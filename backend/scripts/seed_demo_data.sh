#!/usr/bin/env bash

# Demo/prototype data seeding script.
#
# This script is intentionally NOT wired into npm scripts or CI. It creates
# presentation-friendly data through the public backend API for local demos.
# It does not contain secrets. Run it only against a backend you are allowed
# to populate with demo data.
#
# Usage from the repository root:
#   API_BASE=http://localhost:3000 bash backend/scripts/seed_demo_data.sh
#
# Requirements:
#   - backend running and connected to the intended Supabase project
#   - curl, jq, and node available locally

set -euo pipefail

API_BASE="${API_BASE:-http://localhost:3000}"
PASSWORD="${DEMO_PASSWORD:-DemoPass123!}"
TMP_DIR="$(mktemp -d)"
RESPONSE_FILE="$TMP_DIR/response.json"
STATUS_FILE="$TMP_DIR/status.txt"

cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

require_tool() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required tool: $1" >&2
    exit 1
  fi
}

require_tool curl
require_tool jq
require_tool node

api_request() {
  local method="$1"
  local path="$2"
  local token="${3:-}"
  local body="${4:-}"

  local args=(-sS -X "$method" "$API_BASE$path" -H "Content-Type: application/json")
  if [ -n "$token" ]; then
    args+=(-H "Authorization: Bearer $token")
  fi
  if [ -n "$body" ]; then
    args+=(-d "$body")
  fi

  local status
  status="$(curl "${args[@]}" -o "$RESPONSE_FILE" -w "%{http_code}")"
  printf "%s" "$status" > "$STATUS_FILE"
}

status_code() {
  cat "$STATUS_FILE"
}

future_iso() {
  local days="$1"
  local hour="$2"
  node -e "const d = new Date(Date.now() + Number(process.argv[1]) * 86400000); d.setHours(Number(process.argv[2]), 0, 0, 0); console.log(d.toISOString());" "$days" "$hour"
}

ensure_user() {
  local key="$1"
  local username="$2"
  local email="$3"

  local body
  body="$(jq -n --arg username "$username" --arg email "$email" --arg password "$PASSWORD" \
    '{username: $username, email: $email, password: $password}')"

  api_request POST /auth/register "" "$body"
  if [ "$(status_code)" = "409" ]; then
    api_request POST /auth/login "" "$(jq -n --arg email "$email" --arg password "$PASSWORD" \
      '{email: $email, password: $password}')"
  fi

  local status
  status="$(status_code)"
  if [ "$status" != "200" ] && [ "$status" != "201" ]; then
    echo "Failed to create/login demo user $email. HTTP $status" >&2
    cat "$RESPONSE_FILE" >&2
    exit 1
  fi

  eval "${key}_ID='$(jq -r '.user.id' "$RESPONSE_FILE")'"
  eval "${key}_TOKEN='$(jq -r '.token' "$RESPONSE_FILE")'"
}

ensure_tag() {
  local var_name="$1"
  local tag_name="$2"

  api_request POST /tags "$ALBA_TOKEN" "$(jq -n --arg name "$tag_name" '{name: $name}')"
  local status
  status="$(status_code)"
  if [ "$status" != "200" ] && [ "$status" != "201" ]; then
    echo "Failed to create demo tag $tag_name. HTTP $status" >&2
    cat "$RESPONSE_FILE" >&2
    exit 1
  fi

  eval "${var_name}='$(jq -r '.id' "$RESPONSE_FILE")'"
}

existing_event_id_by_name() {
  local name="$1"
  api_request GET /events "" ""
  jq -r --arg name "$name" '.[] | select(.name == $name) | .id' "$RESPONSE_FILE" | head -n 1
}

existing_plan_id_by_name() {
  local name="$1"
  api_request GET /plans "" ""
  jq -r --arg name "$name" '.[] | select(.name == $name) | .id' "$RESPONSE_FILE" | head -n 1
}

ensure_event() {
  local var_name="$1"
  local token="$2"
  local name="$3"
  local description="$4"
  local lat="$5"
  local lng="$6"
  local days="$7"
  local hour="$8"
  local budget="$9"
  local capacity="${10}"
  shift 10
  local tag_ids=("$@")

  local existing_id
  existing_id="$(existing_event_id_by_name "$name")"
  if [ -n "$existing_id" ]; then
    eval "${var_name}='$existing_id'"
    echo "Event already exists: $name"
    return
  fi

  local tag_json
  tag_json="$(printf '%s\n' "${tag_ids[@]}" | jq -R . | jq -s 'map(tonumber)')"

  local body
  body="$(jq -n \
    --arg name "$name" \
    --arg description "$description" \
    --arg event_time "$(future_iso "$days" "$hour")" \
    --argjson lat "$lat" \
    --argjson lng "$lng" \
    --argjson budget "$budget" \
    --argjson capacity "$capacity" \
    --argjson tag_ids "$tag_json" \
    '{name: $name, description: $description, lat: $lat, lng: $lng, event_time: $event_time, budget: $budget, capacity: $capacity, tag_ids: $tag_ids}')"

  api_request POST /events "$token" "$body"
  if [ "$(status_code)" != "201" ]; then
    echo "Failed to create demo event $name. HTTP $(status_code)" >&2
    cat "$RESPONSE_FILE" >&2
    exit 1
  fi
  eval "${var_name}='$(jq -r '.id' "$RESPONSE_FILE")'"
}

ensure_plan() {
  local var_name="$1"
  local token="$2"
  local name="$3"
  local description="$4"
  local lat="$5"
  local lng="$6"
  local budget="$7"
  shift 7
  local tag_ids=("$@")

  local existing_id
  existing_id="$(existing_plan_id_by_name "$name")"
  if [ -n "$existing_id" ]; then
    eval "${var_name}='$existing_id'"
    echo "Plan already exists: $name"
    return
  fi

  local tag_json
  tag_json="$(printf '%s\n' "${tag_ids[@]}" | jq -R . | jq -s 'map(tonumber)')"

  local body
  body="$(jq -n \
    --arg name "$name" \
    --arg description "$description" \
    --argjson lat "$lat" \
    --argjson lng "$lng" \
    --argjson budget "$budget" \
    --argjson tag_ids "$tag_json" \
    '{name: $name, description: $description, lat: $lat, lng: $lng, budget: $budget, tag_ids: $tag_ids}')"

  api_request POST /plans "$token" "$body"
  if [ "$(status_code)" != "201" ]; then
    echo "Failed to create demo plan $name. HTTP $(status_code)" >&2
    cat "$RESPONSE_FILE" >&2
    exit 1
  fi
  eval "${var_name}='$(jq -r '.id' "$RESPONSE_FILE")'"
}

join_event_if_possible() {
  local token="$1"
  local event_id="$2"
  api_request POST "/events/$event_id/join" "$token" ""
  local status
  status="$(status_code)"
  if [ "$status" != "201" ] && [ "$status" != "409" ]; then
    echo "Could not join event $event_id. HTTP $status" >&2
    cat "$RESPONSE_FILE" >&2
  fi
}

add_friend_if_possible() {
  local token="$1"
  local friend_id="$2"
  api_request POST "/users/me/friends/$friend_id" "$token" ""
  local status
  status="$(status_code)"
  if [ "$status" != "201" ] && [ "$status" != "409" ]; then
    echo "Could not create friendship with $friend_id. HTTP $status" >&2
    cat "$RESPONSE_FILE" >&2
  fi
}

echo "Seeding demo data through $API_BASE"

ensure_user ALBA "demo-alba" "demo-alba@example.com"
ensure_user MARC "demo-marc" "demo-marc@example.com"
ensure_user NORA "demo-nora" "demo-nora@example.com"
ensure_user LEO "demo-leo" "demo-leo@example.com"

ensure_tag CULTURE "culture"
ensure_tag FOOD "food"
ensure_tag OUTDOORS "outdoors"
ensure_tag MUSIC "music"
ensure_tag STUDY "study"
ensure_tag BUDGET "budget-friendly"

ensure_event E_CONCERT "$ALBA_TOKEN" \
  "Demo: Sunset Indie Concert at Parc de la Ciutadella" \
  "A relaxed outdoor concert with local bands, picnic blankets, and late afternoon sun." \
  41.3880 2.1874 3 19 12 30 "$MUSIC" "$OUTDOORS" "$BUDGET"

ensure_event E_TAPAS "$MARC_TOKEN" \
  "Demo: Gothic Quarter Tapas Walk" \
  "Small-group tapas crawl through classic bars near Plaça Reial and hidden side streets." \
  41.3801 2.1754 4 20 24 12 "$FOOD" "$CULTURE"

ensure_event E_STUDY "$NORA_TOKEN" \
  "Demo: Morning Study Sprint at UPF Library" \
  "Focused two-hour study session for project work, followed by coffee nearby." \
  41.3869 2.1744 2 10 4 10 "$STUDY" "$BUDGET"

ensure_event E_JAZZ "$LEO_TOKEN" \
  "Demo: Small Jazz Night in El Born" \
  "Cozy live jazz set in a tiny venue, good for a low-key evening plan." \
  41.3847 2.1816 5 21 18 20 "$MUSIC" "$CULTURE"

ensure_plan P_BUNKERS "$ALBA_TOKEN" \
  "Demo: Bunkers del Carmel Viewpoint Picnic" \
  "Pick up snacks and head to one of Barcelona's best skyline viewpoints." \
  41.4196 2.1619 9 "$OUTDOORS" "$BUDGET"

ensure_plan P_MARKET "$MARC_TOKEN" \
  "Demo: Boqueria Market Lunch Route" \
  "Browse market stalls, grab fruit juice, and build an affordable lunch around La Rambla." \
  41.3817 2.1716 16 "$FOOD" "$CULTURE"

ensure_plan P_BEACH "$NORA_TOKEN" \
  "Demo: Barceloneta Beach Reset" \
  "A simple seaside walk with optional coffee and time to unwind after classes." \
  41.3784 2.1925 6 "$OUTDOORS" "$BUDGET"

ensure_plan P_MUSEUM "$LEO_TOKEN" \
  "Demo: MACBA Afternoon Culture Stop" \
  "Short contemporary art visit followed by people-watching around Plaça dels Àngels." \
  41.3830 2.1660 14 "$CULTURE"

join_event_if_possible "$MARC_TOKEN" "$E_CONCERT"
join_event_if_possible "$NORA_TOKEN" "$E_CONCERT"
join_event_if_possible "$ALBA_TOKEN" "$E_TAPAS"
join_event_if_possible "$LEO_TOKEN" "$E_TAPAS"
join_event_if_possible "$MARC_TOKEN" "$E_STUDY"
join_event_if_possible "$ALBA_TOKEN" "$E_JAZZ"

add_friend_if_possible "$ALBA_TOKEN" "$MARC_ID"
add_friend_if_possible "$ALBA_TOKEN" "$NORA_ID"
add_friend_if_possible "$MARC_TOKEN" "$LEO_ID"

echo "Demo data seed complete."
echo "Users: demo-alba, demo-marc, demo-nora, demo-leo"
echo "Password for all demo users: $PASSWORD"
