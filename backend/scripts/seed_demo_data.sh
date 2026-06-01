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
CLEAR_DEMO_DATA="${CLEAR_DEMO_DATA:-0}"
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
DEMO_EVENTS_DELETED=0
DEMO_PLANS_DELETED=0

EVENT_IDS=()
LEGACY_USER_KEYS=()

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

organic_coordinate() {
  local center_lat="$1"
  local center_lng="$2"
  local key="$3"
  local spread_km="$4"

  node -e '
    const crypto = require("crypto");
    const centerLat = Number(process.argv[1]);
    const centerLng = Number(process.argv[2]);
    const key = process.argv[3];
    const spreadKm = Number(process.argv[4]);
    const hash = crypto.createHash("sha256").update(key).digest();
    const u = hash.readUInt32BE(0) / 0xffffffff;
    const v = hash.readUInt32BE(4) / 0xffffffff;
    const wobble = hash.readUInt32BE(8) / 0xffffffff;
    const radiusKm = (0.12 + Math.sqrt(u) * 0.88) * spreadKm;
    const angle = 2 * Math.PI * v;
    const latJitter = (radiusKm * Math.cos(angle)) / 111.32;
    const lngJitter = (radiusKm * Math.sin(angle)) / (111.32 * Math.cos(centerLat * Math.PI / 180));
    const laneBreak = (wobble - 0.5) * 0.0011;
    const lat = centerLat + latJitter + laneBreak;
    const lng = centerLng + lngJitter - laneBreak / 2;
    console.log(`${lat.toFixed(6)}|${lng.toFixed(6)}`);
  ' "$center_lat" "$center_lng" "$key" "$spread_km"
}

json_number_array() {
  printf '%s\n' "$@" | jq -R . | jq -s 'map(select(length > 0) | tonumber)'
}

json_string_array() {
  printf '%s\n' "$@" | jq -R . | jq -s 'map(select(length > 0))'
}

token_for() {
  local key="$1"
  eval "printf '%s' \"\$${key}_TOKEN\""
}

id_for() {
  local key="$1"
  eval "printf '%s' \"\$${key}_ID\""
}

token_for_user_id() {
  local user_id="$1"
  local key

  for key in "${USER_KEYS[@]}"; do
    if [ "$(id_for "$key")" = "$user_id" ]; then
      token_for "$key"
      return 0
    fi
  done
  for key in "${LEGACY_USER_KEYS[@]}"; do
    if [ "$(id_for "$key")" = "$user_id" ]; then
      token_for "$key"
      return 0
    fi
  done

  return 1
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

  api_request PUT /users/me "$(token_for "$key")" "$(jq -n --arg username "$username" '{username: $username}')"
  if [ "$(status_code)" != "200" ]; then
    echo "Could not update display name for $email. HTTP $(status_code)" >&2
    cat "$RESPONSE_FILE" >&2
    exit 1
  fi
}

