package main

import (
	"log"
	"net/http"

	"github.com/sudorandom/protodocs"
	"google.golang.org/protobuf/reflect/protoregistry"

	_ "buf.build/gen/go/connectrpc/eliza/protocolbuffers/go/connectrpc/eliza/v1"
)

func main() {
	// Initialize the ProtoDocs handler.
	// We host the documentation under the "/docs/" path prefix.
	handler, err := protodocs.NewHandler(protodocs.Config{
		Title:    "Eliza Service Documentation",
		LogoText: "Eliza API",
		// Use the global registry populated by the imported packages
		Registry: protoregistry.GlobalFiles,
		Prefix:   "/docs/",
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
