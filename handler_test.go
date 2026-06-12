package protodocs

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/reflect/protodesc"
	"google.golang.org/protobuf/reflect/protoregistry"
	"google.golang.org/protobuf/types/descriptorpb"
	"gopkg.in/yaml.v3"
)

func TestNewHandler_Default(t *testing.T) {
	handler, err := NewHandler(Config{})
	if err != nil {
		t.Fatalf("failed to create handler: %v", err)
	}

	ts := httptest.NewServer(handler)
	defer ts.Close()

	// 1. Get /config.yaml
	res, err := http.Get(ts.URL + "/config.yaml")
	if err != nil {
		t.Fatalf("failed to get config.yaml: %v", err)
	}
	defer func() { _ = res.Body.Close() }()

	if res.StatusCode != http.StatusOK {
		t.Errorf("expected status 200, got %d", res.StatusCode)
	}

	var appCfg AppConfig
	if err := yaml.NewDecoder(res.Body).Decode(&appCfg); err != nil {
		t.Fatalf("failed to decode config.yaml: %v", err)
	}

	// Default config should contain default descriptor files
	if len(appCfg.DescriptorFiles) == 0 {
		t.Error("expected default descriptor files, got none")
	}

	// 2. Get /index.html
	resHtml, err := http.Get(ts.URL + "/index.html")
	if err != nil {
		t.Fatalf("failed to get index.html: %v", err)
	}
	defer func() { _ = resHtml.Body.Close() }()

	if resHtml.StatusCode != http.StatusOK {
		t.Errorf("expected status 200, got %d", resHtml.StatusCode)
	}

	// 3. Get /robots.txt
	resRobots, err := http.Get(ts.URL + "/robots.txt")
	if err != nil {
		t.Fatalf("failed to get robots.txt: %v", err)
	}
	defer func() { _ = resRobots.Body.Close() }()

	if resRobots.StatusCode != http.StatusOK {
		t.Errorf("expected status 200 for robots.txt, got %d", resRobots.StatusCode)
	}

	robotsBytes, err := io.ReadAll(resRobots.Body)
	if err != nil {
		t.Fatalf("failed to read robots.txt body: %v", err)
	}
	if !strings.Contains(string(robotsBytes), "User-agent: *") {
		t.Errorf("expected robots.txt content to contain 'User-agent: *', got %q", string(robotsBytes))
	}
}

func TestNewHandler_Prefix(t *testing.T) {
	handler, err := NewHandler(Config{
		Prefix: "/docs",
	})
	if err != nil {
		t.Fatalf("failed to create handler: %v", err)
	}

	ts := httptest.NewServer(handler)
	defer ts.Close()

	// Request prefix path
	res, err := http.Get(ts.URL + "/docs/config.yaml")
	if err != nil {
		t.Fatalf("failed to get prefix config.yaml: %v", err)
	}
	defer func() { _ = res.Body.Close() }()

	if res.StatusCode != http.StatusOK {
		t.Errorf("expected status 200, got %d", res.StatusCode)
	}
}

