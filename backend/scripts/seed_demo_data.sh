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
# Optional:
#   DEMO_PASSWORD='your-demo-password' API_BASE=http://localhost:3000 bash backend/scripts/seed_demo_data.sh
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

USERS_ATTEMPTED=0
USERS_CREATED=0
USERS_REUSED=0
TAGS_ATTEMPTED=0
TAGS_CREATED=0
TAGS_REUSED=0
EVENTS_ATTEMPTED=0
EVENTS_CREATED=0
EVENTS_SKIPPED=0
PLANS_ATTEMPTED=0
PLANS_CREATED=0
PLANS_SKIPPED=0
JOINS_ATTEMPTED=0
FRIENDS_ATTEMPTED=0

EVENT_IDS=()

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

json_number_array() {
  printf '%s\n' "$@" | jq -R . | jq -s 'map(select(length > 0) | tonumber)'
}

token_for() {
  local key="$1"
  eval "printf '%s' \"\$${key}_TOKEN\""
}

id_for() {
  local key="$1"
  eval "printf '%s' \"\$${key}_ID\""
}

tag_for() {
  local key="$1"
  eval "printf '%s' \"\$TAG_${key}\""
}

ensure_user() {
  local key="$1"
  local username="$2"
  local email="$3"
  USERS_ATTEMPTED=$((USERS_ATTEMPTED + 1))

  local body
  body="$(jq -n --arg username "$username" --arg email "$email" --arg password "$PASSWORD" \
    '{username: $username, email: $email, password: $password}')"

  api_request POST /auth/register "" "$body"
  local status
  status="$(status_code)"
  if [ "$status" = "201" ]; then
    USERS_CREATED=$((USERS_CREATED + 1))
  elif [ "$status" = "409" ]; then
    USERS_REUSED=$((USERS_REUSED + 1))
    api_request POST /auth/login "" "$(jq -n --arg email "$email" --arg password "$PASSWORD" \
      '{email: $email, password: $password}')"
    status="$(status_code)"
  fi

  if [ "$status" != "200" ] && [ "$status" != "201" ]; then
    echo "Failed to create/login demo user $email. HTTP $status" >&2
    cat "$RESPONSE_FILE" >&2
    exit 1
  fi

  eval "${key}_ID='$(jq -r '.user.id' "$RESPONSE_FILE")'"
  eval "${key}_TOKEN='$(jq -r '.token' "$RESPONSE_FILE")'"
}

ensure_tag() {
  local key="$1"
  local tag_name="$2"
  TAGS_ATTEMPTED=$((TAGS_ATTEMPTED + 1))

  api_request POST /tags "$ALBA_TOKEN" "$(jq -n --arg name "$tag_name" '{name: $name}')"
  local status
  status="$(status_code)"
  if [ "$status" = "201" ]; then
    TAGS_CREATED=$((TAGS_CREATED + 1))
  elif [ "$status" = "200" ]; then
    TAGS_REUSED=$((TAGS_REUSED + 1))
  else
    echo "Failed to create demo tag $tag_name. HTTP $status" >&2
    cat "$RESPONSE_FILE" >&2
    exit 1
  fi

  eval "TAG_${key}='$(jq -r '.id' "$RESPONSE_FILE")'"
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
  local token="$1"
  local name="$2"
  local description="$3"
  local lat="$4"
  local lng="$5"
  local days="$6"
  local hour="$7"
  local budget="$8"
  local capacity="$9"
  shift 9
  local tag_ids=("$@")
  EVENTS_ATTEMPTED=$((EVENTS_ATTEMPTED + 1))

  local existing_id
  existing_id="$(existing_event_id_by_name "$name")"
  if [ -n "$existing_id" ]; then
    EVENTS_SKIPPED=$((EVENTS_SKIPPED + 1))
    EVENT_IDS+=("$existing_id")
    echo "Event already exists: $name"
    return
  fi

  local tag_json
  tag_json="$(json_number_array "${tag_ids[@]}")"

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

  EVENTS_CREATED=$((EVENTS_CREATED + 1))
  EVENT_IDS+=("$(jq -r '.id' "$RESPONSE_FILE")")
}

ensure_plan() {
  local token="$1"
  local name="$2"
  local description="$3"
  local lat="$4"
  local lng="$5"
  local budget="$6"
  shift 6
  local tag_ids=("$@")
  PLANS_ATTEMPTED=$((PLANS_ATTEMPTED + 1))

  local existing_id
  existing_id="$(existing_plan_id_by_name "$name")"
  if [ -n "$existing_id" ]; then
    PLANS_SKIPPED=$((PLANS_SKIPPED + 1))
    echo "Plan already exists: $name"
    return
  fi

  local tag_json
  tag_json="$(json_number_array "${tag_ids[@]}")"

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

  PLANS_CREATED=$((PLANS_CREATED + 1))
}

