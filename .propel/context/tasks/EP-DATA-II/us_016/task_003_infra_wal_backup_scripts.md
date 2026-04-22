---
title: "Task — WAL PITR postgresql.conf, pg_basebackup Post-Start Script, 7-Day Cleanup Script, DR Documentation"
task_id: task_003
story_id: us_016
epic: EP-DATA-II
layer: Infrastructure
status: Not Started
date: 2026-04-21
---

# Task - task_003

## Requirement Reference
- User Story: [us_016] — PHI 6-Year Data Retention Policy & Automated Backup with WAL PITR
- Story Location: `.propel/context/tasks/EP-DATA-II/us_016/us_016.md`
- Acceptance Criteria:
  - AC-2: `postgresql.conf` with `wal_level = replica`, `archive_mode = on`, `archive_command = 'cp %p /var/lib/postgresql/wal_archive/%f'`; `SHOW wal_level` returns `replica`; WAL archive directory receives segment files within 5 minutes of DB start
  - AC-3: `post-start` script runs `pg_basebackup -D /var/lib/postgresql/backups/$(date +%Y%m%d) -Ft -z -P`; timestamped compressed backup directory created; integration test asserts directory exists and is non-empty within 60 seconds
  - AC-4: `/scripts/cleanup-old-backups.sh` removes backup directories older than 7 days by date prefix; `--dry-run` flag lists files without deleting; tested with synthetic dated directories
  - AC-5: `/docs/disaster-recovery.md` documents `pg_restore` + WAL replay procedure; CI step asserts row count match after PITR restore
- Edge Cases:
  - EC-1: WAL archive directory near disk quota → `archive_command` checks free space before archiving; logs `CRITICAL` warning to Serilog/Seq; disables WAL archiving via `ALTER SYSTEM SET archive_mode = 'off'` if free space < 500 MB

## Design References (Frontend Tasks Only)
| Reference Type | Value |
|----------------|-------|
| **UI Impact** | No |
| **Figma URL** | N/A |
| **Wireframe Status** | N/A |
| **Wireframe Type** | N/A |
| **Wireframe Path/URL** | N/A |
| **Screen Spec** | N/A |
| **UXR Requirements** | N/A |
| **Design Tokens** | N/A |

## Applicable Technology Stack
| Layer | Technology | Version |
|-------|------------|---------|
| Database | PostgreSQL | 16.x |
| Container | Docker Compose / devcontainer | v2 |
| Shell | Bash | 5.x |
| CI | GitHub Actions | N/A |
| AI/ML | N/A | N/A |
| Mobile | N/A | N/A |

## AI References (AI Tasks Only)
| Reference Type | Value |
|----------------|-------|
| **AI Impact** | No |
| **AIR Requirements** | N/A |
| **AI Pattern** | N/A |
| **Prompt Template Path** | N/A |
| **Guardrails Config** | N/A |
| **Model Provider** | N/A |

## Mobile References (Mobile Tasks Only)
| Reference Type | Value |
|----------------|-------|
| **Mobile Impact** | No |
| **Platform Target** | N/A |
| **Min OS Version** | N/A |
| **Mobile Framework** | N/A |

## Task Overview
Configure PostgreSQL WAL archiving in the devcontainer `postgresql.conf`, create a space-aware `archive_command` wrapper script, add a `pg_basebackup` call to the devcontainer `post-start` script, implement the 7-day backup cleanup script with `--dry-run` mode and file-locking, and write the `/docs/disaster-recovery.md` runbook. Wire the CI workflow to run a PITR smoke test (create data → take backup → insert more data → restore to pre-insert point → assert row count).

## Dependent Tasks
- `us_006 task_003_infra_ci_yml_load_baseline.md` — `/.github/workflows/ci.yml` must exist; the PITR CI step is added to this workflow

## Impacted Components
- `/.devcontainer/postgresql.conf` — CREATE (or MODIFY if exists): WAL archiving parameters
- `/scripts/wal-archive.sh` — CREATE: space-aware archive command wrapper (EC-1)
- `/.devcontainer/post-start.sh` — CREATE or MODIFY: add `pg_basebackup` daily backup call
- `/scripts/cleanup-old-backups.sh` — CREATE: 7-day cleanup with `--dry-run` and file-lock check
- `/docs/disaster-recovery.md` — CREATE: PITR runbook
- `/.github/workflows/ci.yml` — MODIFY: add `pitr-smoke-test` job

