#!/bin/bash

# Configuration
APP_NAME="YapMatePreview"
IOS_DIR="./ios/$APP_NAME"
SOURCES_DIR="$IOS_DIR/Sources"
LOCAL_URL="http://localhost:3000"

# 1. Check for xcodegen
if ! command -v xcodegen &> /dev/null; then
    echo "❌ xcodegen is required but not installed."
    echo "Please run: brew install xcodegen"
    exit 1
fi

echo "🚀 Creating iOS Preview Project in $IOS_DIR..."

# 2. Create Directory Structure
mkdir -p "$SOURCES_DIR"

# 3. Create project.yml for xcodegen
cat <<EOF > "$IOS_DIR/project.yml"
name: $APP_NAME
options:
  bundleIdPrefix: uk.co.yapmate
targets:
  $APP_NAME:
    type: application
    platform: iOS
    deploymentTarget: "16.0"
    sources: [Sources]
    info:
      path: Sources/Info.plist
      properties:
        CFBundleDisplayName: "YapMate (Dev)"
        CFBundleShortVersionString: "0.1.0"
        CFBundleVersion: "1"
        UILaunchScreen: {}
        NSAppTransportSecurity:
          NSAllowsArbitraryLoads: true
EOF

# 4. Create App Entry Point
cat <<EOF > "$SOURCES_DIR/${APP_NAME}App.swift"
import SwiftUI

@main
struct ${APP_NAME}App: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}
EOF

# 5. Create ContentView with WebView
cat <<EOF > "$SOURCES_DIR/ContentView.swift"
import SwiftUI
import WebKit

// CONFIGURATION
let TARGET_URL = "$LOCAL_URL"

struct ContentView: View {
    @State private var webViewStore = WebViewStore()

    var body: some View {
        ZStack {
            WebView(webView: webViewStore.webView)
                .edgesIgnoringSafeArea(.bottom)
                .onAppear {
                    if let url = URL(string: TARGET_URL) {
                        webViewStore.webView.load(URLRequest(url: url))
                    }
                }
            
            // Optional: Simple reload button overlay for dev
            VStack {
                Spacer()
                HStack {
                    Spacer()
                    Button(action: {
                        webViewStore.webView.reload()
                    }) {
                        Image(systemName: "arrow.clockwise.circle.fill")
                            .font(.system(size: 44))
                            .foregroundColor(.yellow)
                            .shadow(radius: 2)
                    }
                    .padding()
                }
            }
        }
    }
}

class WebViewStore: ObservableObject {
    let webView: WKWebView
    
    init() {
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        self.webView = WKWebView(frame: .zero, configuration: config)
        self.webView.allowsBackForwardNavigationGestures = true
    }
}

struct WebView: UIViewRepresentable {
    let webView: WKWebView
    
    func makeUIView(context: Context) -> WKWebView {
        return webView
    }
    
    func updateUIView(_ uiView: WKWebView, context: Context) {
        // No-op to prevent reload on state changes
    }
}
EOF

# 6. Generate Xcode Project
cd "$IOS_DIR"
xcodegen generate

echo "✅ Project created at $IOS_DIR/$APP_NAME.xcodeproj"
