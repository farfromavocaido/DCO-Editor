# Preview outputs

Tracked packages for the GitHub Pages preview site:

| Path | Used by |
|---|---|
| `campaigns/<non-dco>/` | Pages **`/statics/`** — Export-for-Static HTML |
| `campaigns/sse-dco/` | ROI Canonical Agency Zip source tree |
| `campaigns/sse-dco-nir/` | NIR Canonical Agency Zip source tree (same creative, NIR Studio profile) |
| `downloads/SSE_Statics_*.zip` | Statics ZIP download (`campaigns/{slug}_{size}.zip` units) |
| `downloads/SSE_DCO_ROI_canonical_agency_*.zip` | ROI agency zip on the DCO client preview |
| `downloads/SSE_DCO_NIR_canonical_agency_*.zip` | NIR agency zip on the DCO client preview |
| `latest.json` | Manifest for statics shell + `dcoZip` (ROI) / `dcoZips` |

Populate via the editor toolbar action **Sync Zips**. Commit this folder when you want the hosted preview updated.
