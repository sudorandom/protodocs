package main

import (
	"context"
	"os"
	"sync"

	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// App struct
type App struct {
	ctx         context.Context
	proxyUrl    string
	initialFile string
	mu          sync.Mutex
}

// NewApp creates a new App struct
func NewApp(proxyUrl string) *App {
	return &App{
		proxyUrl: proxyUrl,
	}
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) startup(ctx context.Context) {
	a.mu.Lock()
	a.ctx = ctx
	fileToEmit := a.initialFile
	a.mu.Unlock()

	if fileToEmit != "" {
		go func() {
			wailsRuntime.EventsEmit(ctx, "open-file", fileToEmit)
		}()
	}
}

// GetProxyUrl returns the address of the background proxy server
func (a *App) GetProxyUrl() string {
	return a.proxyUrl
}

// HandleFileOpen is called by the macOS OnFileOpen handler when a file association is triggered
func (a *App) HandleFileOpen(filePath string) {
	a.mu.Lock()
	a.initialFile = filePath
	ctx := a.ctx
	a.mu.Unlock()

	if ctx != nil {
		wailsRuntime.EventsEmit(ctx, "open-file", filePath)
	}
}

// GetInitialFile returns any file that was opened on launch and clears it
func (a *App) GetInitialFile() string {
	a.mu.Lock()
	defer a.mu.Unlock()
	file := a.initialFile
	a.initialFile = ""
	return file
}

// ReadFileBytes reads raw bytes of the file at path and returns them to the frontend
func (a *App) ReadFileBytes(filePath string) ([]byte, error) {
	return os.ReadFile(filePath)
}
