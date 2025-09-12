default:
    @just --list

# Run playwright tests and generate screenshots
playwright:
    npx playwright test

run:
    npm run dev

descriptors:
    buf build buf.build/bufbuild/protovalidate -o public/protovalidate.binpb
    buf build buf.build/googleapis/googleapis -o public/googleapis.binpb
    buf build buf.build/gnostic/gnostic -o public/gnostic.binpb
