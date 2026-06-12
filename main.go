package main

import (
	"context"
	"crypto/tls"
	"embed"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"io"
	"io/fs"
	"log"
	"net"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"

	"github.com/gorilla/websocket"
	"github.com/spf13/pflag"
	"github.com/spf13/viper"
	"golang.org/x/net/http2"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

//go:embed dist/*
var embeddedFiles embed.FS

// AppConfig matches the structure of config.json
type AppConfig struct {
	Title                          string            `json:"title,omitempty"`
	LogoText                       string            `json:"logo_text,omitempty"`
	LogoURL                        string            `json:"logo_url,omitempty"`
	LoadingMethod                  string            `json:"loading_method,omitempty"`
	DescriptorFiles                []string          `json:"descriptor_files,omitempty"`
	ServerURL                      string            `json:"server_url,omitempty"`
	ReflectionURL                  string            `json:"reflection_url,omitempty"`
	DefaultFile                    string            `json:"default_file,omitempty"`
	FrontPageMarkdownFile          string            `json:"front_page_markdown_file,omitempty"`
	BottomOfFrontPageMarkdownFile  string            `json:"bottom_of_front_page_markdown_file,omitempty"`
	ServiceEndpoints               map[string]string `json:"service_endpoints,omitempty"`
	PrioritizedPaths               []string          `json:"prioritized_paths,omitempty"`
	HighlightedFiles               []string          `json:"highlighted_files,omitempty"`
}

type layeredFileSystem struct {
	primary   http.FileSystem
	secondary http.FileSystem
}

func (l layeredFileSystem) Open(name string) (http.File, error) {
	f, err := l.primary.Open(name)
	if err == nil {
		return f, nil
	}
	if os.IsNotExist(err) && l.secondary != nil {
		return l.secondary.Open(name)
	}
	return nil, err
}

type spaFileSystem struct {
	fs http.FileSystem
}

func (s spaFileSystem) Open(name string) (http.File, error) {
	f, err := s.fs.Open(name)
	if err == nil {
		return f, nil
	}

	if os.IsNotExist(err) {
		ext := filepath.Ext(name)
		if ext != "" {
			return nil, err
		}
		// Fallback to index.html for SPA router
		f, err = s.fs.Open("index.html")
		if err == nil {
			return f, nil
		}
	}
	return nil, err
}

type ProxyHandler struct {
	client    *http.Client
	h2cClient *http.Client
}

func NewProxyHandler() *ProxyHandler {
	client := &http.Client{
		Transport: http.DefaultTransport,
	}

	h2cTransport := &http2.Transport{
		AllowHTTP: true,
		DialTLSContext: func(ctx context.Context, network, addr string, cfg *tls.Config) (net.Conn, error) {
			var d net.Dialer
			return d.DialContext(ctx, network, addr)
		},
	}
	h2cClient := &http.Client{
		Transport: h2cTransport,
	}

	return &ProxyHandler{
		client:    client,
		h2cClient: h2cClient,
	}
}

func (p *ProxyHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	// Enable CORS for frontend
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Headers", "*")
	w.Header().Set("Access-Control-Allow-Methods", "POST, GET, OPTIONS, PUT, DELETE")

	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return
	}

	targetURLStr := r.Header.Get("X-Target-Url")
	if targetURLStr == "" {
		http.Error(w, "Missing X-Target-Url header", http.StatusBadRequest)
		return
	}

	targetURL, err := url.Parse(targetURLStr)
	if err != nil {
		http.Error(w, fmt.Sprintf("Invalid X-Target-Url: %v", err), http.StatusBadRequest)
		return
	}

	// Create request copy
	proxyReq, err := http.NewRequestWithContext(r.Context(), r.Method, targetURLStr, r.Body)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to create request: %v", err), http.StatusInternalServerError)
		return
	}

	contentType := r.Header.Get("Content-Type")
	// Translate to standard gRPC if it's a gRPC-Web request and X-Translate-To-Grpc is true
	isGrpcWeb := strings.HasPrefix(contentType, "application/grpc-web")
	translateToGrpc := isGrpcWeb && (r.Header.Get("X-Translate-To-Grpc") == "true" || r.Header.Get("x-translate-to-grpc") == "true")

	// Copy headers
	for k, vv := range r.Header {
		kLower := strings.ToLower(k)
		if kLower == "x-target-url" || kLower == "host" || kLower == "connection" ||
			kLower == "keep-alive" || kLower == "proxy-authenticate" || kLower == "proxy-authorization" ||
			kLower == "te" || kLower == "trailers" || kLower == "transfer-encoding" || kLower == "upgrade" {
			continue
		}
		for _, v := range vv {
			proxyReq.Header.Add(k, v)
		}
	}

	if translateToGrpc {
		// Convert application/grpc-web* -> application/grpc*
		translatedCT := strings.Replace(contentType, "application/grpc-web", "application/grpc", 1)
		proxyReq.Header.Set("Content-Type", translatedCT)
		proxyReq.Header.Set("TE", "trailers")
	}

	// Determine client
	var httpClient *http.Client
	if translateToGrpc && targetURL.Scheme == "http" {
		httpClient = p.h2cClient
	} else {
		httpClient = p.client
	}

	resp, err := httpClient.Do(proxyReq)
	if err != nil {
		http.Error(w, fmt.Sprintf("Proxy connection failed: %v", err), http.StatusBadGateway)
		return
	}
	defer func() { _ = resp.Body.Close() }()

	// Copy response headers
	for k, vv := range resp.Header {
		kLower := strings.ToLower(k)
		if kLower == "connection" || kLower == "keep-alive" || kLower == "transfer-encoding" {
			continue
		}
		for _, v := range vv {
			w.Header().Add(k, v)
		}
	}

	if translateToGrpc {
		respCT := resp.Header.Get("Content-Type")
		if strings.HasPrefix(respCT, "application/grpc") {
			translatedRespCT := strings.Replace(respCT, "application/grpc", "application/grpc-web", 1)
			w.Header().Set("Content-Type", translatedRespCT)
		} else {
			w.Header().Set("Content-Type", contentType)
		}
	}

	w.WriteHeader(resp.StatusCode)

	// Stream body chunks
	flusher, isFlusher := w.(http.Flusher)
	buf := make([]byte, 32*1024)
	for {
		n, err := resp.Body.Read(buf)
		if n > 0 {
			_, wErr := w.Write(buf[:n])
			if wErr != nil {
				break
			}
			if isFlusher {
				flusher.Flush()
			}
		}
		if err == io.EOF {
			break
		}
		if err != nil {
			break
		}
	}

	// Translate trailers for grpc-web
	if translateToGrpc {
		var trailerBuilder strings.Builder
		for k, vv := range resp.Trailer {
			for _, v := range vv {
				_, _ = fmt.Fprintf(&trailerBuilder, "%s: %s\r\n", strings.ToLower(k), v)
			}
		}

		// Verify we have grpc-status
		hasGrpcStatus := false
		for k := range resp.Trailer {
			if strings.ToLower(k) == "grpc-status" {
				hasGrpcStatus = true
				break
			}
		}
		if !hasGrpcStatus {
			statusVal := resp.Header.Get("Grpc-Status")
			if statusVal != "" {
				_, _ = fmt.Fprintf(&trailerBuilder, "grpc-status: %s\r\n", statusVal)
				msgVal := resp.Header.Get("Grpc-Message")
				if msgVal != "" {
					_, _ = fmt.Fprintf(&trailerBuilder, "grpc-message: %s\r\n", msgVal)
				}
			} else {
				trailerBuilder.WriteString("grpc-status: 0\r\n")
			}
		}

		trailersStr := trailerBuilder.String()
		trailersBytes := []byte(trailersStr)

		envelope := make([]byte, 5)
		envelope[0] = 0x80
		binary.BigEndian.PutUint32(envelope[1:5], uint32(len(trailersBytes)))

		_, _ = w.Write(envelope)
		_, _ = w.Write(trailersBytes)
		if isFlusher {
			flusher.Flush()
		}
	}
}

