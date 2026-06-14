package main

import (
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"os/exec"
	"runtime"
	"strconv"
	"strings"

	"github.com/spf13/pflag"
	"github.com/spf13/viper"
	"github.com/sudorandom/protodocs"
	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/types/descriptorpb"
)

func openBrowser(url string) {
	var err error
	switch runtime.GOOS {
	case "linux":
		err = exec.Command("xdg-open", url).Start()
	case "windows":
		err = exec.Command("rundll32", "url.dll,FileProtocolHandler", url).Start()
	case "darwin":
		err = exec.Command("open", url).Start()
	default:
		err = fmt.Errorf("unsupported platform: %s", runtime.GOOS)
	}
	if err != nil {
		log.Printf("Failed to open browser automatically: %v", err)
	}
}

func main() {
	pflag.String("addr", "127.0.0.1:8080", "Host:Port to listen on (port will auto-increment if taken)")
	pflag.String("static-dir", "", "Local path to static assets (overrides embedded files)")
	pflag.String("reflection-url", "", "Default gRPC/Connect Server Reflection URL")
	pflag.String("loading-method", "", "Default loading method ('http', 'grpc-web', 'connect')")
	pflag.String("default-tab", "", "Default tab to focus in the sidebar ('files' or 'services')")
	pflag.Bool("open", true, "Automatically open ProtoDocs in the browser")
	pflag.Parse()

	_ = viper.BindPFlags(pflag.CommandLine)
	viper.SetEnvKeyReplacer(strings.NewReplacer("-", "_"))
	viper.AutomaticEnv()

	addr := viper.GetString("addr")
	staticDir := viper.GetString("static-dir")
	reflectionURL := viper.GetString("reflection-url")
	loadingMethod := viper.GetString("loading-method")
	defaultTab := viper.GetString("default-tab")
	autoOpen := viper.GetBool("open")

	descriptorFiles := pflag.Args()

	// Build configuration
	cfg := protodocs.Config{
		Title:         "ProtoDocs (CLI)",
		LogoText:      "ProtoDocs (CLI)",
		LoadingMethod: loadingMethod,
		LocalPath:     staticDir,
		Proxy:         true,
		DefaultTab:    defaultTab,
	}

	if reflectionURL != "" {
		cfg.ReflectionURL = reflectionURL
		cfg.ServerURL = reflectionURL
	}

	if cfg.LoadingMethod == "" {
		if reflectionURL != "" {
			cfg.LoadingMethod = "connect"
		} else {
			cfg.LoadingMethod = "http"
		}
	}

	// Load positional descriptor files from disk into memory
	if len(descriptorFiles) > 0 {
		mergedSet := &descriptorpb.FileDescriptorSet{}
		for _, path := range descriptorFiles {
			bytes, err := os.ReadFile(path)
			if err != nil {
				log.Fatalf("Failed to read descriptor file %s: %v", path, err)
			}
			var fds descriptorpb.FileDescriptorSet
			if err := proto.Unmarshal(bytes, &fds); err != nil {
				log.Fatalf("Failed to parse descriptor file %s: %v", path, err)
			}
			mergedSet.File = append(mergedSet.File, fds.File...)
		}
		cfg.Descriptors = mergedSet
	}

	// Add the demo config defaults if nothing was supplied (mimics standard CLI behavior)
	if len(descriptorFiles) == 0 && reflectionURL == "" {
		cfg.DescriptorFiles = []string{"/eliza.binpb"}
		cfg.FrontPageMarkdown = "# Welcome to ProtoDocs 🚀\n\nSelect a file or service in the sidebar to start browsing the schema documentation."
		cfg.ServiceEndpoints = map[string][]string{
			"connectrpc.eliza.v1.ElizaService": {"https://demo.connectrpc.com"},
		}
	}

	handler, err := protodocs.NewHandler(cfg)
	if err != nil {
		log.Fatalf("Failed to initialize ProtoDocs handler: %v", err)
	}

	// Auto-port allocation
	host, portStr, err := net.SplitHostPort(addr)
	if err != nil {
		log.Fatalf("Invalid addr %q: %v", addr, err)
	}
	port, err := strconv.Atoi(portStr)
	if err != nil {
		log.Fatalf("Invalid port in addr %q: %v", addr, err)
	}

	var listener net.Listener
	for i := 0; i <= 100; i++ {
		currentPort := port + i
		tryAddr := fmt.Sprintf("%s:%d", host, currentPort)
		listener, err = net.Listen("tcp", tryAddr)
		if err == nil {
			port = currentPort
			break
		}
	}
	if err != nil {
		log.Fatalf("Could not bind to any TCP port starting from %d: %v", port, err)
	}

	displayHost := host
	if displayHost == "0.0.0.0" || displayHost == "" {
		displayHost = "localhost"
	}
	serverURL := fmt.Sprintf("http://%s:%d", displayHost, port)
	log.Printf("ProtoDocs CLI running on: %s", serverURL)

	if autoOpen {
		go func() {
			openBrowser(serverURL)
		}()
	}

	server := &http.Server{
		Addr:    listener.Addr().String(),
		Handler: handler,
	}
	err = server.Serve(listener)
	if err != nil && err != http.ErrServerClosed {
		log.Fatalf("HTTP server failed: %v", err)
	}
}
