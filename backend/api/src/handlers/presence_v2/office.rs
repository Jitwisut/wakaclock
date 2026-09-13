use super::*;
use crate::repository::presence_office::OfficeRepository;

fn office(state: &AppState) -> Result<OfficeRepository, PresenceApiError> {
    Ok(OfficeRepository(state.postgres.clone().ok_or_else(
        || PresenceApiError::unavailable("PostgreSQL is required"),
    )?))
}
async fn access(
    state: &AppState,
    headers: &HeaderMap,
    room_id: Uuid,
) -> Result<(Uuid, PresenceRoom), PresenceApiError> {
    let id = user(state, headers).await?;
    let repository = repo(state)?;
    let room = repository
        .get(room_id)
        .await
        .map_err(PresenceApiError::internal)?
        .ok_or_else(|| PresenceApiError::not_found("room not found"))?;
    if !repository
        .can_join(&room, id)
        .await
        .map_err(PresenceApiError::internal)?
        || !redis(state)?
            .snapshot(room_id)
            .await
            .map_err(PresenceApiError::unavailable)?
            .roster
            .iter()
            .any(|m| m.user_id == id)
    {
        return Err(PresenceApiError::forbidden("join this room first"));
    }
    Ok((id, room))
}
#[derive(Deserialize)]
pub struct MessageQuery {
    before: Option<Uuid>,
}
pub async fn messages(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(room): Path<Uuid>,
    Query(query): Query<MessageQuery>,
) -> Result<Json<RoomEnvelope<Value>>, PresenceApiError> {
    access(&state, &headers, room).await?;
    let mut items = office(&state)?
        .messages(room, query.before)
        .await
        .map_err(PresenceApiError::internal)?;
    let more = items.len() > 50;
    items.truncate(50);
    let cursor = if more {
        items.last().map(|v| v["id"].clone())
    } else {
        None
    };
    items.reverse();
    Ok(Json(envelope(json!({"items":items,"next_cursor":cursor}))))
}
pub async fn snapshot(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(room): Path<Uuid>,
) -> Result<Json<RoomEnvelope<Value>>, PresenceApiError> {
    let (id, r) = access(&state, &headers, room).await?;
    let live = redis(&state)?
        .snapshot(room)
        .await
        .map_err(PresenceApiError::unavailable)?;
    let ids = live.roster.iter().map(|r| r.user_id).collect::<Vec<_>>();
    let mut value = office(&state)?
        .snapshot(room, &ids)
        .await
        .map_err(PresenceApiError::internal)?;
    value["can_manage"] = json!(repo(&state)?
        .can_manage(&r, id)
        .await
        .map_err(PresenceApiError::internal)?);
    value["can_invite"] = json!(r.owner_user_id == Some(id) && value["parent"].is_null());
    value["server_time"] = json!(Utc::now().timestamp());
    value["media_available"] = json!(media_config().is_ok());
    Ok(Json(envelope(value)))
}
#[derive(Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum Command {
    Message { id: Uuid, body: String },
    Reaction { emoji: String },
    Profile { appearance: Value },
    Sprint { title: String, minutes: i32 },
    SprintJoin { id: Uuid, completed: bool },
    SprintFinish { id: Uuid },
    Rename { name: String },
    Space { name: String, space_kind: String },
    SpaceJoin { id: Uuid },
}
fn text_field(value: &str, max: usize) -> Result<&str, PresenceApiError> {
    let value = value.trim();
    if value.is_empty() || value.chars().count() > max {
        return Err(PresenceApiError::bad_request(format!(
            "text must contain 1–{max} characters"
        )));
    }
    Ok(value)
}
fn validate_appearance(value: &Value) -> Result<(), PresenceApiError> {
    for key in ["accentColor", "hairColor", "shirtColor", "skinColor"] {
        let color = value[key].as_str().unwrap_or("");
        if color.len() != 7
            || !color.starts_with('#')
            || !color[1..].bytes().all(|c| c.is_ascii_hexdigit())
        {
            return Err(PresenceApiError::bad_request("invalid sprite color"));
        }
    }
    for (key, allowed) in [
        (
            "accessory",
            &["beanie", "cap", "glasses", "headset", "none"][..],
        ),
        ("hairStyle", &["bob", "bun", "curls", "spiky", "swept"][..]),
        ("outfit", &["hoodie", "jacket", "overalls"][..]),
    ] {
        if !allowed.contains(&value[key].as_str().unwrap_or("")) {
            return Err(PresenceApiError::bad_request("invalid sprite style"));
        }
    }
    if value.as_object().is_none_or(|o| o.len() != 7) {
        return Err(PresenceApiError::bad_request("unexpected sprite fields"));
    }
    Ok(())
}
pub async fn command(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(room_id): Path<Uuid>,
    Json(input): Json<Command>,
) -> Result<Json<RoomEnvelope<Value>>, PresenceApiError> {
    let (id, room) = access(&state, &headers, room_id).await?;
    state
        .presence_rate_limiter
        .check(id)
        .map_err(|_| PresenceApiError::rate_limited())?;
    let db = office(&state)?;
    let mut result = json!({"ok":true});
    match input {
        Command::Message {
            id: message_id,
            body,
        } => {
            if message_id.get_version_num() != 7 {
                return Err(PresenceApiError::bad_request("message id must be UUIDv7"));
            }
            db.message(room_id, id, message_id, text_field(&body, 2000)?)
                .await
                .map_err(PresenceApiError::internal)?;
        }
        Command::Reaction { emoji } => {
            if !["👏", "☕", "✋", "🔥", "❤️"].contains(&emoji.as_str()) {
                return Err(PresenceApiError::bad_request("unknown reaction"));
            }
            db.reaction(room_id, id, &emoji)
                .await
                .map_err(PresenceApiError::internal)?;
        }
        Command::Profile { appearance } => {
            validate_appearance(&appearance)?;
            db.profile(id, &appearance)
                .await
                .map_err(PresenceApiError::internal)?;
        }
        Command::Sprint { title, minutes } => {
            if !(1..=180).contains(&minutes) {
                return Err(PresenceApiError::bad_request(
                    "sprint must be 1–180 minutes",
                ));
            }
            db.sprint(room_id, id, text_field(&title, 160)?, minutes)
                .await
                .map_err(PresenceApiError::internal)?;
        }
        Command::SprintJoin {
            id: sprint,
            completed,
        } => {
            if !db
                .sprint_member(room_id, id, sprint, completed)
                .await
                .map_err(PresenceApiError::internal)?
            {
                return Err(PresenceApiError::conflict("sprint is no longer active"));
            }
        }
        Command::SprintFinish { id: sprint } => {
            if !db
                .finish_sprint(room_id, id, sprint)
                .await
                .map_err(PresenceApiError::internal)?
            {
                return Err(PresenceApiError::forbidden(
                    "only the sprint creator can end it",
                ));
            }
        }
        Command::Rename { name } => {
            if !repo(&state)?
                .can_manage(&room, id)
                .await
                .map_err(PresenceApiError::internal)?
            {
                return Err(PresenceApiError::forbidden(
                    "only the room owner can rename it",
                ));
            }
            db.rename(room_id, text_field(&name, 80)?)
                .await
                .map_err(PresenceApiError::internal)?;
        }
        Command::Space { name, space_kind } => {
            if !repo(&state)?
                .can_manage(&room, id)
                .await
                .map_err(PresenceApiError::internal)?
            {
                return Err(PresenceApiError::forbidden(
                    "only the room owner can create spaces",
                ));
            }
            if !["floor", "meeting"].contains(&space_kind.as_str()) {
                return Err(PresenceApiError::bad_request("invalid space kind"));
            }
            if db
                .parent(room_id)
                .await
                .map_err(PresenceApiError::internal)?
                .is_some()
            {
                return Err(PresenceApiError::bad_request(
                    "create spaces from the main office",
                ));
            }
            let child = db
                .create_space(room_id, id, text_field(&name, 80)?, &space_kind)
                .await
                .map_err(PresenceApiError::internal)?;
            result["room_id"] = json!(child);
        }
        Command::SpaceJoin { id: target } => {
            let root = db
                .parent(room_id)
                .await
                .map_err(PresenceApiError::internal)?
                .unwrap_or(room_id);
            let target_parent = db
                .parent(target)
                .await
                .map_err(PresenceApiError::internal)?;
            if target != root && target_parent != Some(root) {
                return Err(PresenceApiError::forbidden(
                    "space belongs to another office",
                ));
            }
            // Check the root membership before creating an inherited child grant.
            let root_room = repo(&state)?
                .get(root)
                .await
                .map_err(PresenceApiError::internal)?
                .ok_or_else(|| PresenceApiError::not_found("office not found"))?;
            if !repo(&state)?
                .can_join(&root_room, id)
                .await
                .map_err(PresenceApiError::internal)?
            {
                return Err(PresenceApiError::forbidden("office access revoked"));
            }
            if target != root {
                repo(&state)?
                    .grant(target, id)
                    .await
                    .map_err(PresenceApiError::internal)?;
            }
            result["room_id"] = json!(target);
        }
    }
    Ok(Json(envelope(result)))
}

