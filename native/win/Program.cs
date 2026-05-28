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

        [System.Runtime.InteropServices.DllImport("user32.dll")]
        private static extern bool SetProcessDPIAware();

        [System.Runtime.InteropServices.DllImport("user32.dll")]
        private static extern bool SetProcessDpiAwarenessContext(int dpiFlag);

        [System.Runtime.InteropServices.DllImport("user32.dll")]
        private static extern int GetSystemMetrics(int nIndex);

        private const int SM_XVIRTUALSCREEN = 76;
        private const int SM_YVIRTUALSCREEN = 77;
        private const int SM_CXVIRTUALSCREEN = 78;
        private const int SM_CYVIRTUALSCREEN = 79;
        private const int CapturePaddingPx = 16;

        static async Task Main(string[] args)
        {
            try { SetProcessDpiAwarenessContext(-4); } catch { try { SetProcessDPIAware(); } catch {} }
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
                catch
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

                // 文字の端が選択範囲ぎりぎりにあると最終文字が欠けるため、
                // 仮想スクリーン範囲内で少しだけ外側も含めてキャプチャする。
                int virtualX = GetSystemMetrics(SM_XVIRTUALSCREEN);
                int virtualY = GetSystemMetrics(SM_YVIRTUALSCREEN);
                int virtualRight = virtualX + GetSystemMetrics(SM_CXVIRTUALSCREEN);
                int virtualBottom = virtualY + GetSystemMetrics(SM_CYVIRTUALSCREEN);

                int captureX = Math.Max(virtualX, x - CapturePaddingPx);
                int captureY = Math.Max(virtualY, y - CapturePaddingPx);
                int captureRight = Math.Min(virtualRight, x + width + CapturePaddingPx);
                int captureBottom = Math.Min(virtualBottom, y + height + CapturePaddingPx);

                x = captureX;
                y = captureY;
                width = Math.Max(1, captureRight - captureX);
                height = Math.Max(1, captureBottom - captureY);

                // Create initial capture bitmap
                using (var screenBitmap = new System.Drawing.Bitmap(width, height))
                {
                    using (var g = System.Drawing.Graphics.FromImage(screenBitmap))
                    {
                        g.CopyFromScreen(x, y, 0, 0, new System.Drawing.Size(width, height));
                    }

                    // Preprocessing Strategy:
                    // 1. Detect background color from the 4 corners of the capture.
                    // 2. Fill the entire canvas (padding) with this background color to avoid artificial borders.
                    // 3. Upscale the image aggressively for small selections.
                    // 4. Invert the final result if the background is dark to ensure Black-on-White text.

                    // UIボーダーやシャドウを避けるため、4隅から少し内側の8点をサンプリングして中央値で判定
                    int margin = Math.Max(2, Math.Min(5, Math.Min(width, height) / 10));
                    var samplePoints = new System.Drawing.Color[]
                    {
                        screenBitmap.GetPixel(margin, margin),
                        screenBitmap.GetPixel(width - 1 - margin, margin),
                        screenBitmap.GetPixel(margin, height - 1 - margin),
                        screenBitmap.GetPixel(width - 1 - margin, height - 1 - margin),
                        screenBitmap.GetPixel(width / 2, margin),
                        screenBitmap.GetPixel(width / 2, height - 1 - margin),
                        screenBitmap.GetPixel(margin, height / 2),
                        screenBitmap.GetPixel(width - 1 - margin, height / 2),
                    };
                    // 明度の中央値で背景の明暗を判定（外れ値に強い）
                    var sortedBrightnesses = samplePoints.Select(c => c.GetBrightness()).OrderBy(b => b).ToArray();
                    float bgBrightness = (sortedBrightnesses[3] + sortedBrightnesses[4]) / 2.0f;
                    bool shouldInvert = bgBrightness < 0.5f;
                    // キャンバス背景色は8点の平均色を使用
                    int avgR = (int)samplePoints.Average(c => (double)c.R);
                    int avgG = (int)samplePoints.Average(c => (double)c.G);
                    int avgB = (int)samplePoints.Average(c => (double)c.B);
                    var bgColor = System.Drawing.Color.FromArgb(avgR, avgG, avgB);

                    // アップスケール処理: OCR推奨の300dpi相当を目標サイズとして設定
                    float minTargetSize = 300.0f;
                    float scale = 1.0f;
                    if (width < minTargetSize || height < minTargetSize)
                    {
                        float scaleW = minTargetSize / width;
                        float scaleH = minTargetSize / height;
                        scale = Math.Min(8.0f, Math.Max(scaleW, scaleH));
                    }

                    int scaledWidth = (int)(width * scale);
                    int scaledHeight = (int)(height * scale);

                    int canvasWidth = Math.Max(200, scaledWidth + 60);
                    int canvasHeight = Math.Max(200, scaledHeight + 60);

                    using (var finalBitmap = new System.Drawing.Bitmap(canvasWidth, canvasHeight))
                    {
                        using (var g = System.Drawing.Graphics.FromImage(finalBitmap))
                        {
                            // Fill canvas with the SAME background color as the capture
                            g.Clear(bgColor);

                            // 日本語OCRでは NearestNeighbor のギザギザが誤認識を増やすため、
                            // 拡大時もアンチエイリアスを保つ高品質補間を使う。
                            g.InterpolationMode = System.Drawing.Drawing2D.InterpolationMode.HighQualityBicubic;
                            g.PixelOffsetMode = System.Drawing.Drawing2D.PixelOffsetMode.HighQuality;
                            g.SmoothingMode = System.Drawing.Drawing2D.SmoothingMode.HighQuality;
                            g.CompositingQuality = System.Drawing.Drawing2D.CompositingQuality.HighQuality;

                            int offsetX = (canvasWidth - scaledWidth) / 2;
                            int offsetY = (canvasHeight - scaledHeight) / 2;

                            if (shouldInvert)
                            {
                                // Invert the screenBitmap DURING draw to avoid self-drawing finalBitmap
                                var matrix = new System.Drawing.Imaging.ColorMatrix(new float[][]
                                {
                                    new float[] {-1, 0, 0, 0, 0},
                                    new float[] {0, -1, 0, 0, 0},
                                    new float[] {0, 0, -1, 0, 0},
                                    new float[] {0, 0, 0, 1, 0},
                                    new float[] {1, 1, 1, 0, 1}
                                });
                                var attributes = new System.Drawing.Imaging.ImageAttributes();
                                attributes.SetColorMatrix(matrix);
                                
                                g.DrawImage(screenBitmap, 
                                    new System.Drawing.Rectangle(offsetX, offsetY, scaledWidth, scaledHeight), 
                                    0, 0, width, height, 
                                    System.Drawing.GraphicsUnit.Pixel, attributes);
                            }
                            else
                            {
                                g.DrawImage(screenBitmap, new System.Drawing.Rectangle(offsetX, offsetY, scaledWidth, scaledHeight));
                            }
                        }

                        // Convert System.Drawing.Bitmap to SoftwareBitmap (Bgra8)
                        using (var stream = new InMemoryRandomAccessStream())
                        {
                            using (var ms = new MemoryStream())
                            {
                                finalBitmap.Save(ms, System.Drawing.Imaging.ImageFormat.Png);
                                ms.Position = 0;

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
