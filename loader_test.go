package protodocs

import (
	"context"
	"os"
	"os/exec"
	"path/filepath"
	"testing"

	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/types/descriptorpb"
)

const testProtoSource = `syntax = "proto3";

package test.v1;

import "google/protobuf/timestamp.proto";

// Widget is a test message.
message Widget {
  string name = 1;
  google.protobuf.Timestamp created_at = 2;
}
`

func writeTestProto(t *testing.T, dir string) string {
	t.Helper()
	protoPath := filepath.Join(dir, "widget.proto")
	if err := os.WriteFile(protoPath, []byte(testProtoSource), 0o600); err != nil {
		t.Fatalf("failed to write proto file: %v", err)
	}
	return protoPath
}

func descriptorSetFileNames(fds *descriptorpb.FileDescriptorSet) map[string]bool {
	names := make(map[string]bool, len(fds.File))
	for _, file := range fds.File {
		names[file.GetName()] = true
	}
	return names
}

func TestLoadDescriptorsFromPath_DescriptorSetFile(t *testing.T) {
	original := &descriptorpb.FileDescriptorSet{
		File: []*descriptorpb.FileDescriptorProto{
			{Name: proto.String("test/v1/widget.proto"), Syntax: proto.String("proto3")},
		},
	}
	setBytes, err := proto.Marshal(original)
	if err != nil {
		t.Fatalf("failed to marshal descriptor set: %v", err)
	}
	setPath := filepath.Join(t.TempDir(), "test.binpb")
	if err := os.WriteFile(setPath, setBytes, 0o600); err != nil {
		t.Fatalf("failed to write descriptor set file: %v", err)
	}

	loaded, err := LoadDescriptorsFromPath(context.Background(), setPath)
	if err != nil {
		t.Fatalf("failed to load descriptor set file: %v", err)
	}
	if len(loaded.File) != 1 || loaded.File[0].GetName() != "test/v1/widget.proto" {
		t.Errorf("unexpected descriptor set contents: %v", loaded.File)
	}
}

func TestLoadDescriptorsFromPath_SingleProtoFile(t *testing.T) {
	protoPath := writeTestProto(t, t.TempDir())

	loaded, err := LoadDescriptorsFromPath(context.Background(), protoPath)
	if err != nil {
		t.Fatalf("failed to load proto file: %v", err)
	}
	names := descriptorSetFileNames(loaded)
	if !names["widget.proto"] {
		t.Errorf("expected widget.proto in descriptor set, got %v", names)
	}
	if !names["google/protobuf/timestamp.proto"] {
		t.Errorf("expected transitive import google/protobuf/timestamp.proto in descriptor set, got %v", names)
	}
}

func TestLoadDescriptorsFromPath_ProtoDirectory(t *testing.T) {
	dir := t.TempDir()
	nestedDir := filepath.Join(dir, "test", "v1")
	if err := os.MkdirAll(nestedDir, 0o750); err != nil {
		t.Fatalf("failed to create nested dir: %v", err)
	}
	writeTestProto(t, nestedDir)

	loaded, err := LoadDescriptorsFromPath(context.Background(), dir)
	if err != nil {
		t.Fatalf("failed to load proto directory: %v", err)
	}
	names := descriptorSetFileNames(loaded)
	if !names["test/v1/widget.proto"] {
		t.Errorf("expected test/v1/widget.proto in descriptor set, got %v", names)
	}
}

func TestLoadDescriptorsFromPath_EmptyDirectory(t *testing.T) {
	_, err := LoadDescriptorsFromPath(context.Background(), t.TempDir())
	if err == nil {
		t.Fatal("expected an error for a directory with no protos or buf config")
	}
}

func TestLoadDescriptorsFromPath_BufModule(t *testing.T) {
	if _, err := exec.LookPath("buf"); err != nil {
		t.Skip("buf CLI not found on PATH")
	}

	dir := t.TempDir()
	bufYaml := "version: v2\nmodules:\n  - path: .\n"
	if err := os.WriteFile(filepath.Join(dir, "buf.yaml"), []byte(bufYaml), 0o600); err != nil {
		t.Fatalf("failed to write buf.yaml: %v", err)
	}
	nestedDir := filepath.Join(dir, "test", "v1")
	if err := os.MkdirAll(nestedDir, 0o750); err != nil {
		t.Fatalf("failed to create nested dir: %v", err)
	}
	writeTestProto(t, nestedDir)

	loaded, err := LoadDescriptorsFromPath(context.Background(), dir)
	if err != nil {
		t.Fatalf("failed to load buf module: %v", err)
	}
	names := descriptorSetFileNames(loaded)
	if !names["test/v1/widget.proto"] {
		t.Errorf("expected test/v1/widget.proto in descriptor set, got %v", names)
	}
}