fn media_config() -> Result<(String, String, String), PresenceApiError> {
    let get = |key| {
        std::env::var(key)
            .ok()
            .filter(|v| !v.is_empty())
            .ok_or_else(|| PresenceApiError::unavailable("Media server is not configured"))
    };
    Ok((
        get("LIVEKIT_URL")?,
        get("LIVEKIT_API_KEY")?,
        get("LIVEKIT_API_SECRET")?,
    ))
}
pub async fn media_token(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(room_id): Path<Uuid>,
) -> Result<Json<RoomEnvelope<Value>>, PresenceApiError> {
    let (id, _) = access(&state, &headers, room_id).await?;
    let (url, key, secret) = media_config()?;
    let live = redis(&state)?
        .snapshot(room_id)
        .await
        .map_err(PresenceApiError::unavailable)?;
    let member = live
        .roster
        .iter()
        .find(|m| m.user_id == id)
        .ok_or_else(|| PresenceApiError::forbidden("join room first"))?;
    let zone = member
        .zone_id
        .ok_or_else(|| PresenceApiError::conflict("move into a pod to connect audio and video"))?;
    let name = format!("presence-{room_id}-{zone}");
    let claims = json!({"iss":key,"sub":id.to_string(),"name":member.username,"nbf":Utc::now().timestamp()-5,"exp":Utc::now().timestamp()+30,"video":{"room":name,"roomJoin":true,"canPublish":true,"canSubscribe":true,"canPublishData":false,"canPublishSources":["microphone","camera","screen_share","screen_share_audio"]}});
    let token = jsonwebtoken::encode(
        &jsonwebtoken::Header::default(),
        &claims,
        &jsonwebtoken::EncodingKey::from_secret(secret.as_bytes()),
    )
    .map_err(PresenceApiError::internal)?;
    Ok(Json(envelope(
        json!({"url":url,"token":token,"zone_id":zone}),
    )))
}