func (p *ProxyHandler) ServeWs(w http.ResponseWriter, r *http.Request) {
	c, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("upgrade error: %v", err)
		return
	}
	defer func() { _ = c.Close() }()

	// First message must be the initial configuration
	var initMsg struct {
		URL     string            `json:"url"`
		Headers map[string]string `json:"headers"`
	}
	err = c.ReadJSON(&initMsg)
	if err != nil {
		log.Printf("ws read init error: %v", err)
		return
	}

	targetURL, err := url.Parse(initMsg.URL)
	if err != nil {
		_ = c.WriteJSON(map[string]interface{}{"status": 400, "error": "invalid URL"})
		return
	}

	pr, pw := io.Pipe()

	proxyReq, err := http.NewRequestWithContext(r.Context(), http.MethodPost, initMsg.URL, pr)
	if err != nil {
		_ = c.WriteJSON(map[string]interface{}{"status": 500, "error": err.Error()})
		return
	}

	contentType := ""
	translateToGrpc := false
	for k, v := range initMsg.Headers {
		kLower := strings.ToLower(k)
		if kLower == "content-type" {
			contentType = v
			isGrpcWeb := strings.HasPrefix(contentType, "application/grpc-web")
			translateToGrpc = isGrpcWeb && (initMsg.Headers["X-Translate-To-Grpc"] == "true" || initMsg.Headers["x-translate-to-grpc"] == "true")
		}
		if kLower == "x-target-url" || kLower == "host" || kLower == "connection" ||
			kLower == "keep-alive" || kLower == "proxy-authenticate" || kLower == "proxy-authorization" ||
			kLower == "te" || kLower == "trailers" || kLower == "transfer-encoding" || kLower == "upgrade" {
			continue
		}
		proxyReq.Header.Add(k, v)
	}

	if translateToGrpc {
		translatedCT := strings.Replace(contentType, "application/grpc-web", "application/grpc", 1)
		proxyReq.Header.Set("Content-Type", translatedCT)
		proxyReq.Header.Set("TE", "trailers")
	}

	var httpClient *http.Client
	if translateToGrpc && targetURL.Scheme == "http" {
		httpClient = p.h2cClient
	} else {
		httpClient = p.client
	}

	// Goroutine to read from WebSocket and write to pipe
	go func() {
		for {
			mt, message, err := c.ReadMessage()
			if err != nil {
				_ = pw.Close()
				break
			}
			if mt == websocket.TextMessage && string(message) == `{"eos":true}` {
				_ = pw.Close() // Signal EOF to the server
			} else if mt == websocket.BinaryMessage || mt == websocket.TextMessage {
				_, _ = pw.Write(message)
			}
		}
	}()

	resp, err := httpClient.Do(proxyReq)
	if err != nil {
		_ = c.WriteJSON(map[string]interface{}{"status": 502, "error": err.Error()})
		return
	}
	defer func() { _ = resp.Body.Close() }()

	// Send back response headers
	headers := make(map[string]string)
	for k, vv := range resp.Header {
		if len(vv) > 0 {
			headers[k] = vv[0]
		}
	}

	if translateToGrpc && strings.HasPrefix(headers["Content-Type"], "application/grpc") {
		headers["Content-Type"] = strings.Replace(headers["Content-Type"], "application/grpc", "application/grpc-web", 1)
	}

	_ = c.WriteJSON(map[string]interface{}{
		"status":  resp.StatusCode,
		"headers": headers,
	})

	// Read from resp.Body and write to WebSocket
	buf := make([]byte, 4096)
	for {
		n, err := resp.Body.Read(buf)
		if n > 0 {
			_ = c.WriteMessage(websocket.BinaryMessage, buf[:n])
		}
		if err != nil {
			break
		}
	}

	// Check for trailers
	if len(resp.Trailer) > 0 {
		var trailers []string
		for k, vv := range resp.Trailer {
			for _, v := range vv {
				trailers = append(trailers, fmt.Sprintf("%s: %s", k, v))
			}
		}
		trailerStr := strings.Join(trailers, "\r\n") + "\r\n"

		if translateToGrpc {
			tBytes := []byte(trailerStr)
			frame := make([]byte, 5+len(tBytes))
			frame[0] = 0x80
			binary.BigEndian.PutUint32(frame[1:5], uint32(len(tBytes)))
			copy(frame[5:], tBytes)
			_ = c.WriteMessage(websocket.BinaryMessage, frame)
		}
	}
}

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
	pflag.Bool("open", true, "Automatically open ProtoDocs in the browser")
	pflag.Parse()

	_ = viper.BindPFlags(pflag.CommandLine)
	viper.SetEnvKeyReplacer(strings.NewReplacer("-", "_"))
	viper.AutomaticEnv()

	addr := viper.GetString("addr")
	staticDir := viper.GetString("static-dir")
	reflectionURL := viper.GetString("reflection-url")
	loadingMethod := viper.GetString("loading-method")
	autoOpen := viper.GetBool("open")

	descriptorFiles := pflag.Args()

	// 1. Resolve Static Filesystem
	var embedded http.FileSystem
	subFS, err := fs.Sub(embeddedFiles, "dist")
	if err != nil {
		log.Printf("Embedded assets folder empty. Serving root folder as fallback.")
		embedded = http.Dir(".")
	} else {
		embedded = http.FS(subFS)
	}

	var staticFS http.FileSystem
	if staticDir != "" {
		log.Printf("Serving static assets from local directory: %s (falling back to embedded)", staticDir)
		staticFS = spaFileSystem{fs: layeredFileSystem{primary: http.Dir(staticDir), secondary: embedded}}
	} else {
		staticFS = spaFileSystem{fs: embedded}
	}

	// 2. Generate Dynamic Config if override flags are passed
	var dynamicConfig []byte
	if len(descriptorFiles) > 0 || reflectionURL != "" || loadingMethod != "" {
		cfg := AppConfig{
			Title:    "ProtoDocs (CLI)",
			LogoText: "ProtoDocs (CLI)",
		}

		if reflectionURL != "" {
			cfg.ReflectionURL = reflectionURL
			cfg.ServerURL = reflectionURL
		}

		if loadingMethod != "" {
			cfg.LoadingMethod = loadingMethod
		} else if reflectionURL != "" {
			cfg.LoadingMethod = "connect"
		} else {
			cfg.LoadingMethod = "http"
		}

		if len(descriptorFiles) > 0 {
			cfg.DescriptorFiles = make([]string, len(descriptorFiles))
			for i := range descriptorFiles {
				cfg.DescriptorFiles[i] = fmt.Sprintf("/custom_%d.binpb", i)
			}
		}

		cfg.FrontPageMarkdownFile = "/home.md"
		cfg.BottomOfFrontPageMarkdownFile = "/footer.md"
		cfg.ServiceEndpoints = map[string]string{
			"connectrpc.eliza.v1.ElizaService": "https://demo.connectrpc.com",
		}

		var err error
		dynamicConfig, err = json.MarshalIndent(cfg, "", "  ")
		if err != nil {
			log.Fatalf("Failed to generate dynamic config: %v", err)
		}
		log.Printf("Generated custom runtime configuration from CLI flags.")
	}

	// 3. Register HTTP handlers
	
	// API Health check
	http.HandleFunc("/api/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Access-Control-Allow-Origin", "*")
		_, _ = w.Write([]byte(`{"status":"ok","proxy":true,"version":"1.0.0"}`))
	})

	// Proxy
	proxyHandler := NewProxyHandler()
	http.Handle("/api/proxy", proxyHandler)
	http.HandleFunc("/api/proxy/ws", proxyHandler.ServeWs)

	// Override config.json
	http.HandleFunc("/config.json", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Access-Control-Allow-Origin", "*")
		if len(dynamicConfig) > 0 {
			_, _ = w.Write(dynamicConfig)
			return
		}
		// Fallback to static config.json
		f, err := staticFS.Open("config.json")
		if err != nil {
			_, _ = w.Write([]byte("{}"))
			return
		}
		defer func() { _ = f.Close() }()
		_, _ = io.Copy(w, f)
	})

	// Serve custom descriptors if loaded from CLI arguments
	for i, path := range descriptorFiles {
		idx := i
		filePath := path
		http.HandleFunc(fmt.Sprintf("/custom_%d.binpb", idx), func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Access-Control-Allow-Origin", "*")
			w.Header().Set("Content-Type", "application/octet-stream")
			log.Printf("Serving descriptor file: %s", filePath)
			http.ServeFile(w, r, filePath)
		})
	}

	// Static website server (all other requests)
	fileServer := http.FileServer(staticFS)
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		// Don't log favicon etc.
		if r.URL.Path == "/" || strings.HasSuffix(r.URL.Path, ".html") || strings.HasPrefix(r.URL.Path, "/assets") {
			log.Printf("HTTP: %s %s", r.Method, r.URL.Path)
		}
		fileServer.ServeHTTP(w, r)
	})

	// 4. Auto-port allocation
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
			// Small delay to let http server start listening
			openBrowser(serverURL)
		}()
	}

	server := &http.Server{Addr: listener.Addr().String()}
	err = server.Serve(listener)
	if err != nil && err != http.ErrServerClosed {
		log.Fatalf("HTTP server failed: %v", err)
	}
}