## Implementation Plan

1. **Create `/.devcontainer/postgresql.conf`** with WAL archiving parameters (AC-2):
   ```ini
   # WAL archiving configuration — DR-013
   # Enables point-in-time recovery (PITR) via WAL segment archiving

   wal_level = replica
   archive_mode = on
   # archive_command uses the space-aware wrapper script (see /scripts/wal-archive.sh)
   archive_command = '/scripts/wal-archive.sh %p %f'
   archive_timeout = 300           # Force WAL segment switch every 5 minutes (AC-2 verification)

   # Checkpointing — tuned for Codespaces (low memory)
   checkpoint_completion_target = 0.9
   max_wal_size = 256MB
   min_wal_size = 80MB
   ```
   Mount this file in `docker-compose.yml` (devcontainer):
   ```yaml
   volumes:
     - ./.devcontainer/postgresql.conf:/etc/postgresql/postgresql.conf:ro
   ```
   And reference it in the PostgreSQL container command:
   ```yaml
   command: postgres -c config_file=/etc/postgresql/postgresql.conf
   ```

2. **Create `/scripts/wal-archive.sh`** — space-aware WAL archive command (AC-2, EC-1):
   ```bash
   #!/usr/bin/env bash
   # /scripts/wal-archive.sh — space-aware WAL archiving wrapper
   # Usage: wal-archive.sh <source_path> <filename>
   # Called by postgresql.conf archive_command = '/scripts/wal-archive.sh %p %f'
   set -euo pipefail

   SOURCE_PATH="$1"
   FILENAME="$2"
   ARCHIVE_DIR="/var/lib/postgresql/wal_archive"
   MIN_FREE_MB=500

   # EC-1: check available disk space before archiving
   FREE_MB=$(df -m "$ARCHIVE_DIR" | awk 'NR==2 {print $4}')
   if [ "$FREE_MB" -lt "$MIN_FREE_MB" ]; then
       # Log critical warning — visible in docker logs and Seq syslog sink
       echo "CRITICAL: WAL archive disk space below ${MIN_FREE_MB}MB (free: ${FREE_MB}MB). Disabling archive_mode." >&2
       # Disable WAL archiving via ALTER SYSTEM to prevent PostgreSQL from halting
       psql -U "$POSTGRES_USER" -d postgres -c "ALTER SYSTEM SET archive_mode = 'off';" >&2
       psql -U "$POSTGRES_USER" -d postgres -c "SELECT pg_reload_conf();" >&2
       exit 1   # Non-zero exit signals PostgreSQL to retry or fail the archive (fail here = disable further archiving)
   fi

   mkdir -p "$ARCHIVE_DIR"
   cp "$SOURCE_PATH" "$ARCHIVE_DIR/$FILENAME"
   ```
   Make executable: `chmod +x /scripts/wal-archive.sh`

3. **Create/modify `/.devcontainer/post-start.sh`** — add `pg_basebackup` (AC-3):
   ```bash
   #!/usr/bin/env bash
   # /.devcontainer/post-start.sh
   set -euo pipefail

   BACKUP_ROOT="/var/lib/postgresql/backups"
   BACKUP_DIR="$BACKUP_ROOT/$(date +%Y%m%d)"

   # AC-3: create daily base backup on devcontainer start
   # -Ft: tar format, -z: gzip compressed, -P: progress reporting
   if [ ! -d "$BACKUP_DIR" ]; then
       echo "[post-start] Creating daily PostgreSQL base backup at $BACKUP_DIR..."
       mkdir -p "$BACKUP_DIR"
       pg_basebackup \
           -h localhost \
           -p 5432 \
           -U "$POSTGRES_USER" \
           -D "$BACKUP_DIR" \
           -Ft \
           -z \
           -P
       echo "[post-start] Base backup completed: $BACKUP_DIR"
   else
       echo "[post-start] Backup for today already exists at $BACKUP_DIR — skipping."
   fi

   # Run the 7-day cleanup (remove stale backups)
   /scripts/cleanup-old-backups.sh
   ```