join_event_if_possible() {
  local token="$1"
  local event_id="$2"
  JOINS_ATTEMPTED=$((JOINS_ATTEMPTED + 1))
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
  FRIENDS_ATTEMPTED=$((FRIENDS_ATTEMPTED + 1))
  api_request POST "/users/me/friends/$friend_id" "$token" ""
  local status
  status="$(status_code)"
  if [ "$status" != "201" ] && [ "$status" != "409" ]; then
    echo "Could not create friendship with $friend_id. HTTP $status" >&2
    cat "$RESPONSE_FILE" >&2
  fi
}

echo "Seeding demo data through $API_BASE"

USERS=(
  "ALBA|demo-alba|demo-alba@example.com"
  "MARC|demo-marc|demo-marc@example.com"
  "NORA|demo-nora|demo-nora@example.com"
  "LEO|demo-leo|demo-leo@example.com"
  "IRIS|demo-iris|demo-iris@example.com"
  "PAU|demo-pau|demo-pau@example.com"
  "MARTA|demo-marta|demo-marta@example.com"
  "JAN|demo-jan|demo-jan@example.com"
  "CLARA|demo-clara|demo-clara@example.com"
  "OT|demo-ot|demo-ot@example.com"
)

for user_record in "${USERS[@]}"; do
  IFS='|' read -r key username email <<< "$user_record"
  ensure_user "$key" "$username" "$email"
done

TAGS=(
  "CULTURE|culture"
  "FOOD|food"
  "OUTDOORS|outdoors"
  "MUSIC|music"
  "SPORTS|sports"
  "STUDY|study"
  "BUDGET|budget-friendly"
  "NIGHTLIFE|nightlife"
  "WELLNESS|wellness"
)

for tag_record in "${TAGS[@]}"; do
  IFS='|' read -r key name <<< "$tag_record"
  ensure_tag "$key" "$name"
done

NEIGHBORHOODS=(
  "Gràcia|41.4036|2.1570"
  "El Born|41.3846|2.1819"
  "Eixample|41.3925|2.1649"
  "Barceloneta|41.3800|2.1896"
  "Poblenou|41.4020|2.2035"
  "Montjuïc|41.3688|2.1590"
  "Gothic Quarter|41.3839|2.1763"
  "Sant Antoni|41.3785|2.1620"
  "Sagrada Família|41.4036|2.1744"
  "Sarrià|41.3996|2.1211"
)

USER_KEYS=(ALBA MARC NORA LEO IRIS PAU MARTA JAN CLARA OT)
EVENT_DAY_BASES=(2 3 4 5 6)
EVENT_HOURS=(10 13 17 19 21)

EVENT_TEMPLATES=(
  "Weekend Brunch Meetup|A relaxed table for students and friends to try local favorites and plan the weekend.|FOOD|BUDGET"
  "Open-Air Culture Walk|A guided neighborhood stroll through small plazas, stories, and architecture highlights.|CULTURE|OUTDOORS"
  "Local Live Music Session|A casual evening with local performers, affordable drinks, and an easy social vibe.|MUSIC|NIGHTLIFE"
  "Study Sprint and Coffee|A focused work block followed by coffee and project chat with other students.|STUDY|BUDGET"
  "Sunset Fitness Meetup|A friendly outdoor movement session with stretching, light cardio, and city views.|SPORTS|WELLNESS|OUTDOORS"
)

PLAN_TEMPLATES=(
  "Coffee and Notebook Route|Start with a good coffee, find a quiet table, and explore nearby side streets afterward.|STUDY|BUDGET"
  "Tapas Tasting Loop|Build a flexible food route with two or three stops and plenty of local atmosphere.|FOOD|CULTURE"
  "Photo Walk Afternoon|A self-guided route for street photos, landmarks, and hidden corners.|CULTURE|OUTDOORS"
  "Low-Cost Chill Plan|A budget-friendly plan with walking, snacks, and an easy place to sit outside.|BUDGET|OUTDOORS"
  "Evening Social Route|A simple evening route with music, lights, and a few lively streets to explore.|NIGHTLIFE|MUSIC"
)

