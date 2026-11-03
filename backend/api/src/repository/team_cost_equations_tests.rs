//! Deferred synthetic publication/restore regression. No personal usage or
//! provider runtime is used; database identity is checked before migrations.
use super::team_trust::{CostPublication, Registry, TeamTrustRepository};
use crate::{
    config::PostgresConfig,
    infrastructure::postgres::PostgresClient,
    services::team_cost_equations::{Equations, VERSION},
};
use chrono::{Datelike, Duration, Utc};
use std::{
    collections::{BTreeMap, BTreeSet},
    sync::Arc,
};
use uuid::Uuid;

#[tokio::test]
#[ignore = "requires isolated atoaxis_team_test; development-first verification is deferred"]
async fn observed_cost_equation_bundle_is_atomic_legacy_closed_and_restore_bound() {
    let url = std::env::var("POSTGRES_TEST_URL").unwrap();
    assert_eq!(
        url.parse::<tokio_postgres::Config>().unwrap().get_dbname(),
        Some("atoaxis_team_test")
    );
    let pg = Arc::new(
        PostgresClient::connect(&PostgresConfig {
            url: Some(url),
            max_connections: 8,
        })
        .await
        .unwrap(),
    );
    pg.migrate().await.unwrap();
    let org = Uuid::now_v7();
    pg.execute(
        "INSERT INTO organizations(id,slug,name) VALUES($1,$2,'Synthetic equation proof')",
        &[&org, &org.to_string()],
    )
    .await
    .unwrap();
    pg.execute(
        "INSERT INTO team_rollouts(organization_id) VALUES($1)",
        &[&org],
    )
    .await
    .unwrap();
    let repo = TeamTrustRepository::new(pg.clone());
    let people = (1..=5).map(Uuid::from_u128).collect::<BTreeSet<_>>();
    let facts = (1..=10)
        .map(|n| format!("{n:064x}"))
        .collect::<BTreeSet<_>>();
    let equation = Equations {
        schema_version: 1,
        calculation_version: VERSION.into(),
        costs: BTreeMap::from([
            ("weekly_total".into(), facts.clone()),
            (
                "fully_priced_observed_numerator".into(),
                facts.iter().take(5).cloned().collect(),
            ),
        ]),
        counts: BTreeMap::from([(
            "fully_priced_observed_prs".into(),
            BTreeMap::from([(format!("{:064x}", 100), people.clone())]),
        )]),
    };
    let today = Utc::now().date_naive();
    let week = today - Duration::days(today.weekday().num_days_from_monday() as i64 + 7);
    let generation = repo.registry_entry(org).await.unwrap().generation;
    let publication = || CostPublication {
        org,
        week,
        key: "organization",
        generation,
        fingerprint: "original_v2",
        contributors: &people,
        facts: Some(&facts),
        equations: Some(&equation),
    };
    assert!(repo.release_cost_publication(publication()).await.unwrap());
    assert!(repo.release_cost_publication(publication()).await.unwrap());
    let stored: serde_json::Value = pg
        .query_one(
            "SELECT cost_equations FROM team_weekly_publications WHERE organization_id=$1",
            &[&org],
        )
        .await
        .unwrap()
        .get(0);
    assert_eq!(stored, serde_json::to_value(&equation).unwrap());
    let mut changed = equation.clone();
    changed
        .costs
        .insert("fully_priced_observed_numerator".into(), facts.clone());
    assert!(!repo
        .release_cost_publication(CostPublication {
            key: "different-average",
            equations: Some(&changed),
            ..publication()
        })
        .await
        .unwrap());
    assert_eq!(
        pg.query_one(
            "SELECT count(*) FROM team_weekly_publications WHERE organization_id=$1",
            &[&org]
        )
        .await
        .unwrap()
        .get::<_, i64>(0),
        1
    );
    // A legacy writer without equation support cannot introduce an overlapping
    // view in another week after the new exact numerator was already published.
    assert!(!repo
        .release(
            org,
            week + Duration::days(7),
            "legacy",
            generation,
            "legacy",
            &people
        )
        .await
        .unwrap());
    let root = std::env::temp_dir()
        .canonicalize()
        .unwrap()
        .join(format!("atoaxis-equation-restore-{}", Uuid::now_v7()));
    std::fs::create_dir(&root).unwrap();
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(&root, std::fs::Permissions::from_mode(0o700)).unwrap();
    }
    let path = root.join("privacy.json");
    std::fs::write(
        &path,
        serde_json::to_vec(&Registry {
            schema_version: 2,
            checked_at: Utc::now(),
            organizations: Default::default(),
            dispositions: vec![],
        })
        .unwrap(),
    )
    .unwrap();
    repo.export_registry(&path).await.unwrap();
    let original = std::fs::read(&path).unwrap();
    pg.execute(
        "UPDATE team_weekly_publications SET cost_equations=NULL WHERE organization_id=$1",
        &[&org],
    )
    .await
    .unwrap();
    assert!(repo.export_registry(&path).await.is_err());
    assert_eq!(std::fs::read(&path).unwrap(), original);
    std::fs::remove_dir_all(root).unwrap();
}
