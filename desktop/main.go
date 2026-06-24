package main

import (
	"embed"
	"fmt"
	"log"
	"net"
	"net/http"

	"github.com/sudorandom/protodocs"
	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/mac"
)

//go:embed all:dist
var assets embed.FS

func main() {
	// Initialize the protodocs handler with Proxy enabled
	cfg := protodocs.Config{
		Title:             "ProtoDocs (Desktop)",
		LogoText:          "ProtoDocs",
		Proxy:             true,
		ProxyAllowedHosts: []string{"*"},
		DefaultTab:        "files",
		Protocols:         []string{"connect", "grpc", "grpc-web"},
		FrontPageSections: []protodocs.FrontPageSection{
			{
				Type: "markdown",
				Markdown: `# Loaded Schema Overview

This workspace is generated from the descriptor set currently loaded in the desktop app. Use the panels below to scan the shape of the schema, then jump into files or services from the sidebar.`,
			},
			{Type: "descriptor-stats-panel"},
			{Type: "service-list-panel"},
			{
				Type:     "markdown-small",
				Markdown: `Desktop session powered by the local ProtoDocs proxy.`,
			},
		},
	}
	handler, err := protodocs.NewHandler(cfg)
	if err != nil {
		log.Fatalf("Failed to initialize ProtoDocs proxy handler: %v", err)
	}

	// Listen on an auto-allocated local loopback port
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		log.Fatalf("Failed to listen on local port for proxy: %v", err)
	}
	port := listener.Addr().(*net.TCPAddr).Port
	proxyUrl := fmt.Sprintf("http://127.0.0.1:%d", port)
	log.Printf("Desktop local proxy server running on: %s", proxyUrl)

	// Start proxy server in the background
	go func() {
		server := &http.Server{
			Addr:    listener.Addr().String(),
			Handler: handler,
		}
		if err := server.Serve(listener); err != nil && err != http.ErrServerClosed {
			log.Printf("Local proxy server error: %v", err)
		}
	}()

	app := NewApp(proxyUrl)

	err = wails.Run(&options.App{
		Title:  "ProtoDocs",
		Width:  1280,
		Height: 800,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		OnStartup: app.startup,
		Bind: []interface{}{
			app,
		},
		Mac: &mac.Options{
			OnFileOpen: func(filePath string) {
				app.HandleFileOpen(filePath)
			},
		},
	})

	if err != nil {
		log.Fatal("Error starting Wails application:", err)
	}
}
