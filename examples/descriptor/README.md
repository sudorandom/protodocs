# Go Library Descriptor File Example

This directory contains a self-contained example of embedding ProtoDocs into a Go application using a pre-compiled protobuf descriptor file (`.binpb`).

## Why use Descriptor Files instead of Go's built-in registry?

When you generate Go code using the standard `protoc-gen-go` plugin, **comments are stripped** from the generated Go types. As a result, if you only import the compiled Go packages and document them using Go's registry (`protoregistry.GlobalFiles`), you will lose rich comments and documentation on your messages, fields, and services in the web UI.

Generating and embedding a descriptor file (`.binpb` / `.pb`) preserves all source code comments and metadata, giving the UI full access to all your inline documentation.

## How to generate a descriptor file with comments

You can compile a descriptor file containing all comments using `buf` or `protoc`:

### 1. Using Buf (Recommended)

Run `buf build` with the `-o` or `--as-file-descriptor-set` flag. By default, `buf` preserves all source code comments:

```sh
buf build -o eliza.binpb
```

### 2. Using protoc

Run `protoc` with the `--descriptor_set_out` flag and include imports:

```sh
protoc --include_imports --descriptor_set_out=eliza.binpb your_file.proto
```

## How to Run

1. Run the main server:
   ```sh
   go run main.go
   ```

2. Open your browser and navigate to:
   [http://localhost:8080/docs/](http://localhost:8080/docs/)
