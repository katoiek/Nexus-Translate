using System;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using Windows.Graphics.Imaging;
using Windows.Media.Ocr;
using Windows.Storage;
using Windows.Storage.Streams;

namespace NexusNative
{
    public class OcrResponse
    {
        public string text { get; set; } = "";
        public float confidence { get; set; } = 0.0f;
    }

    class Program
    {
        [System.Runtime.InteropServices.DllImport("user32.dll")]
        private static extern uint GetClipboardSequenceNumber();

        static async Task Main(string[] args)
        {
            if (args.Length < 1)
            {
                // PrintJsonError("Usage: NexusNative.exe <image_path> OR NexusNative.exe watch-clipboard");
                // Fallback for dev testing if no args
                // PrintJsonError("No arguments provided");
                return;
            }

            string command = args[0];

            if (command == "watch-clipboard")
            {
                RunClipboardWatcher();
                return;
            }

            if (command == "capture")
            {
                if (args.Length < 5)
                {
                    PrintJsonError("Usage: capture <x> <y> <width> <height>");
                    return;
                }

                if (int.TryParse(args[1], out int x) &&
                    int.TryParse(args[2], out int y) &&
                    int.TryParse(args[3], out int w) &&
                    int.TryParse(args[4], out int h))
                {
                    await PerformCaptureAndOcrAsync(x, y, w, h);
                }
                else
                {
                    PrintJsonError("Invalid coordinates");
                }
                return;
            }

            string imagePath = command;
            if (!File.Exists(imagePath))
            {
                PrintJsonError($"File not found: {imagePath}");
                return;
            }

            try
            {
                await PerformOcrAsync(imagePath);
            }
            catch (Exception ex)
            {
                PrintJsonError($"An error occurred: {ex.Message}");
            }
        }

        static void RunClipboardWatcher()
        {
            uint lastSequence = 0;
            // Initial read
            try {
                lastSequence = GetClipboardSequenceNumber();
            } catch { }

            Console.WriteLine($"{{\"type\":\"init\", \"sequence\":{lastSequence}}}");

            while (true)
            {
                try
                {
                    uint currentSequence = GetClipboardSequenceNumber();
                    if (currentSequence != lastSequence)
                    {
                        lastSequence = currentSequence;
                        Console.WriteLine($"{{\"type\":\"change\", \"sequence\":{currentSequence}}}");
                    }
                }
                catch (Exception ex)
                {
                    // Ignore transient errors in watcher loop
                }

                // Poll every 100ms
                System.Threading.Thread.Sleep(100);
            }
        }

        static async Task PerformCaptureAndOcrAsync(int x, int y, int width, int height)
        {
            try
            {
                // Validate dimensions
                if (width <= 0 || height <= 0)
                {
                    PrintJsonError("Invalid capture dimensions");
                    return;
                }

                using (var bitmap = new System.Drawing.Bitmap(width, height))
                {
                    using (var g = System.Drawing.Graphics.FromImage(bitmap))
                    {
                        g.CopyFromScreen(x, y, 0, 0, new System.Drawing.Size(width, height));
                    }

                    // Convert System.Drawing.Bitmap to SoftwareBitmap (Bgra8)
                    // We need a temporary memory stream or direct byte access
                    using (var stream = new InMemoryRandomAccessStream())
                    {
                        // Save to memory stream as PNG (lossless)
                        using (var ms = new MemoryStream())
                        {
                            bitmap.Save(ms, System.Drawing.Imaging.ImageFormat.Png);
                            ms.Position = 0;

                            // Copy to IRandomAccessStream
                            var writer = new DataWriter(stream.GetOutputStreamAt(0));
                            writer.WriteBytes(ms.ToArray());
                            await writer.StoreAsync();
                        }

                        BitmapDecoder decoder = await BitmapDecoder.CreateAsync(stream);
                        SoftwareBitmap softwareBitmap = await decoder.GetSoftwareBitmapAsync(BitmapPixelFormat.Bgra8, BitmapAlphaMode.Premultiplied);

                        await ProcessSoftwareBitmapOcrAsync(softwareBitmap);
                    }
                }
            }
            catch (Exception ex)
            {
                PrintJsonError($"Capture Error: {ex.Message}");
            }
        }

        static async Task PerformOcrAsync(string imagePath)
        {
            try
            {
                StorageFile file = await StorageFile.GetFileFromPathAsync(Path.GetFullPath(imagePath));
                using IRandomAccessStream stream = await file.OpenAsync(FileAccessMode.Read);

                BitmapDecoder decoder = await BitmapDecoder.CreateAsync(stream);
                SoftwareBitmap softwareBitmap = await decoder.GetSoftwareBitmapAsync(BitmapPixelFormat.Bgra8, BitmapAlphaMode.Premultiplied);

                await ProcessSoftwareBitmapOcrAsync(softwareBitmap);
            }
            catch (Exception ex)
            {
                PrintJsonError($"OCR Processing Error: {ex.Message}");
            }
        }

        static async Task ProcessSoftwareBitmapOcrAsync(SoftwareBitmap softwareBitmap)
        {
             // Try to use Japanese language if available
            var lang = OcrEngine.AvailableRecognizerLanguages.FirstOrDefault(l => l.LanguageTag.StartsWith("ja", StringComparison.OrdinalIgnoreCase));
            OcrEngine ocrEngine = lang != null ? OcrEngine.TryCreateFromLanguage(lang) : OcrEngine.TryCreateFromUserProfileLanguages();

            if (ocrEngine == null)
            {
                PrintJsonError("OCR Engine not available. Please install Japanese Language Pack.");
                return;
            }

            var ocrResult = await ocrEngine.RecognizeAsync(softwareBitmap);

            // Combine lines
            var lines = ocrResult.Lines.Select(l => l.Text);
            string fullText = string.Join("\n", lines);

            var response = new OcrResponse
            {
                text = fullText,
                confidence = 1.0f
            };

            string json = JsonSerializer.Serialize(response, AppJsonSerializerContext.Default.OcrResponse);
            Console.WriteLine(json);
        }

        static void PrintJsonError(string message)
        {
            var response = new OcrResponse
            {
                text = $"ERROR: {message}",
                confidence = 0.0f
            };
            string json = JsonSerializer.Serialize(response, AppJsonSerializerContext.Default.OcrResponse);
            Console.WriteLine(json);
        }
    }

    [System.Text.Json.Serialization.JsonSerializable(typeof(OcrResponse))]
    internal partial class AppJsonSerializerContext : System.Text.Json.Serialization.JsonSerializerContext
    {
    }
}
