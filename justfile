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
    go run ./cmd/protodocs {{args}}

# Run the desktop application in Wails development mode (supports live-reload)
desktop-dev:
    cd desktop && go tool wails dev

# Build the production native desktop application bundle
desktop-build:
    node scripts/sync-version.mjs
    cd desktop && go tool wails build -ldflags="-s -w" -trimpath

# Build the macOS DMG installer from a local desktop build
desktop-dmg: desktop-build
    scripts/create-macos-dmg.sh desktop/build/bin/ProtoDocs.app protodocs-desktop-darwin.dmg

lint: build
    pnpm check
    golangci-lint run

# Format TS and Go source code
fmt:
    go fmt ./...
    pnpm exec eslint . --fix

test:
    pnpm test
    go test -v ./...

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
    buf build buf.build/connectrpc/eliza \
        -o public/eliza.binpb
    buf build buf.build/protocolbuffers/wellknowntypes \
        -o public/wellknowntypes.binpb
    buf build proto -o public/config.binpb
    pnpm exec buf generate buf.build/grpc/grpc --path grpc/reflection/v1alpha/reflection.proto --template buf.gen.yaml

# Build and package static website distribution
package:
    pnpm package

# Build Go CLI binaries for all required platforms
build-cli:
    pnpm build
    mkdir -p bin
    GOOS=linux GOARCH=amd64 go build -ldflags="-s -w" -o bin/protodocs-cli-linux-amd64 ./cmd/protodocs
    GOOS=linux GOARCH=arm64 go build -ldflags="-s -w" -o bin/protodocs-cli-linux-arm64 ./cmd/protodocs
    GOOS=darwin GOARCH=amd64 go build -ldflags="-s -w" -o bin/protodocs-cli-darwin-amd64 ./cmd/protodocs
    GOOS=darwin GOARCH=arm64 go build -ldflags="-s -w" -o bin/protodocs-cli-darwin-arm64 ./cmd/protodocs
    GOOS=windows GOARCH=amd64 go build -ldflags="-s -w" -o bin/protodocs-cli-windows-amd64.exe ./cmd/protodocs