/// Enforce pod boundaries on the media server, including clients that stop cooperating.
/// ListRooms also discovers media surviving an API restart; no process-local lease is needed.
pub async fn reconcile_media(state: &AppState) -> anyhow::Result<()> {
    let Ok((url, key, secret)) = media_config() else {
        return Ok(());
    };
    let api = std::env::var("LIVEKIT_INTERNAL_URL").unwrap_or_else(|_| {
        url.replacen("wss://", "https://", 1)
            .replacen("ws://", "http://", 1)
    });
    let client = reqwest::Client::builder()
        .timeout(StdDuration::from_secs(5))
        .build()?;
    let admin = |room: Option<&str>| -> anyhow::Result<String> {
        let grant = match room {
            Some(room) => json!({"roomAdmin":true,"room":room}),
            None => json!({"roomList":true}),
        };
        Ok(jsonwebtoken::encode(
            &jsonwebtoken::Header::default(),
            &json!({"iss":key,"nbf":Utc::now().timestamp()-5,"exp":Utc::now().timestamp()+60,"video":grant}),
            &jsonwebtoken::EncodingKey::from_secret(secret.as_bytes()),
        )?)
    };
    let rooms: Value = client
        .post(format!("{api}/twirp/livekit.RoomService/ListRooms"))
        .bearer_auth(admin(None)?)
        .json(&json!({}))
        .send()
        .await?
        .error_for_status()?
        .json()
        .await?;
    for room in rooms["rooms"].as_array().into_iter().flatten() {
        let Some(name) = room["name"].as_str() else {
            continue;
        };
        let Some(raw) = name.strip_prefix("presence-") else {
            continue;
        };
        if raw.len() != 73 {
            continue;
        }
        let (Ok(room_id), Ok(zone_id)) = (
            Uuid::parse_str(raw.get(..36).unwrap_or("")),
            Uuid::parse_str(raw.get(37..).unwrap_or("")),
        ) else {
            continue;
        };
        let token = admin(Some(name))?;
        let participants: Value = client
            .post(format!("{api}/twirp/livekit.RoomService/ListParticipants"))
            .bearer_auth(&token)
            .json(&json!({"room":name}))
            .send()
            .await?
            .error_for_status()?
            .json()
            .await?;
        // Infrastructure errors fail closed: no stale permission is treated as valid.
        let live = match redis(state) {
            Ok(r) => r.snapshot(room_id).await.ok(),
            Err(_) => None,
        };
        let repository = repo(state).ok();
        let record = match &repository {
            Some(r) => r.get(room_id).await.ok().flatten(),
            None => None,
        };
        for participant in participants["participants"]
            .as_array()
            .into_iter()
            .flatten()
        {
            let Some(identity) = participant["identity"].as_str() else {
                continue;
            };
            let id = Uuid::parse_str(identity).ok();
            let present = live.as_ref().is_some_and(|s| {
                s.roster
                    .iter()
                    .any(|m| Some(m.user_id) == id && m.zone_id == Some(zone_id))
            });
            let authorized = match (&repository, &record, id) {
                (Some(r), Some(room), Some(id)) => r.can_join(room, id).await.unwrap_or(false),
                _ => false,
            };
            if !present || !authorized {
                client
                    .post(format!("{api}/twirp/livekit.RoomService/RemoveParticipant"))
                    .bearer_auth(&token)
                    .json(&json!({"room":name,"identity":identity}))
                    .send()
                    .await?
                    .error_for_status()?;
            }
        }
    }
    Ok(())
}

