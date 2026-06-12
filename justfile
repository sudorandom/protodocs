default:
    @just --list

# Run playwright tests and generate screenshots
playwright:
    npx playwright test

run:
    pnpm dev

# Build frontend and run the Go CLI backend (forwards arguments)
run-cli *args:
    pnpm build
    go run main.go {{args}}


lint: build
    pnpm lint
    golangci-lint run

test:
    pnpm test

build:
    pnpm run build

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
    buf build buf.build/connectrpc/eliza \
        -o public/eliza.binpb
    buf build buf.build/protocolbuffers/wellknowntypes \
        -o public/wellknowntypes.binpb
    pnpm exec buf generate buf.build/grpc/grpc --path grpc/reflection/v1alpha/reflection.proto --template buf.gen.yaml

# Build and package static website distribution
package:
    pnpm package

# Build Go CLI binaries for all required platforms
build-cli:
    pnpm build
    mkdir -p bin
    GOOS=linux GOARCH=amd64 go build -ldflags="-s -w" -o bin/protodocs-linux-amd64 .
    GOOS=linux GOARCH=arm64 go build -ldflags="-s -w" -o bin/protodocs-linux-arm64 .
    GOOS=darwin GOARCH=arm64 go build -ldflags="-s -w" -o bin/protodocs-darwin-arm64 .
    GOOS=windows GOARCH=amd64 go build -ldflags="-s -w" -o bin/protodocs-windows-amd64.exe .

