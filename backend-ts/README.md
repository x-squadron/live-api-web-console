# Faktions Summary Service (TypeScript)

This service accepts meeting payloads, responds 202 immediately, then uses a LangGraph React agent with Composio Slack tool to generate a concise summary and post it to Slack.

## Endpoint

- POST `/api/multi-swarm/process-transcript-workflow`
  - Validates payload (schema below)
  - Responds `202` immediately
  - Processes in background via agent: summarize transcript → call Slack tool

## Expected Payload

```json
{
  "id": 14,
  "user_id": 2,
  "platform": "google_meet",
  "native_meeting_id": "auk-abc-xyz",
  "constructed_meeting_url": "https://meet.google.com/auk-abc-xyz",
  "status": "completed",
  "bot_container_id": "3ee0a866ca1016c301e0ada2c7aa524f1fd6326870261342f1e9b8421fcab0c2",
  "connection_id": "d6a59f0f-82ee-423c-ab07-738993ca5343",
  "start_time": "2025-09-06T14:58:51.630679",
  "end_time": "2025-09-06T14:59:40.633322",
  "data": {},
  "created_at": "2025-09-06T14:58:51.407754",
  "updated_at": "2025-09-06T14:59:40.629979",
  "text": "... transcript ...",
  "transcript_generated_at": "2025-09-15T12:26:26.135837"
}
```

## Environment

Create a `.env` file:

```
PORT=5050
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
COMPOSIO_API_KEY=cmp-...
COMPOSIO_ENTITY_ID=default_user
SLACK_DEFAULT_CHANNEL=C08KCHMGZV3
```

## Install & Run

```bash
npm install --prefix new-backend-ts
npm run dev --prefix new-backend-ts
```

Build & start:

```bash
npm run build --prefix new-backend-ts
npm start --prefix new-backend-ts
```

## Notes

- Agent sends Slack via Composio; ensure `COMPOSIO_API_KEY` is set.
- No-ops if `text` is empty.
- Slack message includes meeting ID, URL, and concise action bullets + summary.