4. **Create `/scripts/cleanup-old-backups.sh`** — 7-day retention with `--dry-run` and file-locking (AC-4):
   ```bash
   #!/usr/bin/env bash
   # /scripts/cleanup-old-backups.sh — Remove PostgreSQL base backups older than 7 days
   # Usage: cleanup-old-backups.sh [--dry-run]
   set -euo pipefail

   BACKUP_ROOT="/var/lib/postgresql/backups"
   RETENTION_DAYS=7
   DRY_RUN=false

   if [[ "${1:-}" == "--dry-run" ]]; then
       DRY_RUN=true
       echo "[cleanup] DRY RUN — no files will be deleted."
   fi

   # Find backup directories older than RETENTION_DAYS (name format: YYYYMMDD)
   CUTOFF_DATE=$(date -d "-${RETENTION_DAYS} days" +%Y%m%d)

   for backup_dir in "$BACKUP_ROOT"/*/; do
       dir_name=$(basename "$backup_dir")
       # Validate directory name is a date (8 digits)
       if [[ ! "$dir_name" =~ ^[0-9]{8}$ ]]; then
           continue
       fi
       if [ "$dir_name" -lt "$CUTOFF_DATE" ]; then
           lock_file="$backup_dir/.lock"
           # EC-3: check for active restore lock before deleting
           if [ -f "$lock_file" ]; then
               echo "[cleanup] WARNING: $backup_dir is locked (active restore in progress) — skipping."
               continue
           fi
           if [ "$DRY_RUN" = true ]; then
               echo "[cleanup] DRY RUN: would delete $backup_dir"
           else
               echo "[cleanup] Deleting stale backup: $backup_dir"
               rm -rf "$backup_dir"
           fi
       fi
   done

   echo "[cleanup] Done. Retention window: ${RETENTION_DAYS} days (cutoff: $CUTOFF_DATE)."
   ```
   Make executable: `chmod +x /scripts/cleanup-old-backups.sh`

5. **Create `/docs/disaster-recovery.md`** (AC-5) — PITR runbook:
   The file must document the following procedure (content summary for this task; actual file creation is the deliverable):
   - **Prerequisites**: PostgreSQL running with WAL archiving enabled; base backup and WAL archive directory available
   - **Step 1**: Stop the application servers (prevent new writes)
   - **Step 2**: Restore the base backup: `tar -xzf /var/lib/postgresql/backups/<YYYYMMDD>/base.tar.gz -C /var/lib/postgresql/data/`
   - **Step 3**: Create `recovery.conf` (PostgreSQL ≤ 12) or `postgresql.auto.conf` recovery parameters (PostgreSQL 13+):
     ```
     restore_command = 'cp /var/lib/postgresql/wal_archive/%f %p'
     recovery_target_time = '2026-04-21 14:30:00 UTC'
     recovery_target_action = 'promote'
     ```
   - **Step 4**: Create `recovery.signal` file in the data directory (PostgreSQL 13+)
   - **Step 5**: Start PostgreSQL — it replays WAL up to `recovery_target_time` then promotes
   - **Step 6**: Verify row counts match expected pre-failure state
   - **Rollback**: If restoration fails, restore from the next-most-recent base backup

