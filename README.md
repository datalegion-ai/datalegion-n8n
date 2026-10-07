# n8n-nodes-datalegion

The [Data Legion](https://www.datalegion.ai) node for [n8n](https://n8n.io). Enrich people and companies with Data Legion's data, and clean, hash and validate contact data before you do.

Each n8n user connects their own Data Legion API key; what they get back and what they pay for come from their own account.

## Installation

On n8n Cloud and self-hosted n8n, search for **Data Legion** in the nodes panel once the node is verified. On self-hosted n8n you can also install it by name, `n8n-nodes-datalegion`, from **Settings > Community Nodes** ([n8n's guide](https://docs.n8n.io/integrations/community-nodes/installation/)).

## Operations

| Resource | Operation | Endpoint | Billed |
| --- | --- | --- | --- |
| Person | Enrich | `POST /person/enrich` | Yes, per your contract; no match is free |
| Company | Enrich | `POST /company/enrich` | Yes, per your contract; no match is free |
| Utility | Clean Data | `POST /utility/clean` | Free |
| Utility | Hash Email | `POST /utility/hash/email` | Free |
| Utility | Validate Data | `POST /utility/validate` | Free |

**Enrich** looks up one record per input item, by any identifiers you add (email, phone, social profile URL, or a name plus one more detail for a person; domain, name, social profile URL or ticker for a company). A match comes out as the full profile with `matched: true` and `match_metadata`; no match comes out as `{ "matched": false }`, so a list keeps every row. Options: **Minimum Match Confidence** and **Required Fields** (a match without them counts as no match).

The node can also be used as a tool by n8n's AI Agent.

## Credentials

Create an API key under [API Keys](https://www.datalegion.ai/dashboard/api-keys) in the Data Legion dashboard, then add a **Data Legion API** credential in n8n and paste it in. n8n checks the key against `GET /credits`, which is free.

## Errors

The node shows the API's own error message. Out of credits (402) and an endpoint the key is not scoped to (403) say so; for rate limits (429), turn on **Retry On Fail** in the node settings. With **On Error: Continue**, a failed item comes out as `{ "error": "..." }` and the rest of the items go on.

## Compatibility

Tested with n8n 2.42.

## Resources

- [Data Legion API documentation](https://www.datalegion.ai/docs/introduction)
- [n8n community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)

## Development

```bash
npm ci
npx lefthook install          # git hooks: lint before commit, typecheck before push
npm run lint && npm run typecheck && npm run build
DATALEGION_API_KEY=... npm test   # unit (mocked) + live tests against the production API
```

Releasing: [DEPLOY.md](DEPLOY.md).