try_legacy_cleanup_user() {
  local key="$1"
  local email="$2"

  api_request POST /auth/login "" "$(jq -n --arg email "$email" --arg password "$PASSWORD" \
    '{email: $email, password: $password}')"

  if [ "$(status_code)" = "200" ]; then
    eval "${key}_ID='$(jq -r '.user.id' "$RESPONSE_FILE")'"
    eval "${key}_TOKEN='$(jq -r '.token' "$RESPONSE_FILE")'"
    LEGACY_USER_KEYS+=("$key")
  fi
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

delete_with_creator_token() {
  local path="$1"
  local creator_id="$2"
  local token

  token="$(token_for_user_id "$creator_id" || true)"
  if [ -z "$token" ]; then
    return 1
  fi

  api_request DELETE "$path" "$token" ""
  [ "$(status_code)" = "204" ]
}

clear_demo_events_and_plans() {
  local id name creator_id
  local demo_user_ids_json
  local owner_ids=()
  local key

  for key in "${USER_KEYS[@]}" "${LEGACY_USER_KEYS[@]}"; do
    owner_ids+=("$(id_for "$key")")
  done
  demo_user_ids_json="$(json_string_array "${owner_ids[@]}")"

  echo "CLEAR_DEMO_DATA=1: deleting events and plans owned by seeded demo accounts only."

  api_request GET /events "" ""
  while IFS='|' read -r id name creator_id; do
    [ -n "$id" ] || continue
    if delete_with_creator_token "/events/$id" "$creator_id"; then
      DEMO_EVENTS_DELETED=$((DEMO_EVENTS_DELETED + 1))
      echo "Deleted demo event: $name"
    else
      echo "Could not delete demo event: $name" >&2
    fi
  done < <(jq -r --argjson ids "$demo_user_ids_json" '.[] | select(.creator_id as $creator | $ids | index($creator)) | [.id, .name, .creator_id] | @tsv' "$RESPONSE_FILE" | tr '\t' '|')

  api_request GET /plans "" ""
  while IFS='|' read -r id name creator_id; do
    [ -n "$id" ] || continue
    if delete_with_creator_token "/plans/$id" "$creator_id"; then
      DEMO_PLANS_DELETED=$((DEMO_PLANS_DELETED + 1))
      echo "Deleted demo plan: $name"
    else
      echo "Could not delete demo plan: $name" >&2
    fi
  done < <(jq -r --argjson ids "$demo_user_ids_json" '.[] | select(.creator_id as $creator | $ids | index($creator)) | [.id, .name, .creator_id] | @tsv' "$RESPONSE_FILE" | tr '\t' '|')
}

echo "Seeding demo data through $API_BASE"

USERS=(
  "ALBA|Alba Roca|alba.roca@eventmap.test"
  "MARC|Marc Vidal|marc.vidal@eventmap.test"
  "NORA|Nora Soler|nora.soler@eventmap.test"
  "LEO|Leo Ferrer|leo.ferrer@eventmap.test"
  "IRIS|Iris Costa|iris.costa@eventmap.test"
  "PAU|Pau Martí|pau.marti@eventmap.test"
  "MARTA|Marta Puig|marta.puig@eventmap.test"
  "JAN|Jan Serra|jan.serra@eventmap.test"
  "CLARA|Clara Bosch|clara.bosch@eventmap.test"
  "OT|Ot Navarro|ot.navarro@eventmap.test"
)

for user_record in "${USERS[@]}"; do
  IFS='|' read -r key username email <<< "$user_record"
  ensure_user "$key" "$username" "$email"
done

USER_KEYS=(ALBA MARC NORA LEO IRIS PAU MARTA JAN CLARA OT)

# Older versions of this script used demo-* emails. If those accounts already
# exist locally, log them in only so CLEAR_DEMO_DATA=1 can remove their seeded
# events/plans by ownership. This does not create legacy users.
try_legacy_cleanup_user LEGACY_ALBA "demo-alba@example.com"
try_legacy_cleanup_user LEGACY_MARC "demo-marc@example.com"
try_legacy_cleanup_user LEGACY_NORA "demo-nora@example.com"
try_legacy_cleanup_user LEGACY_LEO "demo-leo@example.com"
try_legacy_cleanup_user LEGACY_IRIS "demo-iris@example.com"
try_legacy_cleanup_user LEGACY_PAU "demo-pau@example.com"
try_legacy_cleanup_user LEGACY_MARTA "demo-marta@example.com"
try_legacy_cleanup_user LEGACY_JAN "demo-jan@example.com"
try_legacy_cleanup_user LEGACY_CLARA "demo-clara@example.com"
try_legacy_cleanup_user LEGACY_OT "demo-ot@example.com"

if [ "$CLEAR_DEMO_DATA" = "1" ]; then
  clear_demo_events_and_plans
fi

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

NEIGHBORHOOD_CENTERS=(
  "Gràcia|41.4036|2.1570|0.95"
  "El Born|41.3846|2.1819|0.72"
  "Eixample|41.3925|2.1649|0.90"
  "Barceloneta|41.3800|2.1896|0.68"
  "Poblenou|41.4020|2.2035|0.92"
  "Montjuïc|41.3688|2.1590|1.10"
  "Gothic Quarter|41.3839|2.1763|0.58"
  "Sant Antoni|41.3785|2.1620|0.62"
  "Sants|41.3751|2.1372|0.92"
  "Sarrià|41.3996|2.1211|1.05"
  "Sagrada Família|41.4036|2.1744|0.70"
  "Sant Andreu|41.4354|2.1902|1.00"
  "La Sagrera|41.4225|2.1877|0.82"
  "Nou Barris|41.4457|2.1798|1.10"
  "Badalona|41.4500|2.2474|1.35"
  "L'Hospitalet de Llobregat|41.3596|2.0997|1.25"
  "Pedralbes|41.3907|2.1120|0.95"
  "Les Corts|41.3868|2.1348|0.78"
)

# Weighted neighborhood assignment: core neighborhoods appear more often, while
# outer neighborhoods still provide realistic map spread without a visible grid.
EVENT_NEIGHBORHOOD_SEQUENCE=(
  2 6 0 1 2 0 7 3 1 10
  4 2 6 0 5 8 1 2 10 7
  0 4 6 2 1 9 10 3 2 0
  11 12 17 8 5 13 15 16 14 9
  2 1 0 6 4 10 7 3 5 17
)

PLAN_NEIGHBORHOOD_SEQUENCE=(
  6 2 0 1 7 2 3 4 0 10
  1 6 2 0 5 8 17 4 7 3
  2 0 1 10 6 9 16 5 8 15
  11 12 13 14 17 4 2 1 0 6
  3 7 10 5 8 9 15 16 11 12
)

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

EVENT_HINTS=(
  "near Passeig de Gràcia"
  "by Plaça Sant Jaume"
  "around Plaça del Sol"
  "near Santa Maria del Mar"
  "by Rambla de Catalunya"
  "around Travessera de Gràcia"
  "near Mercat de Sant Antoni"
  "by the Barceloneta boardwalk"
  "around Passeig del Born"
  "near Avinguda Gaudí"
  "by Rambla del Poblenou"
  "around Consell de Cent"
  "near the Cathedral steps"
  "by Carrer Verdi"
  "around Poble-sec"
  "near Plaça d'Osca"
  "by the Picasso Museum"
  "around Enric Granados"
  "near Hospital de Sant Pau"
  "by Parlament street"
  "around Plaça de la Virreina"
  "near Palo Alto"
  "by Plaça Reial"
  "around Diagonal"
  "near Princesa street"
  "by Sarrià old town"
  "around Sagrada Família gardens"
  "near Port Vell"
  "by Passeig de Sant Joan"
  "around Gran de Gràcia"
  "near Sant Andreu square"
  "by La Sagrera station"
  "around Les Corts library"
  "near Plaça d'Osca terraces"
  "by Montjuïc gardens"
  "around Fabra i Puig"
  "near Collblanc market"
  "by Pedralbes gardens"
  "around Badalona seafront"
  "near Sarrià market"
  "by Girona street"
  "around Rec Comtal"
  "near Joanic"
  "by the Gothic side streets"
  "around Poblenou park"
  "near Sagrada Família metro"
  "by Sant Antoni market"
  "around Barceloneta marina"
  "near Montjuïc castle road"
  "by Les Corts plaza"
)

PLAN_HINTS=(
  "through the Gothic lanes"
  "around Eixample courtyards"
  "near Gràcia plazas"
  "by Born galleries"
  "around Sant Antoni cafes"
  "near Passeig de Gràcia"
  "by the Barceloneta sand"
  "around Poblenou studios"
  "near Verdi street"
  "by Avinguda Gaudí"
  "through El Born"
  "around Plaça Reial"
  "near Consell de Cent"
  "by Gràcia bookshops"
  "around Montjuïc viewpoints"
  "near Plaça d'Osca"
  "by Les Corts terraces"
  "around Rambla del Poblenou"
  "near Sant Antoni market"
  "by Barceloneta marina"
  "through Eixample galleries"
  "around Travessera de Gràcia"
  "near Born boutiques"
  "by Sagrada Família gardens"
  "around the Cathedral"
  "near Sarrià old town"
  "by Pedralbes paths"
  "around Montjuïc fountains"
  "near Plaça d'Osca"
  "by Collblanc streets"
  "around Sant Andreu"
  "near La Sagrera"
  "by Nou Barris parks"
  "around Badalona beach"
  "near Les Corts campus"
  "by Poblenou superblocks"
  "around Eixample patios"
  "near Princesa street"
  "by Plaça del Sol"
  "around the Gothic Quarter"
  "near Barceloneta cafes"
  "by Sant Antoni corners"
  "around Avinguda Gaudí"
  "near Montjuïc trails"
  "by Sants station"
  "around Sarrià cafes"
  "near L'Hospitalet center"
  "by Pedralbes gardens"
  "around Sant Andreu shops"
  "near La Sagrera park"
)

event_index=0
for neighborhood_index in "${EVENT_NEIGHBORHOOD_SEQUENCE[@]}"; do
  neighborhood_record="${NEIGHBORHOOD_CENTERS[$neighborhood_index]}"
  IFS='|' read -r neighborhood base_lat base_lng spread_km <<< "$neighborhood_record"
  template_index=$((event_index % ${#EVENT_TEMPLATES[@]}))
  template="${EVENT_TEMPLATES[$template_index]}"
  IFS='|' read -r title description tag_a tag_b tag_c <<< "$template"
  user_key="${USER_KEYS[$((event_index % ${#USER_KEYS[@]}))]}"
  token="$(token_for "$user_key")"
  budget=$((6 + (event_index * 5) % 35))
  capacity=$((10 + (event_index % 5) * 5))
  day_offset=$((EVENT_DAY_BASES[$template_index] + event_index / 5))
  hour="${EVENT_HOURS[$template_index]}"
  name="$neighborhood $title ${EVENT_HINTS[$event_index]}"
  coords="$(organic_coordinate "$base_lat" "$base_lng" "event|$name" "$spread_km")"
  IFS='|' read -r lat lng <<< "$coords"

  tag_ids=("$(tag_for "$tag_a")" "$(tag_for "$tag_b")")
  if [ -n "${tag_c:-}" ]; then
    tag_ids+=("$(tag_for "$tag_c")")
  fi

  ensure_event "$token" "$name" "$description" "$lat" "$lng" "$day_offset" "$hour" "$budget" "$capacity" "${tag_ids[@]}"
  event_index=$((event_index + 1))
done

plan_index=0
for neighborhood_index in "${PLAN_NEIGHBORHOOD_SEQUENCE[@]}"; do
  neighborhood_record="${NEIGHBORHOOD_CENTERS[$neighborhood_index]}"
  IFS='|' read -r neighborhood base_lat base_lng spread_km <<< "$neighborhood_record"
  template_index=$((plan_index % ${#PLAN_TEMPLATES[@]}))
  template="${PLAN_TEMPLATES[$template_index]}"
  IFS='|' read -r title description tag_a tag_b tag_c <<< "$template"
  user_key="${USER_KEYS[$(((plan_index + 3) % ${#USER_KEYS[@]}))]}"
  token="$(token_for "$user_key")"
  budget=$((4 + (plan_index * 4) % 30))
  name="$neighborhood $title ${PLAN_HINTS[$plan_index]}"
  coords="$(organic_coordinate "$base_lat" "$base_lng" "plan|$name" "$spread_km")"
  IFS='|' read -r lat lng <<< "$coords"

  tag_ids=("$(tag_for "$tag_a")" "$(tag_for "$tag_b")")
  if [ -n "${tag_c:-}" ]; then
    tag_ids+=("$(tag_for "$tag_c")")
  fi

  ensure_plan "$token" "$name" "$description" "$lat" "$lng" "$budget" "${tag_ids[@]}"
  plan_index=$((plan_index + 1))
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
if [ "$CLEAR_DEMO_DATA" = "1" ]; then
  echo "Demo events deleted before reseed: $DEMO_EVENTS_DELETED"
  echo "Demo plans deleted before reseed: $DEMO_PLANS_DELETED"
fi
echo "Event joins attempted: $JOINS_ATTEMPTED"
echo "Friendship attempts: $FRIENDS_ATTEMPTED"
echo
echo "Demo login credentials:"
for user_record in "${USERS[@]}"; do
  IFS='|' read -r _ username email <<< "$user_record"
  echo "  $username / $email / $PASSWORD"
done