event_index=0
for neighborhood_record in "${NEIGHBORHOODS[@]}"; do
  IFS='|' read -r neighborhood base_lat base_lng <<< "$neighborhood_record"
  template_index=0
  for template in "${EVENT_TEMPLATES[@]}"; do
    IFS='|' read -r title description tag_a tag_b tag_c <<< "$template"
    user_key="${USER_KEYS[$((event_index % ${#USER_KEYS[@]}))]}"
    token="$(token_for "$user_key")"
    lat="$(node -e "console.log((Number(process.argv[1]) + Number(process.argv[2]) * 0.0011).toFixed(6))" "$base_lat" "$template_index")"
    lng="$(node -e "console.log((Number(process.argv[1]) + Number(process.argv[2]) * 0.0013).toFixed(6))" "$base_lng" "$template_index")"
    budget=$((6 + (event_index * 5) % 35))
    capacity=$((10 + (event_index % 5) * 5))
    day_offset=$((EVENT_DAY_BASES[$template_index] + event_index / 5))
    hour="${EVENT_HOURS[$template_index]}"
    name="Demo: $neighborhood $title"

    tag_ids=("$(tag_for "$tag_a")" "$(tag_for "$tag_b")")
    if [ -n "${tag_c:-}" ]; then
      tag_ids+=("$(tag_for "$tag_c")")
    fi

    ensure_event "$token" "$name" "$description" "$lat" "$lng" "$day_offset" "$hour" "$budget" "$capacity" "${tag_ids[@]}"
    event_index=$((event_index + 1))
    template_index=$((template_index + 1))
  done
done

plan_index=0
for neighborhood_record in "${NEIGHBORHOODS[@]}"; do
  IFS='|' read -r neighborhood base_lat base_lng <<< "$neighborhood_record"
  template_index=0
  for template in "${PLAN_TEMPLATES[@]}"; do
    IFS='|' read -r title description tag_a tag_b tag_c <<< "$template"
    user_key="${USER_KEYS[$(((plan_index + 3) % ${#USER_KEYS[@]}))]}"
    token="$(token_for "$user_key")"
    lat="$(node -e "console.log((Number(process.argv[1]) - Number(process.argv[2]) * 0.0009).toFixed(6))" "$base_lat" "$template_index")"
    lng="$(node -e "console.log((Number(process.argv[1]) + Number(process.argv[2]) * 0.0010).toFixed(6))" "$base_lng" "$template_index")"
    budget=$((4 + (plan_index * 4) % 30))
    name="Demo: $neighborhood $title"

    tag_ids=("$(tag_for "$tag_a")" "$(tag_for "$tag_b")")
    if [ -n "${tag_c:-}" ]; then
      tag_ids+=("$(tag_for "$tag_c")")
    fi

    ensure_plan "$token" "$name" "$description" "$lat" "$lng" "$budget" "${tag_ids[@]}"
    plan_index=$((plan_index + 1))
    template_index=$((template_index + 1))
  done
done

if [ "${#EVENT_IDS[@]}" -gt 0 ]; then
  for index in "${!EVENT_IDS[@]}"; do
    event_id="${EVENT_IDS[$index]}"
    joiner_a="${USER_KEYS[$(((index + 1) % ${#USER_KEYS[@]}))]}"
    joiner_b="${USER_KEYS[$(((index + 4) % ${#USER_KEYS[@]}))]}"
    joiner_c="${USER_KEYS[$(((index + 7) % ${#USER_KEYS[@]}))]}"
    join_event_if_possible "$(token_for "$joiner_a")" "$event_id"
    join_event_if_possible "$(token_for "$joiner_b")" "$event_id"
    if [ $((index % 2)) -eq 0 ]; then
      join_event_if_possible "$(token_for "$joiner_c")" "$event_id"
    fi
  done
fi

FRIEND_PAIRS=(
  "ALBA|MARC"
  "ALBA|NORA"
  "MARC|LEO"
  "NORA|IRIS"
  "IRIS|PAU"
  "PAU|MARTA"
  "MARTA|JAN"
  "JAN|CLARA"
  "CLARA|OT"
  "OT|ALBA"
  "LEO|MARTA"
  "MARC|PAU"
)

for pair in "${FRIEND_PAIRS[@]}"; do
  IFS='|' read -r user_key friend_key <<< "$pair"
  add_friend_if_possible "$(token_for "$user_key")" "$(id_for "$friend_key")"
done

echo
echo "Demo data seed complete."
echo "Users attempted: $USERS_ATTEMPTED (created: $USERS_CREATED, reused: $USERS_REUSED)"
echo "Tags attempted: $TAGS_ATTEMPTED (created: $TAGS_CREATED, reused: $TAGS_REUSED)"
echo "Events attempted: $EVENTS_ATTEMPTED (created: $EVENTS_CREATED, skipped existing: $EVENTS_SKIPPED)"
echo "Plans attempted: $PLANS_ATTEMPTED (created: $PLANS_CREATED, skipped existing: $PLANS_SKIPPED)"
echo "Event joins attempted: $JOINS_ATTEMPTED"
echo "Friendship attempts: $FRIENDS_ATTEMPTED"
echo
echo "Demo login credentials:"
for user_record in "${USERS[@]}"; do
  IFS='|' read -r _ username email <<< "$user_record"
  echo "  $username / $email / $PASSWORD"
done
