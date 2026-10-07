# Releasing

npm releases come only from `publish.yml`, on a `vX.Y.Z` tag: n8n verifies community nodes only when they are published from GitHub Actions with an npm provenance statement, and `prepublishOnly` refuses a publish from anywhere else.

## Secrets (repo `datalegion-ai/datalegion-n8n`)

| Secret | What | Used by |
| --- | --- | --- |
| `DATALEGION_API_KEY` | Internal test key, the same one the SDK repos test with | `test.yml` and `publish.yml` live tests |
| `NPM_TOKEN` | Only until the trusted publisher is set (below), then deleted | `publish.yml` |

## First release (once)

1. npm needs the package to exist before a trusted publisher can be added, so the first publish uses a token: on npmjs.com, as the account that publishes the Data Legion SDKs, create a Granular Access Token with read and write publish access, and save it as the repo secret `NPM_TOKEN`.
2. Tag and push (below). Check `npm view n8n-nodes-datalegion` and the provenance badge on the npm page.
3. On npmjs.com, package settings > Trusted Publisher: GitHub Actions, owner `datalegion-ai`, repository `datalegion-n8n`, workflow `publish.yml`. Then delete the `NPM_TOKEN` secret and revoke the token.
4. Submit the package for verification in the [n8n Creator Portal](https://creators.n8n.io/nodes). Verified, it shows in the nodes panel on n8n Cloud.

## Every release

1. In a PR, bump `version` in `package.json` (patch for fixes, minor for new operations or fields) and run `npm install` so `package-lock.json` matches. Merge.
2. Tag the merge commit: `git tag vX.Y.Z && git push origin vX.Y.Z`. `publish.yml` checks the tag matches `package.json`, runs the tests, then lints, builds and publishes with provenance.

A published version can't be replaced; fix forward with a new version.
