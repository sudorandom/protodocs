package main

import (
	_ "embed"
	"log"
	"net/http"

	"github.com/sudorandom/protodocs"
	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/types/descriptorpb"
)

//go:embed eliza.binpb
var elizaDescriptorBytes []byte

func main() {
	// Parse the embedded descriptor file set.
	var fds descriptorpb.FileDescriptorSet
	if err := proto.Unmarshal(elizaDescriptorBytes, &fds); err != nil {
		log.Fatalf("Failed to unmarshal embedded descriptor: %v", err)
	}

	// Initialize the ProtoDocs handler.
	// We host the documentation under the "/docs/" path prefix.
	handler, err := protodocs.NewHandler(protodocs.Config{
		Title:       "Eliza Service Documentation (Descriptor File)",
		LogoText:    "Eliza API",
		Descriptors: &fds,
		Prefix:      "/docs/",
	})
	if err != nil {
		log.Fatalf("Failed to initialize ProtoDocs handler: %v", err)
	}

	// Register the handler to ServeMux
	http.Handle("/docs/", handler)

	log.Println("ProtoDocs example server running at http://localhost:8080/docs/")
	if err := http.ListenAndServe(":8080", nil); err != nil {
		log.Fatal(err)
	}
}
