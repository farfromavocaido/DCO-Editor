# SSE DCO Editor

default:
    @just --list

# Start the Next.js creative editor
editor port="5174":
    npm run dev -- -p {{port}}

# Run editor tests
test:
    npm test

# Production build
build:
    npm run build

# Export static client preview site for GitHub Pages
export-preview-site:
    npm run export:preview-site

# Build and serve the client preview locally (same static site as GitHub Pages)
preview port="4173":
    npm run export:preview-site
    @echo "Client preview: http://127.0.0.1:{{port}} (password: ssedco)"
    python3 -m http.server {{port}} --directory site