func TestNewHandler_CustomConfigAndInMemory(t *testing.T) {
	name := "test.proto"
	descriptorSet := &descriptorpb.FileDescriptorSet{
		File: []*descriptorpb.FileDescriptorProto{
			{
				Name: &name,
			},
		},
	}
	descriptorBytes, err := proto.Marshal(descriptorSet)
	if err != nil {
		t.Fatalf("failed to marshal test descriptor set: %v", err)
	}
	markdownContent := "# Welcome to my docs"

	handler, err := NewHandler(Config{
		Title:    "Custom API Portal",
		LogoText: "MyLogo",
		Descriptors: descriptorSet,
		FrontPageMarkdown: markdownContent,
		BackToText: "Back to Home",
		BackToURL:  "https://example.com/home",
	})
	if err != nil {
		t.Fatalf("failed to create handler: %v", err)
	}

	ts := httptest.NewServer(handler)
	defer ts.Close()

	// 1. Check config.yaml is customized and contains the in-memory descriptor
	res, err := http.Get(ts.URL + "/config.yaml")
	if err != nil {
		t.Fatalf("failed to get config.yaml: %v", err)
	}
	defer func() { _ = res.Body.Close() }()

	var appCfg AppConfig
	if err := yaml.NewDecoder(res.Body).Decode(&appCfg); err != nil {
		t.Fatalf("failed to decode config.yaml: %v", err)
	}

	if appCfg.Title != "Custom API Portal" {
		t.Errorf("expected title 'Custom API Portal', got %q", appCfg.Title)
	}

	if appCfg.BackToText != "Back to Home" {
		t.Errorf("expected back_to_text 'Back to Home', got %q", appCfg.BackToText)
	}

	if appCfg.BackToURL != "https://example.com/home" {
		t.Errorf("expected back_to_url 'https://example.com/home', got %q", appCfg.BackToURL)
	}

	foundDescriptor := false
	for _, df := range appCfg.DescriptorFiles {
		if df == "/descriptors.binpb" {
			foundDescriptor = true
			break
		}
	}
	if !foundDescriptor {
		t.Error("expected '/descriptors.binpb' in descriptor_files list, but not found")
	}

	if appCfg.FrontPageMarkdown != markdownContent {
		t.Errorf("expected FrontPageMarkdown %q, got %q", markdownContent, appCfg.FrontPageMarkdown)
	}

	// 2. Fetch the in-memory descriptor file
	resDesc, err := http.Get(ts.URL + "/descriptors.binpb")
	if err != nil {
		t.Fatalf("failed to fetch descriptor: %v", err)
	}
	defer func() { _ = resDesc.Body.Close() }()

	descBytes, _ := io.ReadAll(resDesc.Body)
	if string(descBytes) != string(descriptorBytes) {
		t.Errorf("expected descriptor content %q, got %q", descriptorBytes, descBytes)
	}
}

func TestNewHandler_Registry(t *testing.T) {
	reg := &protoregistry.Files{}

	name1 := "first.proto"
	fd1, err := protodesc.NewFile(&descriptorpb.FileDescriptorProto{
		Name:    &name1,
		Syntax:  proto.String("proto3"),
	}, nil)
	if err != nil {
		t.Fatalf("failed to create protoreflect.FileDescriptor: %v", err)
	}
	if err := reg.RegisterFile(fd1); err != nil {
		t.Fatalf("failed to register file: %v", err)
	}

	handler, err := NewHandler(Config{
		Registry: reg,
	})
	if err != nil {
		t.Fatalf("failed to create handler: %v", err)
	}

	ts := httptest.NewServer(handler)
	defer ts.Close()

	// 1. Fetch initially registered descriptor file
	resDesc, err := http.Get(ts.URL + "/descriptors.binpb")
	if err != nil {
		t.Fatalf("failed to fetch descriptor: %v", err)
	}
	defer func() { _ = resDesc.Body.Close() }()

	descBytes, _ := io.ReadAll(resDesc.Body)
	var fds1 descriptorpb.FileDescriptorSet
	if err := proto.Unmarshal(descBytes, &fds1); err != nil {
		t.Fatalf("failed to unmarshal descriptor: %v", err)
	}
	if len(fds1.File) != 1 || *fds1.File[0].Name != "first.proto" {
		t.Errorf("expected 1 file named 'first.proto', got %v", fds1.File)
	}

	// 2. Add a new file to the registry dynamically
	name2 := "second.proto"
	fd2, err := protodesc.NewFile(&descriptorpb.FileDescriptorProto{
		Name:    &name2,
		Syntax:  proto.String("proto3"),
	}, nil)
	if err != nil {
		t.Fatalf("failed to create second protoreflect.FileDescriptor: %v", err)
	}
	if err := reg.RegisterFile(fd2); err != nil {
		t.Fatalf("failed to register second file: %v", err)
	}

	// 3. Fetch descriptor again, it should reflect the new file!
	resDesc2, err := http.Get(ts.URL + "/descriptors.binpb")
	if err != nil {
		t.Fatalf("failed to fetch descriptor: %v", err)
	}
	defer func() { _ = resDesc2.Body.Close() }()

	descBytes2, _ := io.ReadAll(resDesc2.Body)
	var fds2 descriptorpb.FileDescriptorSet
	if err := proto.Unmarshal(descBytes2, &fds2); err != nil {
		t.Fatalf("failed to unmarshal descriptor: %v", err)
	}
	if len(fds2.File) != 2 {
		t.Errorf("expected 2 files in FileDescriptorSet, got %d", len(fds2.File))
	}
}
