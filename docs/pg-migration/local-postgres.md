# Local Postgres for development

Start the database (the app itself still runs on the host with `bun run dev`):

```bash
bun run pg:up          # docker compose -f docker-compose.dev.yml up -d
bun run pg:down        # stop, keep data
bun run pg:reset       # stop and wipe the volumes
```

Connection strings — note the non-standard ports, chosen because a host
Postgres (Postgres.app) usually occupies 5432:

```
# development
DATABASE_URL="postgresql://mrms:mrms_dev_password@localhost:5433/mrms?schema=public"

# scratch, for import rehearsals
DATABASE_URL="postgresql://mrms:mrms_dev_password@localhost:5434/mrms_scratch?schema=public"
```

Check it is up:

```bash
psql "postgresql://mrms:mrms_dev_password@localhost:5433/mrms" -c "select version();"
```

The image is pinned to `postgres:18-alpine` to match the local `psql`/`pg_dump`
major version, so host-side dumps and restores against the container never hit
a version-mismatch refusal.
