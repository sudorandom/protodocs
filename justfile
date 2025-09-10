default:
    @just --list

# Run playwright tests and generate screenshots
playwright:
    npx playwright test

run:
    npm run dev
