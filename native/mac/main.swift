import Foundation
import Vision
import Cocoa

// Define the output structure
struct OCRResult: Codable {
    let text: String
    let confidence: Float
}

// Function to perform OCR
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
        
        // Output JSON
        let result = OCRResult(text: fullText, confidence: 1.0) // Simply 1.0 for now
        if let jsonData = try? JSONEncoder().encode(result),
           let jsonString = String(data: jsonData, encoding: .utf8) {
            print(jsonString)
        } else {
            printError("Failed to encode JSON")
        }
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

func printError(_ message: String) {
    let errorResult = OCRResult(text: "ERROR: \(message)", confidence: 0.0)
    if let jsonData = try? JSONEncoder().encode(errorResult),
       let jsonString = String(data: jsonData, encoding: .utf8) {
        print(jsonString)
    }
}

// Main entry point
let args = CommandLine.arguments
if args.count < 2 {
    printError("Usage: main <image_path>")
    exit(1)
}

let imagePath = args[1]
performOCR(imagePath: imagePath)
