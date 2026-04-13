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
    fputs("DEBUG: Capturing area: x=\(x), y=\(y), w=\(width), h=\(height)\n", stderr)

    // macOS 15以降でCGWindowListCreateImageが廃止のため、screencaptureコマンドで代替
    let tempPath = "/tmp/nexus-capture-\(UUID().uuidString).png"

    let task = Process()
    task.executableURL = URL(fileURLWithPath: "/usr/sbin/screencapture")
    // -R: 指定矩形をキャプチャ (x,y,w,h形式)
    // -x: 効果音なし
    task.arguments = ["-R", "\(x),\(y),\(width),\(height)", "-x", tempPath]

    do {
        try task.run()
        task.waitUntilExit()

        let fileManager = FileManager.default
        if fileManager.fileExists(atPath: tempPath) {
            performOCR(imagePath: tempPath)
            try? fileManager.removeItem(atPath: tempPath)
        } else {
            printError("Failed to capture screen area at (x:\(x), y:\(y), w:\(width), h:\(height)). Check Screen Recording permissions.")
        }
    } catch {
        printError("Failed to launch screencapture: \(error.localizedDescription)")
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

case "interactive-capture":
    let tempPath = "/tmp/nexus-capture-\(UUID().uuidString).png"

    let task = Process()
    task.executableURL = URL(fileURLWithPath: "/usr/sbin/screencapture")
    // -i: interactive mode
    // -x: do not play sounds
    task.arguments = ["-i", "-x", tempPath]

    do {
        try task.run()
        task.waitUntilExit()

        let fileManager = FileManager.default
        if fileManager.fileExists(atPath: tempPath) {
            performOCR(imagePath: tempPath)
            try? fileManager.removeItem(atPath: tempPath)
        } else {
            // User cancelled via ESC (no file created)
            printOutput(OCRResult(text: "", confidence: 1.0)) // Return empty text cleanly
        }
    } catch {
        printError("Failed to launch screencapture: \(error.localizedDescription)")
    }

default:
    printError("Unknown command: \(command). \(buildInfo)")
    exit(1)
}