6. **Add `pitr-smoke-test` job to `/.github/workflows/ci.yml`** (AC-5):
   ```yaml
   pitr-smoke-test:
     name: PITR Smoke Test
     runs-on: ubuntu-latest
     services:
       postgres:
         image: pgvector/pgvector:pg16
         env:
           POSTGRES_USER: devuser
           POSTGRES_PASSWORD: devpassword
           POSTGRES_DB: patientaccess_pitr
         ports: ["5434:5432"]
         options: >-
           --health-cmd pg_isready
           --health-interval 10s
           --health-timeout 5s
           --health-retries 5
     steps:
       - uses: actions/checkout@v4
       - name: Enable WAL archiving
         run: |
           docker exec ${{ job.services.postgres.id }} \
             psql -U devuser -d patientaccess_pitr -c \
             "ALTER SYSTEM SET wal_level = 'replica'; SELECT pg_reload_conf();"
       - name: Insert pre-backup test data
         run: |
           psql "postgresql://devuser:devpassword@localhost:5434/patientaccess_pitr" \
             -c "CREATE TABLE pitr_test (id SERIAL PRIMARY KEY, val TEXT); INSERT INTO pitr_test VALUES (DEFAULT, 'pre-backup-row');"
       - name: Take base backup
         run: |
           pg_basebackup -h localhost -p 5434 -U devuser \
             -D /tmp/pitr_backup -Ft -z -P
       - name: Note restore target timestamp
         id: timestamp
         run: echo "ts=$(date -u +%Y-%m-%dT%H:%M:%SZ)" >> "$GITHUB_OUTPUT"
       - name: Insert post-backup data (should NOT appear after restore)
         run: |
           psql "postgresql://devuser:devpassword@localhost:5434/patientaccess_pitr" \
             -c "INSERT INTO pitr_test VALUES (DEFAULT, 'post-backup-row');"
       - name: Restore to pre-insert timestamp and assert row count
         run: bash scripts/ci-pitr-restore-test.sh "${{ steps.timestamp.outputs.ts }}"
   ```
   The `scripts/ci-pitr-restore-test.sh` script restores the base backup, replays WAL to the timestamp, and asserts `SELECT COUNT(*) FROM pitr_test` returns 1 (only the pre-backup row).

## Current Project State
```
/.devcontainer/
├── devcontainer.json              # exists
├── docker-compose.yml             # exists
├── post-start.sh                  # WILL BE CREATED OR MODIFIED
└── postgresql.conf                # NOT YET CREATED — this task

/scripts/
├── wal-archive.sh                 # NOT YET CREATED — this task
├── cleanup-old-backups.sh         # NOT YET CREATED — this task
└── ci-pitr-restore-test.sh        # NOT YET CREATED — this task

/docs/
└── disaster-recovery.md           # NOT YET CREATED — this task
   (key-rotation-runbook.md        # us_007: exists)

/.github/workflows/
└── ci.yml                         # WILL BE MODIFIED — add pitr-smoke-test job
```

## Expected Changes
| Action | File Path | Description |
|--------|-----------|-------------|
| CREATE | `/.devcontainer/postgresql.conf` | `wal_level = replica`, `archive_mode = on`, `archive_command = '/scripts/wal-archive.sh %p %f'`, `archive_timeout = 300` |
| MODIFY | `/.devcontainer/docker-compose.yml` | Mount `postgresql.conf` as read-only volume; pass `-c config_file=...` to postgres command |
| CREATE | `/.devcontainer/post-start.sh` | `pg_basebackup -Ft -z -P` to `/var/lib/postgresql/backups/$(date +%Y%m%d)`; skip if today's backup exists; call cleanup script |
| CREATE | `/scripts/wal-archive.sh` | Space check (500 MB threshold); `cp %p /var/lib/postgresql/wal_archive/%f`; `ALTER SYSTEM SET archive_mode = 'off'` if threshold breached (EC-1) |
| CREATE | `/scripts/cleanup-old-backups.sh` | Remove backup directories with `YYYYMMDD` names older than 7 days; `--dry-run` flag; `.lock` file check before delete |
| CREATE | `/docs/disaster-recovery.md` | PITR runbook: stop app → restore base → create `recovery.signal` → replay WAL to timestamp → verify row counts |
| CREATE | `/scripts/ci-pitr-restore-test.sh` | CI helper: restore base backup to temp directory, configure WAL replay to target timestamp, start PostgreSQL, assert row count = 1 |
| MODIFY | `/.github/workflows/ci.yml` | Add `pitr-smoke-test` job with PostgreSQL service, WAL enable, backup, restore, and row-count assertion steps |

