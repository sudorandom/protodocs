# protodoc

> [!CAUTION]
> This project is under active development and is not yet ready for use.
> There are many bugs and incomplete features.

`protodoc` is a web-based documentation browser for Protocol Buffer definitions. It allows you to navigate through your `.proto` files, view message and service definitions, and understand the structure of your APIs.

## Features

*   Browse a list of packages
*   View detailed information about messages and services
*   See the source code of your `.proto` files
*   Expandable and collapsible sections for easy navigation
*   Render comments as markdown

## Screenshots

| Message Detail | Service Detail (Try-it-now) |
| :---: | :---: |
| ![Message Detail](./e2e/screenshots/01-message-detail.png) | ![Service Detail](./e2e/screenshots/02-service-detail.png) |

| File Source (DSL) | Search Results |
| :---: | :---: |
| ![File Source](./e2e/screenshots/03-file-source.png) | ![Search Results](./e2e/screenshots/04-search-results.png) |

## Getting Started

To get a local copy up and running, follow these simple steps.

### Prerequisites

*   [Node.js](https://nodejs.org/en/) (v20 or later)
*   [pnpm](https://pnpm.io/)

### Installation

1.  Clone the repo
    ```sh
    git clone https://github.com/your_username/protodoc.git
    ```
2.  Install NPM packages
    ```sh
    pnpm install
    ```

### Usage

To start the development server, run:

```sh
pnpm dev
```

This will open a browser window with the application running on `http://localhost:5173`.

If you are running the full stack locally and want the Vite development server to proxy API requests to the Go backend, provide the `PROXY_TARGET` environment variable with the backend's address:

```sh
PROXY_TARGET="http://127.0.0.1:8080" pnpm dev
```

To build the application for production, run:

```sh
pnpm build
```

This will create a `dist` directory with the production-ready files.

## Running with Docker

### 1. Running the Pre-built Image from Docker Hub

You can pull and run the pre-built image directly from Docker Hub:

```sh
docker run -d -p 8080:80 sudorandom/protodocs:latest
```

Now open `http://localhost:8080` in your web browser.

### 2. Mounting Custom Descriptors (`.binpb`) at Runtime

You can mount your own custom serialized protobuf descriptors file (`.binpb` / `.pb`) directly into the container at runtime.

To generate a descriptor set from your `.proto` files using `buf` or `protoc`:

```sh
# Using buf:
buf build -o my-descriptors.binpb

# Or using protoc:
protoc --descriptor_set_out=my-descriptors.binpb --include_imports your_file.proto
```

You can then run the Docker container, mounting your descriptor file into the Nginx web root directory:

```sh
docker run -d -p 8080:80 \
  -v $(pwd)/my-descriptors.binpb:/usr/share/nginx/html/custom.binpb \
  sudorandom/protodocs:latest
```

Access your custom documentation in the browser using the query parameter:
`http://localhost:8080/?descriptors=/custom.binpb`

### 3. Building the Docker Image Locally

If you make modifications or wish to package your custom static assets into a custom Docker image, first build the production bundle locally (using your local `mise` dependencies), then build the Docker image:

```sh
# Build the application locally
pnpm build

# Build the Docker image locally
docker build -t protodocs .

# Run the local image
docker run -d -p 8080:80 protodocs
```


## Go Library Usage

ProtoDocs can be imported as a Go library to serve your API documentation directly from your Go web server, similar to how swagger-ui libraries work.

A complete runnable example is available in the [examples/simple](file:///Users/kevin/Projects/protodocs/examples/simple) directory.

### Installation

```sh
go get github.com/sudorandom/protodocs
```

### Basic Example

You can instantiate a handler using `protodocs.NewHandler` and register it with `http.Handle` or any Go router:

```go
package main

import (
	"log"
	"net/http"

	"github.com/sudorandom/protodocs"
	"google.golang.org/protobuf/reflect/protoregistry"
)

func main() {
	// Initialize the ProtoDocs handler using the global protobuf registry.
	// This automatically registers all compiled protobuf files in your application.
	handler, err := protodocs.NewHandler(protodocs.Config{
		Title:    "My Service Documentation",
		LogoText: "My Service",
		Registry: protoregistry.GlobalFiles,
		// Host ProtoDocs under a prefix path
		Prefix:   "/docs/",
	})
	if err != nil {
		log.Fatalf("Failed to initialize ProtoDocs: %v", err)
	}

	// Register the handler
	http.Handle("/docs/", handler)

	log.Println("Serving docs at http://localhost:8080/docs/")
	if err := http.ListenAndServe(":8080", nil); err != nil {
		log.Fatal(err)
	}
}
```

### Configuration Options

The `protodocs.Config` struct supports the following options:

*   **`Title`**: The title displayed in the browser tab.
*   **`LogoText`**: The logo text displayed in the header.
*   **`LogoURL`**: The URL to a custom logo image.
*   **`LoadingMethod`**: The default schema fetching method (`"http"`, `"grpc-web"`, or `"connect"`).
*   **`DescriptorFiles`**: URLs or paths to load pre-compiled protobuf descriptor sets.
*   **`ServerURL`**: Default endpoint URL for reflection and sending RPC requests.
*   **`ReflectionURL`**: Default endpoint URL for reflection.
*   **`DefaultFile`**: Path of the default `.proto` file to focus on.
*   **`Prefix`**: The URL prefix under which the handler is hosted (e.g. `"/docs/"`). The router will automatically strip this prefix before serving assets.
*   **`Descriptors`**: In-memory `*descriptorpb.FileDescriptorSet`. It is automatically registered and served at `"/descriptors.binpb"` for the UI to load.
*   **`Registry`**: Optional `*protoregistry.Files` registry. If specified, the handler will dynamically construct the `FileDescriptorSet` from the registry on each request. This allows any runtime updates to the registry to be immediately reflected in the documentation.
*   **`MarkdownFiles`**: In-memory mapping of virtual path (e.g., `"/home.md"`) to markdown string content.
*   **`LocalPath`**: Local filesystem path to serve override static assets from (instead of embedded files).

## Static Website Distribution & Configuration

ProtoDocs runs entirely as a client-side static web application. Once built, you can distribute a pre-compiled package of the `dist/` directory to host your documentation statically (e.g. on Nginx, GitHub Pages, Netlify, or an S3 bucket). 

### Generating a pre-built static archive package

To generate a lightweight, pre-built static website archive (excluding extra testing descriptors and keeping only the code bundle and the example Eliza API config/descriptors):

```sh
pnpm package # or npm run package
```

This compiles the application and produces a lightweight `protodocs-static.tar.gz` archive in the root directory. This archive contains:
- `index.html` & `404.html` (the client router entry points)
- `assets/` (bundled JS & CSS)
- `config.json` (configured to load the Eliza sample API by default)
- `eliza.binpb` (the compiled Eliza gRPC-Web/Connect descriptor set)
- `home.md` & `footer.md` (the template landing/footer markdown files)

To customize the documentation for your team, you do not need to recompile the React source code. Instead, you only need to extract this archive onto your web host, and modify the following files in the web root:
1. `config.json` (defines the configurations and file paths to load).
2. Your compiled protobuf binary descriptor sets (`.binpb` or `.pb` files).
3. `home.md` (renders custom markdown content on the landing/welcome page).
4. `footer.md` (renders custom markdown content on the page footer).

### How `config.json` works

At startup, the pre-built ProtoDocs application attempts to fetch `/config.json` from the web root. Below is an example schema showing all available configurations:

```json
{
  "title": "My API Docs",
  "logo_text": "My API Docs",
  "logo_url": "/custom-logo.svg",
  "loading_method": "http",
  "descriptor_files": [
    "/my-descriptors.binpb"
  ],
  "server_url": "http://127.0.0.1",
  "default_file": "my-app/v1/service.proto",
  "front_page_markdown_file": "/home.md",
  "bottom_of_front_page_markdown_file": "/footer.md"
}
```

#### Fields Description:
* **`title` / `logo_text`**: The title displayed in the browser tab and at the top of the sidebar.
* **`logo_url`**: Optional URL to a custom logo image file (e.g., SVG/PNG) displayed in the sidebar header.
* **`loading_method`**: Schema fetching method. Use `"http"` for pre-compiled descriptor files, or `"grpc-web"` / `"connect"` to query schemas dynamically from a live server via Reflection API.
* **`descriptor_files`**: An array of URLs pointing to the binary protobuf descriptor sets (`.binpb` or `.pb` files) to fetch and index.
* **`server_url`**: Default endpoint URL to use for both live Server Reflection APIs and the interactive "Try it out" RPC client console.
* **`default_file`**: Path of the default `.proto` file to display on initial page load (if none is specified in the URL hash).
* **`front_page_markdown_file`**: Path to the markdown file (e.g., `/home.md`) containing content for the landing welcome page.
* **`bottom_of_front_page_markdown_file`**: Path to the markdown file (e.g., `/footer.md`) containing custom footer content.

## Contributing

Contributions are what make the open source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

If you have a suggestion that would make this better, please fork the repo and create a pull request. You can also simply open an issue with the tag "enhancement".

Don't forget to give the project a star! Thanks again!

1.  Fork the Project
2.  Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3.  Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4.  Push to the Branch (`git push origin feature/AmazingFeature`)
5.  Open a Pull Request
