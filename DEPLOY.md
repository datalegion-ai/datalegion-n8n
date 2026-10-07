# Releasing

npm releases come only from `publish.yml`, on a `vX.Y.Z` tag: n8n verifies community nodes only when they are published from GitHub Actions with an npm provenance statement, and `prepublishOnly` refuses a publish from anywhere else.

## Who can publish

- **npm:** Trusted Publishing only. The package trusts `datalegion-ai/datalegion-n8n`, workflow `publish.yml`, environment `npm`, and refuses token publishes ("Require two-factor authentication and disallow bypass 2fa tokens" in the package settings). There is no npm token anywhere.
- **GitHub:** the `npm` environment deploys only from `v*.*.*` tags, and only repository admins can create, move or delete `v*` tags. Both live in datalegion-infra `stacks/github` (environments.tf, rulesets.tf); change them there.
- **Secrets:** only `DATALEGION_API_KEY` (internal test key, as in the SDK repos), for the live tests in `test.yml` and `publish.yml`. Pull requests from forks never receive it.

## Verification on n8n Cloud

Submit the package in the [n8n Creator Portal](https://creators.n8n.io/nodes). Once verified it shows in the nodes panel on n8n Cloud.

## Every release

1. In a PR, bump `version` in `package.json` (patch for fixes, minor for new operations or fields) and run `npm install` so `package-lock.json` matches. Merge.
2. Tag the merge commit as a repository admin: `git tag vX.Y.Z && git push origin vX.Y.Z`. `publish.yml` checks the tag matches `package.json`, runs the tests, then lints, builds and publishes with provenance.

A published version can't be replaced; fix forward with a new version.
