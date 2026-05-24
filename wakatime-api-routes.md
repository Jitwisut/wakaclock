# WakaTime API v1 — All Routes

Base URL: `https://api.wakatime.com/api/v1/` or `https://wakatime.com/api/v1/`

---

## Documented API Routes (from /developers)

### Users / Current User
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/v1/users/:user` | Get user info |
| GET | `/api/v1/users/current` | Get current authenticated user |

### All Time Since Today
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/v1/users/:user/all_time_since_today` | Total coding time since account creation |
| GET | `/api/v1/users/current/all_time_since_today` | (current user variant) |

### Commits
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/v1/users/:user/projects/:project/commits` | List commits for a project |
| GET | `/api/v1/users/current/projects/:project/commits` | (current user variant) |
| GET | `/api/v1/users/:user/projects/:project/commits/:hash` | Get a single commit |
| GET | `/api/v1/users/current/projects/:project/commits/:hash` | (current user variant) |

### Custom Rules
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/v1/users/:user/custom_rules` | List custom rules |
| GET | `/api/v1/users/current/custom_rules` | (current user variant) |
| PUT | `/api/v1/users/:user/custom_rules` | Create/update custom rule |
| PUT | `/api/v1/users/current/custom_rules` | (current user variant) |
| DELETE | `/api/v1/users/:user/custom_rules/:rule_id` | Delete a custom rule |
| DELETE | `/api/v1/users/current/custom_rules/:rule_id` | (current user variant) |

### Custom Rules Progress
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/v1/users/:user/custom_rules_progress` | Get custom rules progress |
| GET | `/api/v1/users/current/custom_rules_progress` | (current user variant) |
| DELETE | `/api/v1/users/:user/custom_rules_progress` | Delete custom rules progress |
| DELETE | `/api/v1/users/current/custom_rules_progress` | (current user variant) |

### Data Dumps
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/v1/users/:user/data_dumps` | List data dumps |
| GET | `/api/v1/users/current/data_dumps` | (current user variant) |
| POST | `/api/v1/users/:user/data_dumps` | Request a data dump |
| POST | `/api/v1/users/current/data_dumps` | (current user variant) |

### Durations
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/v1/users/:user/durations` | Get durations for a day |
| GET | `/api/v1/users/current/durations` | (current user variant) |

### Editors
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/v1/editors` | List supported editors/IDEs |

### External Durations
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/v1/users/:user/external_durations` | List external durations |
| GET | `/api/v1/users/current/external_durations` | (current user variant) |
| POST | `/api/v1/users/:user/external_durations` | Create external duration |
| POST | `/api/v1/users/current/external_durations` | (current user variant) |
| POST | `/api/v1/users/:user/external_durations.bulk` | Bulk create external durations |
| POST | `/api/v1/users/current/external_durations.bulk` | (current user variant) |
| DELETE | `/api/v1/users/:user/external_durations.bulk` | Bulk delete external durations |
| DELETE | `/api/v1/users/current/external_durations.bulk` | (current user variant) |

### Goals
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/v1/users/:user/goals` | List goals |
| GET | `/api/v1/users/current/goals` | (current user variant) |
| GET | `/api/v1/users/:user/goals/:goal` | Get a single goal |
| GET | `/api/v1/users/current/goals/:goal` | (current user variant) |

### Heartbeats
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/v1/users/:user/heartbeats` | List heartbeats for a day |
| GET | `/api/v1/users/current/heartbeats` | (current user variant) |
| POST | `/api/v1/users/:user/heartbeats` | Create a heartbeat |
| POST | `/api/v1/users/current/heartbeats` | (current user variant) |
| POST | `/api/v1/users/:user/heartbeats.bulk` | Bulk create heartbeats |
| POST | `/api/v1/users/current/heartbeats.bulk` | (current user variant) |
| DELETE | `/api/v1/users/:user/heartbeats.bulk` | Bulk delete heartbeats |
| DELETE | `/api/v1/users/current/heartbeats.bulk` | (current user variant) |

### Insights
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/v1/users/:user/insights/:insight_type/:range` | Get insight data |
| GET | `/api/v1/users/current/insights/:insight_type/:range` | (current user variant) |

**Insight types:** `weekdays`, `days`, `languages`, `projects`, `operating_systems`, `best_day`, `daily_average`, `stats`
**Ranges:** `last_year`, `last_6_months`, `last_month`, etc.

### Leaders
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/v1/leaders` | Public leaderboard |

### Machine Names
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/v1/users/:user/machine_names` | List machine names |
| GET | `/api/v1/users/current/machine_names` | (current user variant) |

