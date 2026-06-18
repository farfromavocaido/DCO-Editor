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
