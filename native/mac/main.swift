import Foundation
import Vision
import Cocoa

// Define the output structure for OCR
struct OCRResult: Codable {
    let text: String
    let confidence: Float
}

// Define the output structure for Clipboard events
struct ClipboardEvent: Codable {
    let type: String
    let sequence: Int
}

struct ErrorResult: Codable {
    let text: String
    let confidence: Float
}

// Helper to print JSON output
func printOutput<T: Encodable>(_ data: T) {
    let encoder = JSONEncoder()
    if let jsonData = try? encoder.encode(data),
       let jsonString = String(data: jsonData, encoding: .utf8) {
        print(jsonString)
        fflush(stdout) // Ensure output is flushed immediately
    }
}

func printError(_ message: String) {
    let errorResult = ErrorResult(text: "ERROR: \(message)", confidence: 0.0)
    printOutput(errorResult)
}

// --- OCR Functionality ---

func performOCR(imagePath: String) {
    let fileURL = URL(fileURLWithPath: imagePath)

    guard let image = NSImage(contentsOf: fileURL),
          let cgImage = image.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
        printError("Failed to load image at \(imagePath)")
        return
    }

    let requestHandler = VNImageRequestHandler(cgImage: cgImage, options: [:])
    let request = VNRecognizeTextRequest { (request, error) in
        if let error = error {
            printError("OCR Error: \(error.localizedDescription)")
            return
        }

        guard let observations = request.results as? [VNRecognizedTextObservation] else {
            printError("No text found")
            return
        }

        let recognizedStrings = observations.compactMap { observation in
            observation.topCandidates(1).first?.string
        }

        let fullText = recognizedStrings.joined(separator: "\n")

        let result = OCRResult(text: fullText, confidence: 1.0)
        printOutput(result)
    }

    // Configure for Japanese and English
    request.recognitionLanguages = ["ja-JP", "en-US"]
    request.recognitionLevel = .accurate

    do {
        try requestHandler.perform([request])
    } catch {
        printError("Failed to perform OCR: \(error.localizedDescription)")
    }
}

func performCaptureAndOCR(x: Int, y: Int, width: Int, height: Int) {
    // Debug log for received coordinates
    // Using stderr for debug logs to avoid polluting JSON stdout
    fputs("DEBUG: Capturing area: x=\(x), y=\(y), w=\(width), h=\(height)\n", stderr)

    // macOS screen coordinates are bottom-left origin in many APIs,
    // but CGWindowListCreateImage uses top-left origin.
    // The x, y passed here should already be in global screen coordinates (top-left).
    if #available(macOS 10.15, *) {
        if !CGPreflightScreenCaptureAccess() {
            CGRequestScreenCaptureAccess()
            printError("Screen recording permission is required. Please grant permission in System Settings > Privacy & Security, then restart the app.")
            return
        }
    }

    let rect = CGRect(x: CGFloat(x), y: CGFloat(y), width: CGFloat(width), height: CGFloat(height))

    guard let cgImage = CGWindowListCreateImage(rect, .optionOnScreenOnly, kCGNullWindowID, .bestResolution) else {
        printError("Failed to capture screen area at (x:\(x), y:\(y), w:\(width), h:\(height)). Check Screen Recording permissions.")
        return
    }

    let requestHandler = VNImageRequestHandler(cgImage: cgImage, options: [:])
    let request = VNRecognizeTextRequest { (request, error) in
        if let error = error {
            printError("OCR Error: \(error.localizedDescription)")
            return
        }

        guard let observations = request.results as? [VNRecognizedTextObservation] else {
            printError("No text found in captured area")
            return
        }

        let recognizedStrings = observations.compactMap { observation in
            observation.topCandidates(1).first?.string
        }

        let fullText = recognizedStrings.joined(separator: "\n")

        let result = OCRResult(text: fullText, confidence: 1.0)
        printOutput(result)
    }

    request.recognitionLanguages = ["ja-JP", "en-US"]
    request.recognitionLevel = .accurate

    do {
        try requestHandler.perform([request])
    } catch {
        printError("Failed to perform OCR on capture: \(error.localizedDescription)")
    }
}

// --- Clipboard Watcher Functionality ---

class ClipboardWatcher {
    private var lastChangeCount: Int
    private var timer: Timer?

    init() {
        self.lastChangeCount = NSPasteboard.general.changeCount
    }

    func start() {
        // Send initial state so the listener knows we started
        printOutput(ClipboardEvent(type: "init", sequence: self.lastChangeCount))

        // Poll every 0.1 seconds for better responsiveness
        self.timer = Timer.scheduledTimer(withTimeInterval: 0.1, repeats: true) { [weak self] _ in
            self?.checkClipboard()
        }

        // Keep the run loop alive
        RunLoop.main.run()
    }

    func checkClipboard() {
        let currentCount = NSPasteboard.general.changeCount
        if currentCount != lastChangeCount {
            lastChangeCount = currentCount
            printOutput(ClipboardEvent(type: "change", sequence: currentCount))
        }
    }
}

// --- Main Entry Point ---

let args = CommandLine.arguments

// Version / Build Info for debugging
let buildInfo = "Build: 2026-02-18 09:40 JST"

if args.count < 2 {
    printError("Usage: nexus-native <command> [args...] (\(buildInfo))")
    exit(1)
}

let command = args[1]

switch command {
case "version":
    print(buildInfo)
    exit(0)

case "ocr":
    if args.count < 3 {
        printError("Usage: nexus-native ocr <image_path>")
        exit(1)
    }
    let imagePath = args[2]
    performOCR(imagePath: imagePath)

case "capture":
    if args.count < 6 {
        printError("Usage: nexus-native capture <x> <y> <width> <height>")
        exit(1)
    }
    guard let x = Int(args[2]),
          let y = Int(args[3]),
          let w = Int(args[4]),
          let h = Int(args[5]) else {
        printError("Invalid capture coordinates: \(args[2]), \(args[3]), \(args[4]), \(args[5])")
        exit(1)
    }
    performCaptureAndOCR(x: x, y: y, width: w, height: h)

case "watch-clipboard":
    let watcher = ClipboardWatcher()
    watcher.start()

default:
    printError("Unknown command: \(command). \(buildInfo)")
    exit(1)
}
