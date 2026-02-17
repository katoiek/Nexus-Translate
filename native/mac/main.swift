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

        // Poll every 0.5 seconds
        self.timer = Timer.scheduledTimer(withTimeInterval: 0.5, repeats: true) { [weak self] _ in
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

if args.count < 2 {
    printError("Usage: nexus-native <command> [args...]")
    exit(1)
}

let command = args[1]

switch command {
case "ocr":
    if args.count < 3 {
        printError("Usage: nexus-native ocr <image_path>")
        exit(1)
    }
    let imagePath = args[2]
    performOCR(imagePath: imagePath)

case "watch-clipboard":
    let watcher = ClipboardWatcher()
    watcher.start()

default:
    printError("Unknown command: \(command)")
    exit(1)
}
