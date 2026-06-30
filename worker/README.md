# Matzmihim Registration API

Cloudflare Worker API for the registration forms and admin UI.

## Required Airtable table

Create a `Form Config` table and set its table id as `FORM_CONFIG_TABLE_ID`.

Fields:

- `key` - single line text
- `label` - single line text
- `airtableField` - single line text
- `inputType` - single line text
- `required` - checkbox
- `visible` - checkbox
- `order` - number
- `options` - long text, JSON array string
- `appliesTo` - long text, JSON array string
- `system` - checkbox
- `placeholder` - single line text

## Worker secrets

```bash
wrangler secret put AIRTABLE_TOKEN
wrangler secret put AIRTABLE_BASE
wrangler secret put FORM_CONFIG_TABLE_ID
wrangler secret put ADMIN_PASSWORD_HASH
wrangler secret put SESSION_SECRET
wrangler secret put BUBBLE_URL
wrangler secret put BUBBLE_TOKEN
```

`ADMIN_PASSWORD_HASH` can be plain text for temporary testing, or `sha256:<hex>`.

## GitHub Pages config

Set the repository variable `API_BASE_URL` to the deployed Worker URL, for example:

```text
https://matzmihim-registration-api.example.workers.dev
```