### Meta
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/v1/meta` | API metadata (IP ranges, etc.) |

### Org Custom Rules
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/v1/users/:user/orgs/:org/custom_rules` | List org custom rules |
| GET | `/api/v1/users/current/orgs/:org/custom_rules` | (current user variant) |
| PUT | `/api/v1/users/:user/orgs/:org/custom_rules` | Create/update org custom rule |
| PUT | `/api/v1/users/current/orgs/:org/custom_rules` | (current user variant) |

### Org Dashboards
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/v1/users/:user/orgs/:org/dashboards` | List org dashboards |
| GET | `/api/v1/users/current/orgs/:org/dashboards` | (current user variant) |
| GET | `/api/v1/users/:user/orgs/:org/dashboards/:dashboard/durations` | Org dashboard durations |
| GET | `/api/v1/users/current/orgs/:orgs/dashboards/:dashboard/durations` | (current user variant) |
| GET | `/api/v1/users/:user/orgs/:org/dashboards/:dashboard/members` | Org dashboard members |
| GET | `/api/v1/users/current/orgs/:org/dashboards/:dashboard/members` | (current user variant) |
| GET | `/api/v1/users/:user/orgs/:org/dashboards/:dashboard/members/:member/durations` | Member durations |
| GET | `/api/v1/users/current/orgs/:orgs/dashboards/:dashboard/members/:member/durations` | (current user variant) |
| GET | `/api/v1/users/:user/orgs/:org/dashboards/:dashboard/members/:member/summaries` | Member summaries |
| GET | `/api/v1/users/current/orgs/:org/dashboards/:dashboard/members/:member/summaries` | (current user variant) |
| GET | `/api/v1/users/:user/orgs/:org/dashboards/:dashboard/summaries` | Org dashboard summaries |
| GET | `/api/v1/users/current/orgs/:org/dashboards/:dashboard/summaries` | (current user variant) |

### Orgs
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/v1/users/:user/orgs` | List organizations |
| GET | `/api/v1/users/current/orgs` | (current user variant) |

### Private Leaderboards
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/v1/users/:user/leaderboards` | List private leaderboards |
| GET | `/api/v1/users/current/leaderboards` | (current user variant) |
| GET | `/api/v1/users/:user/leaderboards/:board` | Get a private leaderboard |
| GET | `/api/v1/users/current/leaderboards/:board` | (current user variant) |

### Program Languages
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/v1/program_languages` | List supported languages |

### Projects
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/v1/users/:user/projects` | List projects |
| GET | `/api/v1/users/current/projects` | (current user variant) |

### Stats
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/v1/users/:user/stats` | Get user stats (default range) |
| GET | `/api/v1/users/current/stats` | (current user variant) |
| GET | `/api/v1/users/:user/stats/:range` | Get user stats for range |
| GET | `/api/v1/users/current/stats/:range` | (current user variant) |
| GET | `/api/v1/stats/:range` | Aggregated public stats |

### Status Bar
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/v1/users/:user/status_bar/today` | Status bar data for today |
| GET | `/api/v1/users/current/status_bar/today` | (current user variant) |

### Summaries
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/v1/users/:user/summaries` | Get coding summaries for a date range |
| GET | `/api/v1/users/current/summaries` | (current user variant) |

### User Agents
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/v1/users/:user/user_agents` | List user agents (IDE plugins) |
| GET | `/api/v1/users/current/user_agents` | (current user variant) |

---

## Undocumented / Internal Routes (discovered via network traffic)

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/v1/users/current/ev` | Event tracking (mouse moves, page views) |
| POST | `/api/v1/metrics/timing` | Page render timing metrics |
| GET | `/api/v1/users/current/alerts/latest` | Get latest user alerts |
| POST | `/api/v1/exf` | External tracking (pre-login) |
| GET | `/api/v1/users/current/durations?date=YYYY-MM-DD&paywalled=true` | Durations with paywall flag |
| GET | `/api/v1/users/current/projects?q=&page=1` | Projects with search/pagination |
| GET | `/api/v1/users/current/insights/weekdays/last_year?paywalled=true` | Insights weekdays |
| GET | `/api/v1/users/current/insights/days/last_year?paywalled=true` | Insights days |
| GET | `/api/v1/users/current/insights/languages/last_year?paywalled=true` | Insights languages |
| GET | `/api/v1/users/current/insights/projects/last_year?paywalled=true` | Insights projects |
| GET | `/api/v1/users/current/insights/operating_systems/last_year?paywalled=true` | Insights OS |
| GET | `/api/v1/users/current/insights/best_day/last_year?paywalled=true` | Insights best day |
| GET | `/api/v1/users/current/insights/daily_average/last_year?paywalled=true` | Insights daily avg |
| GET | `/api/v1/users/current/insights/stats/last_year?paywalled=true` | Insights stats |
| GET | `/api/v1/users/current/goals?today=YYYY-MM-DD` | Goals with today date |
