# Cloudflare Pages

This folder is a Cloudflare Pages–ready copy of the designer app.

## Pages settings

- Framework preset: Vite (or React)
- Root directory: `/`
- Build command: `npm run build`
- Build output directory: `dist`

## Notes

- Client-side routing refreshes are handled via `javaAssets/_redirects` (it is copied into `dist/_redirects` during the Vite build).
- `VITE_GA_MEASUREMENT_ID` is optional. If you don't set it, analytics is skipped.
- This repo is intended to be deployed as a Pages site (no separate deploy command needed in the Pages web UI).
