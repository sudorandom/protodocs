default:
    @just --list

# Run playwright tests and generate screenshots
screenshots:
    npx playwright test
