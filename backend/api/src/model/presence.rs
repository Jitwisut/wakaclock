use chrono::{DateTime, Utc};
use serde::Serialize;
use uuid::Uuid;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
pub enum PresenceRoomKind {
    Team,
    Adhoc,
}

impl PresenceRoomKind {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Team => "team",
            Self::Adhoc => "adhoc",
        }
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct PresenceRoom {
    pub id: Uuid,
    pub kind: PresenceRoomKind,
    pub team_id: Option<Uuid>,
    pub owner_user_id: Option<Uuid>,
    pub name: String,
    pub expires_at: Option<DateTime<Utc>>,
    pub ended_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize)]
pub struct PresenceZone {
    pub id: Uuid,
    pub room_id: Uuid,
    pub label: String,
    pub sort_order: i32,
    pub center_x: f64,
    pub center_y: f64,
    pub width: f64,
    pub height: f64,
}

impl PresenceZone {
    pub fn contains(&self, x: f64, y: f64) -> bool {
        let half_width = self.width / 2.0;
        let half_height = self.height / 2.0;
        x >= self.center_x - half_width
            && x <= self.center_x + half_width
            && y >= self.center_y - half_height
            && y <= self.center_y + half_height
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn zone_geometry_uses_normalized_center_and_size() {
        let zone = PresenceZone {
            id: Uuid::nil(),
            room_id: Uuid::nil(),
            label: "Table".to_string(),
            sort_order: 0,
            center_x: 25.0,
            center_y: 30.0,
            width: 22.0,
            height: 24.0,
        };
        assert!(zone.contains(25.0, 30.0));
        assert!(zone.contains(14.0, 18.0));
        assert!(!zone.contains(13.9, 18.0));
        assert!(!zone.contains(25.0, 42.1));
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct PresenceInvite {
    pub id: Uuid,
    pub room_id: Uuid,
    pub expires_at: DateTime<Utc>,
    pub revoked_at: Option<DateTime<Utc>>,
    pub used_count: i32,
    pub created_at: DateTime<Utc>,
}
