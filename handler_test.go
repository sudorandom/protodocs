package protodocs

import (
	"bytes"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"buf.build/go/protoyaml"
	"github.com/gorilla/websocket"
	pb "github.com/sudorandom/protodocs/gen/proto/protodocs/v1"
	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/reflect/protodesc"
	"google.golang.org/protobuf/reflect/protoregistry"
	"google.golang.org/protobuf/types/descriptorpb"
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

	bodyBytes, err := io.ReadAll(res.Body)
	if err != nil {
		t.Fatalf("failed to read config.yaml body: %v", err)
	}
	var appCfg pb.Config
	if err := protoyaml.Unmarshal(bodyBytes, &appCfg); err != nil {
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

	// 4. Get /api/health
	resHealth, err := http.Get(ts.URL + "/api/health")
	if err != nil {
		t.Fatalf("failed to get api/health: %v", err)
	}
	defer func() { _ = resHealth.Body.Close() }()

	if resHealth.StatusCode != http.StatusOK {
		t.Errorf("expected status 200 for api/health, got %d", resHealth.StatusCode)
	}
}

func TestParseBSRModuleRef(t *testing.T) {
	tests := []struct {
		name        string
		module      string
		refOverride string
		want        bsrModuleRef
		wantErr     bool
	}{
		{
			name:   "default ref",
			module: "buf.build/googleapis/googleapis",
			want: bsrModuleRef{
				Owner:  "googleapis",
				Module: "googleapis",
				Ref:    "main",
			},
		},
		{
			name:   "shorthand module",
			module: "googleapis/googleapis",
			want: bsrModuleRef{
				Owner:  "googleapis",
				Module: "googleapis",
				Ref:    "main",
			},
		},
		{
			name:   "inline ref",
			module: "BUF.BUILD/googleapis/googleapis:v1.2.3",
			want: bsrModuleRef{
				Owner:  "googleapis",
				Module: "googleapis",
				Ref:    "v1.2.3",
			},
		},
		{
			name:        "override ref",
			module:      "buf.build/googleapis/googleapis:v1.2.3",
			refOverride: "main",
			want: bsrModuleRef{
				Owner:  "googleapis",
				Module: "googleapis",
				Ref:    "main",
			},
		},
		{name: "url is rejected", module: "https://buf.build/googleapis/googleapis", wantErr: true},
		{name: "non buf host is rejected", module: "example.com/googleapis/googleapis", wantErr: true},
		{name: "missing module part", module: "googleapis", wantErr: true},
		{name: "bad ref", module: "buf.build/googleapis/googleapis:../main", wantErr: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := parseBSRModuleRef(tt.module, tt.refOverride)
			if tt.wantErr {
				if err == nil {
					t.Fatalf("expected error")
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if got != tt.want {
				t.Fatalf("got %+v, want %+v", got, tt.want)
			}
		})
	}
}

func TestTokenForBSRHost(t *testing.T) {
	tests := []struct {
		name string
		raw  string
		host string
		want string
	}{
		{name: "plain token", raw: "token", host: "buf.build", want: "token"},
		{name: "host token match", raw: "first@example.com, second@buf.build", host: "buf.build", want: "second"},
		{name: "host token no match", raw: "first@example.com", host: "buf.build", want: ""},
		{name: "single at token", raw: "token@buf.build", host: "buf.build", want: "token"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := tokenForBSRHost(tt.raw, tt.host); got != tt.want {
				t.Fatalf("got %q, want %q", got, tt.want)
			}
		})
	}
}

func TestBSRDescriptorEndpointValidation(t *testing.T) {
	handler, err := NewHandler(Config{Proxy: true})
	if err != nil {
		t.Fatalf("failed to create handler: %v", err)
	}

	ts := httptest.NewServer(handler)
	defer ts.Close()

	res, err := http.Post(ts.URL+"/api/bsr/descriptor", "application/json", bytes.NewBufferString(`{"modules":[{"module":"localhost/acme/weather"}]}`))
	if err != nil {
		t.Fatalf("failed to post BSR request: %v", err)
	}
	defer func() { _ = res.Body.Close() }()

	if res.StatusCode != http.StatusBadRequest {
		t.Fatalf("expected status 400, got %d", res.StatusCode)
	}
}

func TestBSRDescriptorEndpointDisabledWithoutProxy(t *testing.T) {
	handler, err := NewHandler(Config{})
	if err != nil {
		t.Fatalf("failed to create handler: %v", err)
	}

	ts := httptest.NewServer(handler)
	defer ts.Close()

	res, err := http.Post(ts.URL+"/api/bsr/descriptor", "application/json", bytes.NewBufferString(`{"modules":[{"module":"buf.build/acme/weather"}]}`))
	if err != nil {
		t.Fatalf("failed to post BSR request: %v", err)
	}
	defer func() { _ = res.Body.Close() }()

	if res.StatusCode != http.StatusNotFound {
		t.Fatalf("expected status 404, got %d", res.StatusCode)
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
		Title:       "Custom API Portal",
		LogoText:    "MyLogo",
		Descriptors: descriptorSet,
		FrontPageSections: []FrontPageSection{
			{Type: "markdown", Markdown: markdownContent},
		},
		BackToText: "Back to Home",
		BackToURL:  "https://example.com/home",
		DefaultTab: "files",
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

	bodyBytes, err := io.ReadAll(res.Body)
	if err != nil {
		t.Fatalf("failed to read config.yaml body: %v", err)
	}
	var appCfg pb.Config
	if err := protoyaml.Unmarshal(bodyBytes, &appCfg); err != nil {
		t.Fatalf("failed to decode config.yaml: %v", err)
	}

	if appCfg.Title != "Custom API Portal" {
		t.Errorf("expected title 'Custom API Portal', got %q", appCfg.Title)
	}

	if appCfg.BackToText != "Back to Home" {
		t.Errorf("expected back_to_text 'Back to Home', got %q", appCfg.BackToText)
	}

	if appCfg.BackToUrl != "https://example.com/home" {
		t.Errorf("expected back_to_url 'https://example.com/home', got %q", appCfg.BackToUrl)
	}

	if appCfg.DefaultTab != "files" {
		t.Errorf("expected default_tab 'files', got %q", appCfg.DefaultTab)
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

	if len(appCfg.FrontPageSections) != 1 {
		t.Fatalf("expected 1 front page section, got %d", len(appCfg.FrontPageSections))
	}
	if appCfg.FrontPageSections[0].Type != "markdown" {
		t.Errorf("expected front page section type 'markdown', got %q", appCfg.FrontPageSections[0].Type)
	}
	if appCfg.FrontPageSections[0].Markdown != markdownContent {
		t.Errorf("expected front page section markdown %q, got %q", markdownContent, appCfg.FrontPageSections[0].Markdown)
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
		Name:   &name1,
		Syntax: proto.String("proto3"),
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
		Name:   &name2,
		Syntax: proto.String("proto3"),
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

func TestProxySecurityPolicies(t *testing.T) {
	reg := &protoregistry.Files{}
	name := "eliza.proto"

	fd, err := protodesc.NewFile(&descriptorpb.FileDescriptorProto{
		Name:    &name,
		Package: proto.String("connectrpc.eliza.v1"),
		Syntax:  proto.String("proto3"),
		MessageType: []*descriptorpb.DescriptorProto{
			{
				Name: proto.String("SayRequest"),
			},
			{
				Name: proto.String("SayResponse"),
			},
		},
		Service: []*descriptorpb.ServiceDescriptorProto{
			{
				Name: proto.String("ElizaService"),
				Method: []*descriptorpb.MethodDescriptorProto{
					{
						Name:       proto.String("Say"),
						InputType:  proto.String(".connectrpc.eliza.v1.SayRequest"),
						OutputType: proto.String(".connectrpc.eliza.v1.SayResponse"),
					},
				},
			},
		},
	}, nil)
	if err != nil {
		t.Fatalf("failed to create protoreflect.FileDescriptor: %v", err)
	}
	if err := reg.RegisterFile(fd); err != nil {
		t.Fatalf("failed to register file: %v", err)
	}

	handler, err := NewHandler(Config{
		Proxy:     true,
		ServerURL: "http://default-endpoint.com",
		ServiceEndpoints: map[string][]string{
			"connectrpc.eliza.v1.ElizaService": {
				"http://eliza-dev.com",
				"http://eliza-stage.com",
			},
		},
		Registry: reg,
	})
	if err != nil {
		t.Fatalf("failed to create handler: %v", err)
	}

	ts := httptest.NewServer(handler)
	defer ts.Close()

	client := &http.Client{}

	sendProxyReq := func(targetURL string) (int, string) {
		req, err := http.NewRequest("POST", ts.URL+"/api/proxy", nil)
		if err != nil {
			t.Fatalf("failed to create request: %v", err)
		}
		req.Header.Set("X-Target-Url", targetURL)
		req.Header.Set("Content-Type", "application/json")
		res, err := client.Do(req)
		if err != nil {
			t.Fatalf("failed to send request: %v", err)
		}
		defer func() { _ = res.Body.Close() }()
		body, _ := io.ReadAll(res.Body)
		return res.StatusCode, string(body)
	}

	// 1. Dev endpoint -> ALLOWED
	status, body := sendProxyReq("http://eliza-dev.com/connectrpc.eliza.v1.ElizaService/Say")
	if status == http.StatusForbidden {
		t.Errorf("expected eliza-dev request to be allowed, got 403 with body: %s", body)
	}

	// 2. Stage endpoint -> ALLOWED
	status, body = sendProxyReq("http://eliza-stage.com/connectrpc.eliza.v1.ElizaService/Say")
	if status == http.StatusForbidden {
		t.Errorf("expected eliza-stage request to be allowed, got 403 with body: %s", body)
	}

	// 3. demo.connectrpc.com -> BLOCKED (even though allowed host because specific endpoints are configured)
	status, _ = sendProxyReq("http://demo.connectrpc.com/connectrpc.eliza.v1.ElizaService/Say")
	if status != http.StatusForbidden {
		t.Errorf("expected demo.connectrpc.com request to be blocked, got status %d", status)
	}

	// 4. Loopback/localhost custom port -> ALLOWED
	status, body = sendProxyReq("http://127.0.0.1:8080/connectrpc.eliza.v1.ElizaService/Say")
	if status == http.StatusForbidden {
		t.Errorf("expected 127.0.0.1 request to be allowed, got 403 with body: %s", body)
	}

	// 5. Default endpoint -> BLOCKED (since specific endpoints are configured for ElizaService)
	status, _ = sendProxyReq("http://default-endpoint.com/connectrpc.eliza.v1.ElizaService/Say")
	if status != http.StatusForbidden {
		t.Errorf("expected default-endpoint request to be blocked since specific endpoints are configured, got status %d", status)
	}

	// 6. Malicious endpoint -> BLOCKED
	status, _ = sendProxyReq("http://malicious.com/connectrpc.eliza.v1.ElizaService/Say")
	if status != http.StatusForbidden {
		t.Errorf("expected malicious request to be 403, got %d", status)
	}

	// 7. Unknown method on stage endpoint -> BLOCKED
	status, _ = sendProxyReq("http://eliza-stage.com/connectrpc.eliza.v1.ElizaService/Unknown")
	if status != http.StatusForbidden {
		t.Errorf("expected request to disallowed method to be 403, got %d", status)
	}

	// 8. Reflection request on allowed proxy host -> ALLOWED
	status, body = sendProxyReq("http://eliza-dev.com/grpc.reflection.v1alpha.ServerReflection/ServerReflectionInfo")
	if status == http.StatusForbidden {
		t.Errorf("expected reflection request to be allowed, got 403 with body: %s", body)
	}
}

func TestServeWs_Bidi(t *testing.T) {
	// 1. Create a mock target server that expects HTTP/2 (h2c) and verifies ProtoMajor >= 2
	mockTargetHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.ProtoMajor < 2 {
			w.WriteHeader(http.StatusHTTPVersionNotSupported)
			_, _ = w.Write([]byte("HTTP Version Not Supported"))
			return
		}
		// Echo request headers and body back in chunks
		w.Header().Set("Content-Type", "application/grpc-web+proto")
		w.WriteHeader(http.StatusOK)
		if flusher, ok := w.(http.Flusher); ok {
			flusher.Flush()
		}

		buf := make([]byte, 1024)
		for {
			n, err := r.Body.Read(buf)
			if n > 0 {
				_, _ = w.Write(buf[:n])
			}
			if err != nil {
				break
			}
		}
	})

	mockTarget := httptest.NewUnstartedServer(mockTargetHandler)
	var protocols http.Protocols
	protocols.SetUnencryptedHTTP2(true)
	protocols.SetHTTP1(true)
	mockTarget.Config.Protocols = &protocols
	mockTarget.Start()
	defer mockTarget.Close()

	// 2. Setup the proxy handler allowing loopback
	handler, err := NewHandler(Config{
		Proxy:    true,
		Registry: &protoregistry.Files{},
	})
	if err != nil {
		t.Fatalf("failed to create handler: %v", err)
	}

	proxyServer := httptest.NewServer(handler)
	defer proxyServer.Close()

	// 3. Connect to /api/proxy/ws via WebSocket
	wsURL := "ws" + strings.TrimPrefix(proxyServer.URL, "http") + "/api/proxy/ws"
	wsConn, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err != nil {
		t.Fatalf("failed to connect to websocket: %v", err)
	}
	defer func() { _ = wsConn.Close() }()

	// 4. Send initial message
	initMsg := map[string]interface{}{
		"url": mockTarget.URL + "/connectrpc.eliza.v1.ElizaService/Say",
		"headers": map[string]string{
			"Content-Type": "application/grpc-web+proto",
		},
	}
	if err := wsConn.WriteJSON(initMsg); err != nil {
		t.Fatalf("failed to write init msg: %v", err)
	}

	// 5. Send a stream of messages
	payload := []byte("hello stream")
	if err := wsConn.WriteMessage(websocket.BinaryMessage, payload); err != nil {
		t.Fatalf("failed to send payload: %v", err)
	}

	eosMsg := map[string]bool{"eos": true}
	if err := wsConn.WriteJSON(eosMsg); err != nil {
		t.Fatalf("failed to send eos: %v", err)
	}

	// 6. Read response headers/status
	var statusMsg map[string]interface{}
	if err := wsConn.ReadJSON(&statusMsg); err != nil {
		t.Fatalf("failed to read response status: %v", err)
	}

	if statusMsg["status"] != float64(http.StatusOK) {
		t.Fatalf("expected status 200, got %v: %v", statusMsg["status"], statusMsg["error"])
	}

	// 7. Read response body chunk
	_, respBody, err := wsConn.ReadMessage()
	if err != nil {
		t.Fatalf("failed to read response body: %v", err)
	}

	if string(respBody) != "hello stream" {
		t.Errorf("expected 'hello stream', got %q", string(respBody))
	}
}

func TestNewHandler_InvalidConfig(t *testing.T) {
	tests := []struct {
		name    string
		config  Config
		wantErr string
	}{
		{
			name: "invalid loading_method",
			config: Config{
				Title:         "Portal",
				LoadingMethod: "ftp",
			},
			wantErr: "loading_method",
		},
		{
			name: "invalid default_tab",
			config: Config{
				Title:      "Portal",
				DefaultTab: "invalid_tab",
			},
			wantErr: "default_tab",
		},
		{
			name: "invalid protocols",
			config: Config{
				Title:     "Portal",
				Protocols: []string{"connect", "invalid_proto"},
			},
			wantErr: "protocols",
		},
		{
			name: "duplicate protocols",
			config: Config{
				Title:     "Portal",
				Protocols: []string{"connect", "connect"},
			},
			wantErr: "protocols",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := NewHandler(tt.config)
			if err == nil {
				t.Fatalf("expected error containing %q, got nil", tt.wantErr)
			}
			if !strings.Contains(err.Error(), tt.wantErr) {
				t.Errorf("expected error containing %q, got %v", tt.wantErr, err)
			}
		})
	}
}

func TestProxyWildcardSecurityPolicy(t *testing.T) {
	handler, err := NewHandler(Config{
		Proxy:             true,
		ProxyAllowedHosts: []string{"*"},
	})
	if err != nil {
		t.Fatalf("failed to create handler: %v", err)
	}

	ts := httptest.NewServer(handler)
	defer ts.Close()

	client := &http.Client{}

	sendProxyReq := func(targetURL string) int {
		req, err := http.NewRequest("POST", ts.URL+"/api/proxy", nil)
		if err != nil {
			t.Fatalf("failed to create request: %v", err)
		}
		req.Header.Set("X-Target-Url", targetURL)
		req.Header.Set("Content-Type", "application/json")
		res, err := client.Do(req)
		if err != nil {
			t.Fatalf("failed to send request: %v", err)
		}
		defer func() { _ = res.Body.Close() }()
		return res.StatusCode
	}

	// Any external endpoint should NOT return 403 Forbidden with wildcard allowed hosts configured.
	status := sendProxyReq("http://non-existent-wildcard-target-12345.com/connectrpc.eliza.v1.ElizaService/Say")
	if status == http.StatusForbidden {
		t.Errorf("expected request to be allowed with wildcard, got 403 Forbidden")
	}
}
