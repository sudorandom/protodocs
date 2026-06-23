package protodocs

import (
	"embed"
	"encoding/binary"
	"fmt"
	"io"
	"io/fs"
	"log"
	"net"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"slices"
	"strings"

	"buf.build/go/protovalidate"
	"buf.build/go/protoyaml"
	"github.com/gorilla/websocket"
	pb "github.com/sudorandom/protodocs/gen/proto/protodocs/v1"
	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/reflect/protodesc"
	"google.golang.org/protobuf/reflect/protoreflect"
	"google.golang.org/protobuf/reflect/protoregistry"
	"google.golang.org/protobuf/types/descriptorpb"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

//go:embed dist/*
var embeddedFiles embed.FS

// Config defines the configuration for the ProtoDocs handler.
type Config struct {
	// Title of the documentation.
	Title string
	// LogoText is the text displayed next to the logo.
	LogoText string
	// LogoURL is the URL of the logo image.
	LogoURL string
	// LogoURLLight is the URL of the logo image for light theme.
	LogoURLLight string
	// LogoURLDark is the URL of the logo image for dark theme.
	LogoURLDark string
	// LogoURLCyberpunk is the URL of the logo image for cyberpunk theme.
	LogoURLCyberpunk string
	// LoadingMethod is the loading method to use by default ('http', 'grpc-web', 'connect').
	LoadingMethod string
	// DescriptorFiles is a list of URLs or paths to binary protobuf descriptor files to load.
	DescriptorFiles []string
	// ServerURL is the default server URL for sending requests.
	ServerURL string
	// ReflectionURL is the default server reflection URL.
	ReflectionURL string
	// FrontPageMarkdown is the markdown string content for the front page.
	FrontPageMarkdown string
	// BottomOfFrontPageMarkdown is the markdown string content for the footer.
	BottomOfFrontPageMarkdown string
	// ServiceEndpoints maps service names to default server URLs (can be a single string or slice of strings).
	ServiceEndpoints map[string][]string
	// PrioritizedPaths is a list of paths to prioritize in the UI.
	PrioritizedPaths []string
	// HighlightedFiles is a list of files to highlight in the UI.
	HighlightedFiles []string

	// BackToText is the text for the 'back' button in the navbar (e.g. "Back to Developer Portal").
	BackToText string
	// BackToURL is the URL the 'back' button in the navbar navigates to.
	BackToURL string

	// LocalPath to static assets (overrides embedded files).
	LocalPath string

	// Prefix is the URL prefix under which the handler is hosted (e.g. "/docs/").
	Prefix string

	// Descriptors is an in-memory FileDescriptorSet.
	Descriptors *descriptorpb.FileDescriptorSet

	// Registry is an optional protobuf registry to dynamically generate the FileDescriptorSet from.
	// If set, updates to the registry will be dynamically reflected in the documentation.
	Registry *protoregistry.Files
	// Proxy enables proxy features and tells the UI to check/use the proxy.
	Proxy bool
	// DefaultTab is the default tab to focus in the sidebar ('files' or 'services').
	DefaultTab string
	// Protocols lists the protocols supported by the UI (e.g. 'connect', 'grpc', 'grpc-web')
	Protocols []string
	// ProxyAllowedHosts is a list of hosts that the proxy is allowed to forward requests to.
	// Use "*" to allow all hosts (recommended for desktop and local CLI use).
	ProxyAllowedHosts []string
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
	client            *http.Client
	h2cClient         *http.Client
	allowedProxyHosts []string
	registry          *protoregistry.Files
	serverURL         string
	reflectionURL     string
	serviceEndpoints  map[string][]string
}

func NewProxyHandler(allowedHosts []string, registry *protoregistry.Files, descriptors *descriptorpb.FileDescriptorSet, serverURL string, reflectionURL string, serviceEndpoints map[string][]string) *ProxyHandler {
	client := &http.Client{
		Transport: http.DefaultTransport,
	}

	h2cTransport := &http.Transport{}
	h2cTransport.Protocols = new(http.Protocols)
	h2cTransport.Protocols.SetUnencryptedHTTP2(true)
	h2cClient := &http.Client{
		Transport: h2cTransport,
	}

	reg := registry
	if reg == nil && descriptors != nil {
		var err error
		reg, err = protodesc.NewFiles(descriptors)
		if err != nil {
			log.Printf("ProxyHandler: failed to build registry from descriptors: %v", err)
		}
	}

	return &ProxyHandler{
		client:            client,
		h2cClient:         h2cClient,
		allowedProxyHosts: allowedHosts,
		registry:          reg,
		serverURL:         serverURL,
		reflectionURL:     reflectionURL,
		serviceEndpoints:  serviceEndpoints,
	}
}

func (p *ProxyHandler) isHostAllowed(targetHost string) bool {
	if len(p.allowedProxyHosts) == 0 {
		return true
	}
	hostname := targetHost
	if h, _, err := net.SplitHostPort(targetHost); err == nil {
		hostname = h
	}
	for _, allowed := range p.allowedProxyHosts {
		if allowed == "*" {
			return true
		}
		allowedHost := allowed
		if ah, _, err := net.SplitHostPort(allowed); err == nil {
			allowedHost = ah
		}
		if strings.EqualFold(hostname, allowedHost) {
			return true
		}
	}
	return false
}

func parseServiceAndMethod(path string) (string, string, bool) {
	trimmed := strings.Trim(path, "/")
	parts := strings.Split(trimmed, "/")
	if len(parts) < 2 {
		return "", "", false
	}
	methodName := parts[len(parts)-1]
	serviceName := strings.Join(parts[:len(parts)-1], "/")
	serviceName = strings.ReplaceAll(serviceName, "/", ".")
	return serviceName, methodName, true
}

func (p *ProxyHandler) isMethodInSchema(serviceName string, methodName string) bool {
	// Always allow standard gRPC reflection services
	if serviceName == "grpc.reflection.v1alpha.ServerReflection" || serviceName == "grpc.reflection.v1.ServerReflection" {
		if methodName == "ServerReflectionInfo" {
			return true
		}
	}
	// Always allow standard gRPC health check
	if serviceName == "grpc.health.v1.Health" {
		if methodName == "Check" || methodName == "Watch" {
			return true
		}
	}

	if p.registry == nil {
		return true
	}
	desc, err := p.registry.FindDescriptorByName(protoreflect.FullName(serviceName))
	if err != nil {
		return false
	}
	serviceDesc, ok := desc.(protoreflect.ServiceDescriptor)
	if !ok {
		return false
	}
	methodDesc := serviceDesc.Methods().ByName(protoreflect.Name(methodName))
	return methodDesc != nil
}

func (p *ProxyHandler) isTargetAllowed(targetURL *url.URL, requestHost string) bool {
	// Always allow 127.0.0.1 and localhost
	host := targetURL.Host
	if h, _, err := net.SplitHostPort(targetURL.Host); err == nil {
		host = h
	}
	if host == "127.0.0.1" || strings.EqualFold(host, "localhost") {
		return true
	}

	// Always allow target host matching request host (same server origin)
	reqHost := requestHost
	if h, _, err := net.SplitHostPort(requestHost); err == nil {
		reqHost = h
	}
	if reqHost != "" && strings.EqualFold(host, reqHost) {
		return true
	}

	// Parse service and method from the path
	serviceName, methodName, ok := parseServiceAndMethod(targetURL.Path)
	if !ok || !p.isMethodInSchema(serviceName, methodName) {
		return false
	}

	// Always allow reflection and health checks on any allowed host
	if serviceName == "grpc.reflection.v1alpha.ServerReflection" ||
		serviceName == "grpc.reflection.v1.ServerReflection" ||
		serviceName == "grpc.health.v1.Health" {
		return p.isHostAllowed(targetURL.Host)
	}

	// Determine the expected endpoint URLs for this service
	var expectedEndpoints []string
	if p.serviceEndpoints != nil {
		if eps, found := p.serviceEndpoints[serviceName]; found && len(eps) > 0 {
			expectedEndpoints = eps
		}
	}
	if len(expectedEndpoints) == 0 {
		if p.serverURL != "" {
			expectedEndpoints = append(expectedEndpoints, p.serverURL)
		}
		if p.reflectionURL != "" {
			expectedEndpoints = append(expectedEndpoints, p.reflectionURL)
		}
	}

	if len(expectedEndpoints) == 0 {
		if len(p.allowedProxyHosts) > 0 {
			return p.isHostAllowed(targetURL.Host)
		}
		return true
	}

	for _, expectedEndpointStr := range expectedEndpoints {
		expectedURL, err := url.Parse(expectedEndpointStr)
		if err != nil {
			continue
		}

		if !strings.EqualFold(targetURL.Scheme, expectedURL.Scheme) {
			continue
		}

		if !strings.EqualFold(targetURL.Host, expectedURL.Host) {
			continue
		}

		expectedPath := strings.TrimSuffix(expectedURL.Path, "/")
		expectedFullSuffix := "/" + serviceName + "/" + methodName
		expectedFullPath := expectedPath + expectedFullSuffix

		if targetURL.Path == expectedFullPath {
			return true
		}
	}

	return false
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

	if !p.isTargetAllowed(targetURL, r.Host) {
		http.Error(w, fmt.Sprintf("Target URL %q is not allowed by proxy policy", targetURLStr), http.StatusForbidden)
		return
	}

	// Create request copy
	proxyReq, err := http.NewRequestWithContext(r.Context(), r.Method, targetURLStr, r.Body)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to create request: %v", err), http.StatusInternalServerError)
		return
	}

	contentType := r.Header.Get("Content-Type")
	// Translate to gRPC if it's a gRPC-Web request and X-Translate-To-Grpc is true
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
	if targetURL.Scheme == "http" {
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
		if kLower == "connection" || kLower == "keep-alive" || kLower == "transfer-encoding" ||
			strings.HasPrefix(kLower, "access-control-") {
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

	if !p.isTargetAllowed(targetURL, r.Host) {
		_ = c.WriteJSON(map[string]interface{}{"status": 403, "error": fmt.Sprintf("Target URL %q is not allowed by proxy policy", initMsg.URL)})
		return
	}

	pr, pw := io.Pipe()

	proxyReq, err := http.NewRequestWithContext(r.Context(), http.MethodPost, initMsg.URL, pr)
	if err != nil {
		_ = c.WriteJSON(map[string]interface{}{"status": 500, "error": err.Error()})
		return
	}

	proxyReq.Proto = "HTTP/2.0"
	proxyReq.ProtoMajor = 2
	proxyReq.ProtoMinor = 0
	proxyReq.ContentLength = -1

	contentType := ""
	for k, v := range initMsg.Headers {
		if strings.EqualFold(k, "content-type") {
			contentType = v
			break
		}
	}

	translateToGrpc := false
	isGrpcWeb := strings.HasPrefix(contentType, "application/grpc-web")
	if isGrpcWeb {
		for k, v := range initMsg.Headers {
			if strings.EqualFold(k, "x-translate-to-grpc") && v == "true" {
				translateToGrpc = true
				break
			}
		}
	}

	for k, v := range initMsg.Headers {
		kLower := strings.ToLower(k)
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
	if targetURL.Scheme == "http" {
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
			if mt == websocket.TextMessage && strings.TrimSpace(string(message)) == `{"eos":true}` {
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

type Handler struct {
	config          Config
	prefix          string
	staticFS        http.FileSystem
	proxyHandler    *ProxyHandler
	fileServer      http.Handler
	dynamicConfig   []byte
	descriptorBytes []byte
}

// NewHandler creates a new http.Handler for serving ProtoDocs documentation.
func NewHandler(cfg Config) (http.Handler, error) {
	var embedded http.FileSystem
	subFS, err := fs.Sub(embeddedFiles, "dist")
	if err != nil {
		embedded = http.Dir(".")
	} else {
		embedded = http.FS(subFS)
	}

	var staticFS http.FileSystem
	if cfg.LocalPath != "" {
		staticFS = spaFileSystem{fs: layeredFileSystem{primary: http.Dir(cfg.LocalPath), secondary: embedded}}
	} else {
		staticFS = spaFileSystem{fs: embedded}
	}

	// Build dynamic config if any configuration is specified
	var dynamicConfig []byte
	hasConfig := cfg.Title != "" ||
		cfg.LogoText != "" ||
		cfg.LogoURL != "" ||
		cfg.LogoURLLight != "" ||
		cfg.LogoURLDark != "" ||
		cfg.LogoURLCyberpunk != "" ||
		cfg.LoadingMethod != "" ||
		len(cfg.DescriptorFiles) > 0 ||
		cfg.ServerURL != "" ||
		cfg.ReflectionURL != "" ||
		cfg.FrontPageMarkdown != "" ||
		cfg.BottomOfFrontPageMarkdown != "" ||
		len(cfg.ServiceEndpoints) > 0 ||
		len(cfg.PrioritizedPaths) > 0 ||
		len(cfg.HighlightedFiles) > 0 ||
		cfg.Descriptors != nil ||
		cfg.Registry != nil ||
		cfg.BackToText != "" ||
		cfg.BackToURL != "" ||
		cfg.DefaultTab != "" ||
		len(cfg.Protocols) > 0

	if hasConfig {
		serviceEndpoints := make(map[string]*pb.Endpoints)
		if cfg.ServiceEndpoints != nil {
			for k, v := range cfg.ServiceEndpoints {
				serviceEndpoints[k] = &pb.Endpoints{
					Endpoints: v,
				}
			}
		}

		appCfg := &pb.Config{
			Title:                     cfg.Title,
			LogoText:                  cfg.LogoText,
			LogoUrl:                   cfg.LogoURL,
			LogoUrlLight:              cfg.LogoURLLight,
			LogoUrlDark:               cfg.LogoURLDark,
			LogoUrlCyberpunk:          cfg.LogoURLCyberpunk,
			LoadingMethod:             cfg.LoadingMethod,
			DescriptorFiles:           cfg.DescriptorFiles,
			ServerUrl:                 cfg.ServerURL,
			ReflectionUrl:             cfg.ReflectionURL,
			FrontPageMarkdown:         cfg.FrontPageMarkdown,
			BottomOfFrontPageMarkdown: cfg.BottomOfFrontPageMarkdown,
			ServiceEndpoints:          serviceEndpoints,
			PrioritizedPaths:          cfg.PrioritizedPaths,
			HighlightedFiles:          cfg.HighlightedFiles,
			BackToText:                cfg.BackToText,
			BackToUrl:                 cfg.BackToURL,
			Proxy:                     cfg.Proxy,
			DefaultTab:                cfg.DefaultTab,
			Protocols:                 cfg.Protocols,
		}

		// Register in-memory FileDescriptorSet under the default path
		if cfg.Descriptors != nil || cfg.Registry != nil {
			normalizedPath := "/descriptors.binpb"
			found := slices.Contains(appCfg.DescriptorFiles, normalizedPath)
			if !found {
				appCfg.DescriptorFiles = append(appCfg.DescriptorFiles, normalizedPath)
			}
		}

		// Validate configuration at runtime using protovalidate rules
		v, err := protovalidate.New()
		if err != nil {
			return nil, fmt.Errorf("failed to initialize configuration validator: %w", err)
		}
		if err := v.Validate(appCfg); err != nil {
			return nil, fmt.Errorf("invalid configuration: %w", err)
		}

		dynamicConfig, err = protoyaml.MarshalOptions{
			UseProtoNames: true,
		}.Marshal(appCfg)
		if err != nil {
			return nil, fmt.Errorf("failed to generate dynamic configuration: %w", err)
		}
	}

	// Normalize prefix
	prefix := cfg.Prefix
	if prefix != "" {
		if !strings.HasPrefix(prefix, "/") {
			prefix = "/" + prefix
		}
		if !strings.HasSuffix(prefix, "/") {
			prefix = prefix + "/"
		}
	}

	var descriptorBytes []byte
	if cfg.Descriptors != nil {
		var err error
		descriptorBytes, err = proto.Marshal(cfg.Descriptors)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal FileDescriptorSet: %w", err)
		}
	}

	// Build allowed hosts list from configured URLs
	var allowedHosts []string
	addHostFromURL := func(urlStr string) {
		if urlStr == "" {
			return
		}
		u, err := url.Parse(urlStr)
		if err == nil && u.Host != "" {
			hostname := u.Host
			if h, _, err := net.SplitHostPort(u.Host); err == nil {
				hostname = h
			}
			if !slices.Contains(allowedHosts, hostname) {
				allowedHosts = append(allowedHosts, hostname)
			}
		}
	}

	addHostFromURL(cfg.ServerURL)
	addHostFromURL(cfg.ReflectionURL)
	for _, endpoints := range cfg.ServiceEndpoints {
		for _, endpoint := range endpoints {
			addHostFromURL(endpoint)
		}
	}
	for _, ah := range cfg.ProxyAllowedHosts {
		if !slices.Contains(allowedHosts, ah) {
			allowedHosts = append(allowedHosts, ah)
		}
	}

	h := &Handler{
		config:          cfg,
		prefix:          prefix,
		staticFS:        staticFS,
		proxyHandler:    NewProxyHandler(allowedHosts, cfg.Registry, cfg.Descriptors, cfg.ServerURL, cfg.ReflectionURL, cfg.ServiceEndpoints),
		fileServer:      http.FileServer(staticFS),
		dynamicConfig:   dynamicConfig,
		descriptorBytes: descriptorBytes,
	}

	return h, nil
}

func (h *Handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	// Normalize path by removing Prefix
	path := r.URL.Path
	if h.prefix != "" && strings.HasPrefix(path, h.prefix) {
		path = path[len(h.prefix):]
	}
	if !strings.HasPrefix(path, "/") {
		path = "/" + path
	}

	switch path {
	case "/api/health":
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Access-Control-Allow-Origin", "*")
		_, _ = w.Write([]byte(`{"status":"ok","proxy":true,"version":"1.0.0"}`))

	case "/api/proxy":
		h.proxyHandler.ServeHTTP(w, r)

	case "/api/proxy/ws":
		h.proxyHandler.ServeWs(w, r)

	case "/config.yaml":
		w.Header().Set("Content-Type", "application/yaml")
		w.Header().Set("Access-Control-Allow-Origin", "*")
		if len(h.dynamicConfig) > 0 {
			_, _ = w.Write(h.dynamicConfig)
			return
		}
		// Fallback to static config.yaml
		f, err := h.staticFS.Open("config.yaml")
		if err != nil {
			_, _ = w.Write([]byte("{}"))
			return
		}
		defer func() { _ = f.Close() }()
		_, _ = io.Copy(w, f)

	default:
		// Check in-memory descriptors
		if path == "/descriptors.binpb" {
			var data []byte
			var err error
			if h.config.Registry != nil {
				fds := &descriptorpb.FileDescriptorSet{}
				h.config.Registry.RangeFiles(func(fd protoreflect.FileDescriptor) bool {
					fds.File = append(fds.File, protodesc.ToFileDescriptorProto(fd))
					return true
				})
				data, err = proto.Marshal(fds)
				if err != nil {
					http.Error(w, fmt.Sprintf("failed to marshal FileDescriptorSet from registry: %v", err), http.StatusInternalServerError)
					return
				}
			} else if len(h.descriptorBytes) > 0 {
				data = h.descriptorBytes
			}

			if len(data) > 0 {
				w.Header().Set("Access-Control-Allow-Origin", "*")
				w.Header().Set("Content-Type", "application/octet-stream")
				_, _ = w.Write(data)
				return
			}
		}

		// Serve static file
		r2 := new(http.Request)
		*r2 = *r
		r2.URL = new(url.URL)
		*r2.URL = *r.URL
		r2.URL.Path = path
		h.fileServer.ServeHTTP(w, r2)
	}
}