/// Full personal totals are independent of the paginated history list.
pub async fn personal_summary(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(query): Query<HistoryQuery>,
) -> Result<Json<RoomEnvelope<Value>>, PresenceApiError> {
    let id = user(&state, &headers).await?;
    let (from, to) = history_bounds(
        query.from.as_deref(),
        query.to.as_deref(),
        query.timezone.as_deref(),
    )?;
    if to.saturating_sub(from) > 366 * 86400 {
        return Err(PresenceApiError::bad_request(
            "summary range cannot exceed 366 days",
        ));
    }
    let timezone: Tz = query
        .timezone
        .as_deref()
        .unwrap_or("UTC")
        .parse()
        .map_err(|_| PresenceApiError::bad_request("invalid timezone"))?;
    let rows = state
        .coworking_session_repo
        .personal_windows(id, from, to)
        .await
        .map_err(PresenceApiError::internal)?;
    let mut days = std::collections::HashSet::new();
    let mut seconds = 0u64;
    let now = Utc::now().timestamp().max(0) as u32;
    for row in &rows {
        let start = row.joined_at.max(from);
        let end = row.left_at.unwrap_or(now).min(to);
        seconds += end.saturating_sub(start) as u64;
        if end <= start {
            continue;
        }
        let mut day = DateTime::from_timestamp(start as i64, 0)
            .unwrap()
            .with_timezone(&timezone)
            .date_naive();
        let last = DateTime::from_timestamp((end - 1) as i64, 0)
            .unwrap()
            .with_timezone(&timezone)
            .date_naive();
        while day <= last {
            days.insert(day);
            let Some(next) = day.succ_opt() else {
                break;
            };
            day = next;
        }
    }
    Ok(Json(envelope(
        json!({"sessions":rows.len(),"durationSeconds":seconds,"activeDays":days.len()}),
    )))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reject_invalid_input() {
        assert!(text_field("  ", 80).is_err());
        assert!(text_field(&"x".repeat(2001), 2000).is_err());
        assert!(validate_appearance(&json!({})).is_err());
        assert!(serde_json::from_value::<Command>(json!({"kind":"unknown"})).is_err());
    }

    #[test]
    fn accept_sprite() {
        assert!(validate_appearance(&json!({
            "accentColor":"#abcdef",
            "hairColor":"#123456",
            "shirtColor":"#112233",
            "skinColor":"#aabbcc",
            "accessory":"none",
            "hairStyle":"bob",
            "outfit":"hoodie"
        })).is_ok());
    }
}