## External References
- `pg_basebackup` reference: https://www.postgresql.org/docs/current/app-pgbasebackup.html
- PostgreSQL WAL archiving (`archive_command`, `archive_mode`): https://www.postgresql.org/docs/current/continuous-archiving.html
- PostgreSQL PITR recovery with `recovery.signal` (PG 13+): https://www.postgresql.org/docs/current/recovery-config.html
- `ALTER SYSTEM SET` for runtime configuration changes: https://www.postgresql.org/docs/current/sql-altersystem.html
- DR-013: daily backup + 7-day retention + WAL PITR — `.propel/context/docs/design.md#DR-013`
- HIPAA 45 CFR § 164.310(d)(2)(iv) — data backup plan: https://www.hhs.gov/hipaa/for-professionals/security/laws-regulations/index.html

## Build Commands
```bash
# Verify WAL archiving is active (run inside devcontainer)
psql -U devuser -d patientaccess -c "SHOW wal_level;"
# Expected: replica

psql -U devuser -d patientaccess -c "SHOW archive_mode;"
# Expected: on

# Verify WAL archive directory receives files within 5 minutes
ls /var/lib/postgresql/wal_archive/
# Expected: one or more .gz WAL segment files

# Test backup script
bash /.devcontainer/post-start.sh
ls /var/lib/postgresql/backups/
# Expected: directory named today's date (YYYYMMDD)

# Test cleanup dry-run
bash /scripts/cleanup-old-backups.sh --dry-run
# Expected: lists stale directories (if any) without deleting

# CI — run PITR smoke test locally
bash scripts/ci-pitr-restore-test.sh "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
```

## Implementation Validation Strategy
- [ ] `SHOW wal_level` in psql returns `replica` after devcontainer start (AC-2)
- [ ] `SHOW archive_mode` returns `on` (AC-2)
- [ ] `/var/lib/postgresql/wal_archive/` contains at least one WAL file within 5 minutes of DB start (AC-2)
- [ ] `/.devcontainer/post-start.sh` creates a backup directory named `$(date +%Y%m%d)` containing `base.tar.gz` (AC-3)
- [ ] Running `post-start.sh` a second time in the same day does NOT create a duplicate backup (idempotent guard)
- [ ] `cleanup-old-backups.sh --dry-run` with synthetic `20200101` directory lists it as "would delete" without deleting (AC-4)
- [ ] `cleanup-old-backups.sh` with a locked backup directory (`touch <dir>/.lock`) skips it and logs warning (AC-4 EC-3)
- [ ] `wal-archive.sh` with a simulated low-disk-space condition logs `CRITICAL` and calls `ALTER SYSTEM SET archive_mode = 'off'` (EC-1)
- [ ] CI `pitr-smoke-test` job passes: restores to pre-insert timestamp; `SELECT COUNT(*) FROM pitr_test` returns 1 (AC-5)

## Implementation Checklist
- [ ] Create `/.devcontainer/postgresql.conf` with `wal_level = replica`, `archive_mode = on`, `archive_command = '/scripts/wal-archive.sh %p %f'`, `archive_timeout = 300`
- [ ] Modify `/.devcontainer/docker-compose.yml`: mount `postgresql.conf` as volume; add `-c config_file=/etc/postgresql/postgresql.conf` to postgres command
- [ ] Create `/scripts/wal-archive.sh`: check free space ≥ 500 MB; `cp %p /var/lib/postgresql/wal_archive/%f`; `ALTER SYSTEM SET archive_mode = 'off'` + `pg_reload_conf()` if below threshold; `chmod +x`
- [ ] Create `/.devcontainer/post-start.sh`: `pg_basebackup -Ft -z -P`; idempotent today-check; call cleanup script; `chmod +x`
- [ ] Create `/scripts/cleanup-old-backups.sh`: iterate `YYYYMMDD` directories; compare to `CUTOFF_DATE`; `.lock` check; `--dry-run` mode; `chmod +x`
- [ ] Create `/docs/disaster-recovery.md` with complete 6-step PITR restore procedure referencing `recovery.signal` and `restore_command`
- [ ] Create `/scripts/ci-pitr-restore-test.sh` CI helper script
- [ ] Add `pitr-smoke-test` job to `/.github/workflows/ci.yml` with PostgreSQL service, WAL enable, backup, restore, and assertion steps
