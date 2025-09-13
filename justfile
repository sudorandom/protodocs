default:
    @just --list

# Run playwright tests and generate screenshots
playwright:
    npx playwright test

run:
    pnpm dev

lint:
    pnpm lint

descriptors:
    buf build buf.build/bufbuild/protovalidate \
        -o public/protovalidate.binpb \
        --path buf/validate
    buf build buf.build/googleapis/googleapis \
        -o public/googleapis.binpb \
        --exclude-path google/longrunning \
        --exclude-path google/geo/type \
        --exclude-path google/api/expr/v1alpha1 \
        --exclude-path google/api/expr/v1beta1 \
        --exclude-path google/rpc/context
    buf build buf.build/gnostic/gnostic \
        -o public/gnostic.binpb \
        --path gnostic/openapi/v3
