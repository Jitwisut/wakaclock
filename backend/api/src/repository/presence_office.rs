//! Persistent office tools. All reads are scoped by the authorized room in the handler.
use crate::infrastructure::postgres::PostgresClient;
use anyhow::Result;
use serde_json::{json, Value};
use std::sync::Arc;
use uuid::Uuid;

pub struct OfficeRepository(pub Arc<PostgresClient>);
impl OfficeRepository {
    pub async fn messages(&self, room: Uuid, before: Option<Uuid>) -> Result<Vec<Value>> {
        let rows = self.0.query("SELECT m.id, m.user_id, u.username, m.body, m.created_at::text AS created_at FROM presence_messages m JOIN users u ON u.id=m.user_id WHERE m.room_id=$1 AND ($2::uuid IS NULL OR m.id<$2) ORDER BY m.id DESC LIMIT 51", &[&room, &before]).await?;
        Ok(rows.iter().map(|r| json!({"id":r.get::<_,Uuid>("id"),"user_id":r.get::<_,Uuid>("user_id"),"username":r.get::<_,String>("username"),"body":r.get::<_,String>("body"),"created_at":r.get::<_,String>("created_at")})).collect())
    }
    pub async fn snapshot(&self, room: Uuid, members: &[Uuid]) -> Result<Value> {
        let profiles = self
            .0
            .query(
                "SELECT user_id, appearance FROM presence_profiles WHERE user_id=ANY($1)",
                &[&members],
            )
            .await?;
        let reactions = self.0.query("SELECT id,user_id,emoji FROM presence_reactions WHERE room_id=$1 AND created_at > now()-interval '5 seconds' ORDER BY created_at LIMIT 100", &[&room]).await?;
        let sprints = self.0.query("SELECT s.id,s.created_by,s.title,extract(epoch from s.started_at)::bigint AS started_at,extract(epoch from s.ends_at)::bigint AS ends_at,s.finished_at IS NOT NULL AS finished, COALESCE((SELECT jsonb_agg(jsonb_build_object('user_id',m.user_id,'completed',m.completed)) FROM presence_sprint_members m WHERE m.sprint_id=s.id),'[]'::jsonb) AS members FROM presence_sprints s WHERE s.room_id=$1 ORDER BY s.started_at DESC LIMIT 30", &[&room]).await?;
        let spaces = self.0.query("SELECT r.id,r.name,s.kind,s.parent_id FROM presence_spaces s JOIN presence_rooms r ON r.id=s.room_id WHERE (s.parent_id=$1 OR s.parent_id=(SELECT parent_id FROM presence_spaces WHERE room_id=$1)) AND r.ended_at IS NULL AND r.expires_at>now() ORDER BY r.created_at", &[&room]).await?;
        let parent = self.0.query_opt("SELECT r.id,r.name FROM presence_spaces s JOIN presence_rooms r ON r.id=s.parent_id WHERE s.room_id=$1", &[&room]).await?;
        Ok(json!({
          "profiles":profiles.iter().map(|r| (r.get::<_,Uuid>("user_id").to_string(),r.get::<_,Value>("appearance"))).collect::<serde_json::Map<String,Value>>(),
          "reactions":reactions.iter().map(|r| json!({"id":r.get::<_,Uuid>("id"),"user_id":r.get::<_,Uuid>("user_id"),"emoji":r.get::<_,String>("emoji")})).collect::<Vec<_>>(),
          "sprints":sprints.iter().map(|r| json!({"id":r.get::<_,Uuid>("id"),"created_by":r.get::<_,Uuid>("created_by"),"title":r.get::<_,String>("title"),"started_at":r.get::<_,i64>("started_at"),"ends_at":r.get::<_,i64>("ends_at"),"finished":r.get::<_,bool>("finished"),"members":r.get::<_,Value>("members")})).collect::<Vec<_>>(),
          "spaces":spaces.iter().map(|r| json!({"id":r.get::<_,Uuid>("id"),"name":r.get::<_,String>("name"),"kind":r.get::<_,String>("kind")})).collect::<Vec<_>>(),
          "parent":parent.map(|r| json!({"id":r.get::<_,Uuid>("id"),"name":r.get::<_,String>("name")}))
        }))
    }
    pub async fn message(&self, room: Uuid, user: Uuid, id: Uuid, body: &str) -> Result<()> {
        self.0.execute("INSERT INTO presence_messages(id,room_id,user_id,body,request_id) VALUES($1,$2,$3,$4,$5) ON CONFLICT(room_id,user_id,request_id) DO NOTHING", &[&Uuid::now_v7(),&room,&user,&body,&id]).await?;
        Ok(())
    }
    pub async fn reaction(&self, room: Uuid, user: Uuid, emoji: &str) -> Result<()> {
        self.0
            .execute(
                "DELETE FROM presence_reactions WHERE created_at<now()-interval '1 minute'",
                &[],
            )
            .await?;
        self.0
            .execute(
                "INSERT INTO presence_reactions(id,room_id,user_id,emoji) VALUES($1,$2,$3,$4)",
                &[&Uuid::now_v7(), &room, &user, &emoji],
            )
            .await?;
        Ok(())
    }
    pub async fn profile(&self, user: Uuid, appearance: &Value) -> Result<()> {
        self.0.execute("INSERT INTO presence_profiles(user_id,appearance) VALUES($1,$2) ON CONFLICT(user_id) DO UPDATE SET appearance=excluded.appearance,updated_at=now()", &[&user,&appearance]).await?;
        Ok(())
    }
    pub async fn sprint(&self, room: Uuid, user: Uuid, title: &str, minutes: i32) -> Result<()> {
        self.0.execute("INSERT INTO presence_sprints(id,room_id,created_by,title,ends_at) VALUES($1,$2,$3,$4,now()+make_interval(mins=>$5))", &[&Uuid::now_v7(),&room,&user,&title,&minutes]).await?;
        Ok(())
    }
    pub async fn sprint_member(
        &self,
        room: Uuid,
        user: Uuid,
        id: Uuid,
        complete: bool,
    ) -> Result<bool> {
        Ok(self.0.execute("INSERT INTO presence_sprint_members(sprint_id,user_id,completed) SELECT id,$2,$4 FROM presence_sprints WHERE id=$3 AND room_id=$1 AND finished_at IS NULL AND ends_at>now() ON CONFLICT(sprint_id,user_id) DO UPDATE SET completed=excluded.completed", &[&room,&user,&id,&complete]).await?>0)
    }
    pub async fn finish_sprint(&self, room: Uuid, user: Uuid, id: Uuid) -> Result<bool> {
        Ok(self.0.execute("UPDATE presence_sprints SET finished_at=now() WHERE id=$3 AND room_id=$1 AND created_by=$2 AND finished_at IS NULL", &[&room,&user,&id]).await?>0)
    }
    pub async fn rename(&self, room: Uuid, name: &str) -> Result<()> {
        self.0
            .execute(
                "UPDATE presence_rooms SET name=$2,updated_at=now() WHERE id=$1",
                &[&room, &name],
            )
            .await?;
        Ok(())
    }
    pub async fn create_space(
        &self,
        parent: Uuid,
        owner: Uuid,
        name: &str,
        kind: &str,
    ) -> Result<Uuid> {
        let mut connection = self.0.transaction_client().await?;
        let tx = connection.transaction().await?;
        let root=tx.query_opt("SELECT id FROM presence_rooms WHERE id=$1 AND ended_at IS NULL AND (expires_at IS NULL OR expires_at>now()) FOR UPDATE", &[&parent]).await?;
        anyhow::ensure!(root.is_some(), "main office has ended");
        let count:i64=tx.query_one("SELECT count(*) FROM presence_spaces s JOIN presence_rooms r ON r.id=s.room_id WHERE s.parent_id=$1 AND r.ended_at IS NULL AND r.expires_at>now()", &[&parent]).await?.get(0);
        anyhow::ensure!(count < 20, "an office can have at most 20 active spaces");
        let id = Uuid::now_v7();
        tx.execute("INSERT INTO presence_rooms(id,kind,owner_user_id,name,expires_at) SELECT $1,'adhoc',$2,$3,least(now()+interval '24 hours',coalesce(expires_at,now()+interval '24 hours')) FROM presence_rooms WHERE id=$4", &[&id,&owner,&name,&parent]).await?;
        tx.execute(
            "INSERT INTO presence_room_grants(room_id,user_id) VALUES($1,$2)",
            &[&id, &owner],
        )
        .await?;
        tx.execute(
            "INSERT INTO presence_spaces(room_id,parent_id,kind) VALUES($1,$2,$3)",
            &[&id, &parent, &kind],
        )
        .await?;
        for (label, order, x, y) in [
            ("Pairing Table A", 0i32, 25f64, 30f64),
            ("Pairing Table B", 1, 75., 30.),
            ("Pairing Table C", 2, 50., 72.),
        ] {
            tx.execute("INSERT INTO presence_room_zones(id,room_id,label,sort_order,center_x,center_y,width,height) VALUES($1,$2,$3,$4,$5,$6,22,24)", &[&Uuid::now_v7(),&id,&label,&order,&x,&y]).await?;
        }
        tx.commit().await?;
        Ok(id)
    }
    pub async fn parent(&self, room: Uuid) -> Result<Option<Uuid>> {
        Ok(self
            .0
            .query_opt(
                "SELECT parent_id FROM presence_spaces WHERE room_id=$1",
                &[&room],
            )
            .await?
            .map(|r| r.get(0)))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{config::PostgresConfig, repository::presence::PresenceRepository};

    #[tokio::test]
    #[ignore = "requires isolated PRESENCE_TEST_POSTGRES_URL"]
    async fn office_persistence_and_inherited_authorization() {
        let url =
            std::env::var("PRESENCE_TEST_POSTGRES_URL").expect("set isolated test database URL");
        let pg = Arc::new(
            PostgresClient::connect(&PostgresConfig {
                url: Some(url),
                max_connections: 3,
            })
            .await
            .unwrap(),
        );
        pg.migrate().await.unwrap();
        pg.migrate().await.unwrap(); // migration is restart-safe
        let office = OfficeRepository(pg.clone());
        let rooms = PresenceRepository::new(pg.clone());
        let owner = Uuid::now_v7();
        let guest = Uuid::now_v7();
        for id in [owner, guest] {
            pg.execute(
                "INSERT INTO users(id,username) VALUES($1,$2)",
                &[&id, &format!("test-{id}")],
            )
            .await
            .unwrap();
        }
        let room = rooms
            .create_adhoc(owner, "Office test", 3600)
            .await
            .unwrap();
        assert!(!rooms.can_join(&room, guest).await.unwrap());
        rooms.grant(room.id, guest).await.unwrap();
        let message_id = Uuid::now_v7();
        office
            .message(room.id, owner, message_id, "Hello from owner")
            .await
            .unwrap();
        office
            .message(room.id, owner, message_id, "Retry must not duplicate")
            .await
            .unwrap();
        assert_eq!(office.messages(room.id, None).await.unwrap().len(), 1);
        let child_id = office.create_space(room.id, owner, "Meeting", "meeting").await.unwrap();
        let child = rooms.get(child_id).await.unwrap().unwrap();
        assert_eq!(rooms.zones(child.id).await.unwrap().len(), 3);
        assert!(child.expires_at <= room.expires_at);
        assert!(rooms.can_manage(&room, owner).await.unwrap());
        assert!(!rooms.can_manage(&room, guest).await.unwrap());
        rooms.grant(child.id, guest).await.unwrap();
        assert!(rooms.can_join(&child, guest).await.unwrap());
        assert!(office.messages(child.id, None).await.unwrap().is_empty());
        pg.execute(
            "UPDATE presence_room_grants SET revoked_at=now() WHERE room_id=$1 AND user_id=$2",
            &[&room.id, &guest],
        )
        .await
        .unwrap();
        assert!(!rooms.can_join(&child, guest).await.unwrap());
        for _ in 0..55 {
            office
                .message(room.id, owner, Uuid::now_v7(), "page")
                .await
                .unwrap();
        }
        let page = office.messages(room.id, None).await.unwrap();
        assert_eq!(page.len(), 51);
        let cursor = Uuid::parse_str(page[49]["id"].as_str().unwrap()).unwrap();
        let older = office.messages(room.id, Some(cursor)).await.unwrap();
        assert_eq!(older.len(), 6);
        office.reaction(room.id, owner, "👏").await.unwrap();
        office
            .profile(owner, &json!({"shirtColor":"#112233"}))
            .await
            .unwrap();
        office
            .sprint(room.id, owner, "Ship feature", 25)
            .await
            .unwrap();
        let snapshot = office.snapshot(room.id, &[owner, guest]).await.unwrap();
        assert_eq!(snapshot["reactions"][0]["emoji"], "👏");
        assert_eq!(
            snapshot["profiles"][owner.to_string()]["shirtColor"],
            "#112233"
        );
        assert_eq!(snapshot["spaces"][0]["kind"], "meeting");
        let sprint = Uuid::parse_str(snapshot["sprints"][0]["id"].as_str().unwrap()).unwrap();
        assert!(!office
            .sprint_member(child.id, guest, sprint, true)
            .await
            .unwrap());
        assert!(office
            .sprint_member(room.id, owner, sprint, true)
            .await
            .unwrap());
        assert!(!office.finish_sprint(room.id, guest, sprint).await.unwrap());
        assert!(office.finish_sprint(room.id, owner, sprint).await.unwrap());
        assert!(!office
            .sprint_member(room.id, guest, sprint, false)
            .await
            .unwrap());
        office.rename(room.id, "Renamed office").await.unwrap();
        assert_eq!(
            rooms.get(room.id).await.unwrap().unwrap().name,
            "Renamed office"
        );
        pg.execute(
            "DELETE FROM presence_rooms WHERE id=ANY($1)",
            &[&vec![child.id, room.id]],
        )
        .await
        .unwrap();
        pg.execute("DELETE FROM users WHERE id=ANY($1)", &[&vec![owner, guest]])
            .await
            .unwrap();
    }
}
