package protodocs

import (
	"context"
	"fmt"
	"io/fs"
	"os"
	"os/exec"
	"path/filepath"

	"github.com/bufbuild/protocompile"
	"github.com/bufbuild/protocompile/protoutil"
	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/reflect/protoreflect"
	"google.golang.org/protobuf/types/descriptorpb"
)

// bufConfigFiles are the configuration files that mark a directory as a buf
// module or workspace root.
var bufConfigFiles = []string{"buf.yaml", "buf.work.yaml"}

// LoadDescriptorsFromPath loads a FileDescriptorSet from path. The path may
// be one of:
//
//   - a directory containing a buf.yaml or buf.work.yaml, built with the buf
//     CLI (which must be on the PATH)
//   - a directory of .proto files, compiled with the directory as the import
//     root
//   - a single .proto file, compiled with its directory as the import root
//   - a serialized FileDescriptorSet (e.g. produced by `buf build` or
//     `protoc -o`)
func LoadDescriptorsFromPath(ctx context.Context, path string) (*descriptorpb.FileDescriptorSet, error) {
	info, err := os.Stat(path)
	if err != nil {
		return nil, err
	}
	if info.IsDir() {
		for _, configName := range bufConfigFiles {
			if _, err := os.Stat(filepath.Join(path, configName)); err == nil {
				return buildDescriptorsWithBuf(ctx, path)
			}
		}
		return compileProtoDir(ctx, path)
	}
	if filepath.Ext(path) == ".proto" {
		return compileProtoFiles(ctx, filepath.Dir(path), []string{filepath.Base(path)})
	}
	return readDescriptorSetFile(path)
}

// buildDescriptorsWithBuf shells out to `buf build` in dir and returns the
// resulting FileDescriptorSet.
func buildDescriptorsWithBuf(ctx context.Context, dir string) (*descriptorpb.FileDescriptorSet, error) {
	bufPath, err := exec.LookPath("buf")
	if err != nil {
		return nil, fmt.Errorf("%s contains a buf config but the buf CLI was not found on the PATH (see https://buf.build/docs/installation): %w", dir, err)
	}
	tmpFile, err := os.CreateTemp("", "protodocs-*.binpb")
	if err != nil {
		return nil, fmt.Errorf("create temp file for buf build: %w", err)
	}
	tmpPath := tmpFile.Name()
	defer func() {
		_ = os.Remove(tmpPath)
	}()
	// Close the file so that buf can write to it.
	if err := tmpFile.Close(); err != nil {
		return nil, fmt.Errorf("close temp file: %w", err)
	}

	cmd := exec.CommandContext(ctx, bufPath, "build", "-o", tmpPath)
	cmd.Dir = dir
	if output, err := cmd.CombinedOutput(); err != nil {
		return nil, fmt.Errorf("buf build in %s: %w\n%s", dir, err, output)
	}
	return readDescriptorSetFile(tmpPath)
}

// compileProtoDir compiles every .proto file under root, using root as the
// import root.
func compileProtoDir(ctx context.Context, root string) (*descriptorpb.FileDescriptorSet, error) {
	var protoFiles []string
	err := fs.WalkDir(os.DirFS(root), ".", func(childPath string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if !d.IsDir() && filepath.Ext(childPath) == ".proto" {
			protoFiles = append(protoFiles, childPath)
		}
		return nil
	})
	if err != nil {
		return nil, fmt.Errorf("walk %s: %w", root, err)
	}
	if len(protoFiles) == 0 {
		return nil, fmt.Errorf("no .proto files or buf config found in %s", root)
	}
	return compileProtoFiles(ctx, root, protoFiles)
}

// compileProtoFiles compiles the named .proto files (relative to root) and
// returns a FileDescriptorSet that includes their transitive dependencies.
func compileProtoFiles(ctx context.Context, root string, names []string) (*descriptorpb.FileDescriptorSet, error) {
	compiler := protocompile.Compiler{
		Resolver: protocompile.WithStandardImports(&protocompile.SourceResolver{
			ImportPaths: []string{root},
		}),
		SourceInfoMode: protocompile.SourceInfoStandard,
	}
	compiled, err := compiler.Compile(ctx, names...)
	if err != nil {
		return nil, fmt.Errorf("compile protos in %s: %w", root, err)
	}

	descriptorSet := &descriptorpb.FileDescriptorSet{}
	seen := make(map[string]bool)
	var addFile func(fileDescriptor protoreflect.FileDescriptor)
	addFile = func(fileDescriptor protoreflect.FileDescriptor) {
		if seen[fileDescriptor.Path()] {
			return
		}
		seen[fileDescriptor.Path()] = true
		imports := fileDescriptor.Imports()
		for i := 0; i < imports.Len(); i++ {
			addFile(imports.Get(i).FileDescriptor)
		}
		descriptorSet.File = append(descriptorSet.File, protoutil.ProtoFromFileDescriptor(fileDescriptor))
	}
	for _, file := range compiled {
		addFile(file)
	}
	return descriptorSet, nil
}

// readDescriptorSetFile reads a serialized FileDescriptorSet from disk.
func readDescriptorSetFile(path string) (*descriptorpb.FileDescriptorSet, error) {
	fileBytes, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read descriptor file %s: %w", path, err)
	}
	descriptorSet := &descriptorpb.FileDescriptorSet{}
	if err := proto.Unmarshal(fileBytes, descriptorSet); err != nil {
		return nil, fmt.Errorf("parse descriptor file %s: %w", path, err)
	}
	return descriptorSet, nil
}
