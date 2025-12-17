import SwiftUI
import WebKit

// CONFIGURATION
let TARGET_URL = "http://127.0.0.1:3000"

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
