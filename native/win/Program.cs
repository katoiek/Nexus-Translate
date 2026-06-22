using System;
using System.IO;
using System.Linq;
using System.Text;
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
            // フロント(JS)はUTF-8でstdoutを復号するため、出力エンコーディングをUTF-8に固定する。
            // （The frontend decodes stdout as UTF-8, so force UTF-8 output here to avoid mojibake.）
            try { Console.OutputEncoding = Encoding.UTF8; } catch { }

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
                    // 任意: args[5] に言語ヒント (例 "ja", "en", "auto")
                    // / Optional: args[5] is a language hint (e.g. "ja", "en", "auto")
                    string captureHint = args.Length >= 6 ? args[5] : "auto";
                    await PerformCaptureAndOcrAsync(x, y, w, h, captureHint);
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

            string ocrHint = args.Length >= 2 ? args[1] : "auto";
            try
            {
                await PerformOcrAsync(imagePath, ocrHint);
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

        static async Task PerformCaptureAndOcrAsync(int x, int y, int width, int height, string langHint = "auto")
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

                    // UIボーダーやシャドウを避けるため、4隅から少し内側の8点をサンプリングして中央値で判定。
                    // 極端に小さい選択範囲でも GetPixel が範囲外にならないよう、座標は必ずクランプする。
                    // / Sample 8 inset points; always clamp coordinates so tiny selections never go
                    //   out of range (fixes "Parameter must be positive and < Width").
                    int maxX = width - 1;
                    int maxY = height - 1;
                    int margin = Math.Max(0, Math.Min(Math.Min(5, Math.Min(width, height) / 10), Math.Min(maxX, maxY)));
                    System.Func<int, int, System.Drawing.Color> sample = (sx, sy) =>
                        screenBitmap.GetPixel(
                            Math.Min(Math.Max(sx, 0), maxX),
                            Math.Min(Math.Max(sy, 0), maxY));
                    var samplePoints = new System.Drawing.Color[]
                    {
                        sample(margin, margin),
                        sample(maxX - margin, margin),
                        sample(margin, maxY - margin),
                        sample(maxX - margin, maxY - margin),
                        sample(width / 2, margin),
                        sample(width / 2, maxY - margin),
                        sample(margin, maxY / 2),
                        sample(maxX - margin, maxY / 2),
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

                            await ProcessSoftwareBitmapOcrAsync(softwareBitmap, langHint);
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                PrintJsonError($"Capture Error: {ex.Message}");
            }
        }

        static async Task PerformOcrAsync(string imagePath, string langHint = "auto")
        {
            try
            {
                StorageFile file = await StorageFile.GetFileFromPathAsync(Path.GetFullPath(imagePath));
                using IRandomAccessStream stream = await file.OpenAsync(FileAccessMode.Read);

                BitmapDecoder decoder = await BitmapDecoder.CreateAsync(stream);
                SoftwareBitmap softwareBitmap = await decoder.GetSoftwareBitmapAsync(BitmapPixelFormat.Bgra8, BitmapAlphaMode.Premultiplied);

                await ProcessSoftwareBitmapOcrAsync(softwareBitmap, langHint);
            }
            catch (Exception ex)
            {
                PrintJsonError($"OCR Processing Error: {ex.Message}");
            }
        }

        // 指定タグ(例 "ja","en")で始まる利用可能な認識言語のエンジンを生成
        // / Create an OCR engine for the first available recognizer whose tag starts with the prefix
        static OcrEngine CreateEngineForPrefix(string prefix)
        {
            var lang = OcrEngine.AvailableRecognizerLanguages
                .FirstOrDefault(l => l.LanguageTag.StartsWith(prefix, StringComparison.OrdinalIgnoreCase));
            return lang != null ? OcrEngine.TryCreateFromLanguage(lang) : null;
        }

        // 日本語(かな・漢字)の文字数 / Count Japanese (kana/kanji) characters
        static int CjkCount(string s)
        {
            if (string.IsNullOrEmpty(s)) return 0;
            return s.Count(ch =>
                (ch >= 0x4e00 && ch <= 0x9fff) ||   // CJK 漢字
                (ch >= 0x3040 && ch <= 0x309f) ||   // ひらがな
                (ch >= 0x30a0 && ch <= 0x30ff));    // カタカナ
        }

        // ラテン文字(a-zA-Z)の文字数 / Count Latin letters
        static int LatinCount(string s)
        {
            if (string.IsNullOrEmpty(s)) return 0;
            return s.Count(ch => (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z'));
        }

        static string RecognizedText(OcrResult result)
        {
            return string.Join("\n", result.Lines.Select(l => l.Text));
        }

        static async Task ProcessSoftwareBitmapOcrAsync(SoftwareBitmap softwareBitmap, string langHint = "auto")
        {
            // 1) 明示ヒントがあればそのエンジンを優先 / Explicit hint wins
            if (!string.IsNullOrEmpty(langHint) && !langHint.Equals("auto", StringComparison.OrdinalIgnoreCase))
            {
                var prefix = langHint.Length >= 2 ? langHint.Substring(0, 2) : langHint;
                var hinted = CreateEngineForPrefix(prefix) ?? OcrEngine.TryCreateFromUserProfileLanguages();
                if (hinted != null)
                {
                    OutputOcr(RecognizedText(await hinted.RecognizeAsync(softwareBitmap)));
                    return;
                }
            }

            // 2) 自動判定: 日本語エンジンと英語(ラテン)エンジンを両方実行し、
            //    日本語エンジン結果の「CJK比率 = CJK / (CJK + ラテン)」で判定する。
            //    - 比率が高い → 本当に日本語/混在 → 日本語エンジン採用（混在文も読めるため）
            //    - 比率が低い → 英語文を日本語エンジンが時々誤読(例: "If"→"げ")しただけ
            //      → ラテン文字をきれいに読む英語エンジン採用
            //    単純な「CJKが数文字あるか」では英語の誤読を拾ってしまうため比率で見る。
            // / Auto: run both engines and decide by the CJK ratio of the JP result.
            //   High ratio = genuinely Japanese/mixed -> JP engine; low ratio = just sporadic
            //   misreads of English (e.g. "If" -> "げ") -> English engine (clean Latin).
            var jpEngine = CreateEngineForPrefix("ja");
            var enEngine = CreateEngineForPrefix("en");

            string jpText = jpEngine != null ? RecognizedText(await jpEngine.RecognizeAsync(softwareBitmap)) : null;
            string enText = enEngine != null ? RecognizedText(await enEngine.RecognizeAsync(softwareBitmap)) : null;

            if (jpText != null && enText != null)
            {
                // 両エンジンの「得意文字の数」を直接比較する。
                //   jpNative = 日本語結果のCJK(かな・漢字)数
                //   enNative = 英語結果のラテン文字数
                // 英語文は明らかにラテン文字数が多く、日本語エンジンの散発的な誤読CJK
                // (例: 小さい "If" → "げ") を上回るため英語側が選ばれる。
                // 日本語/混在文はCJK数が多いため日本語側が選ばれる(同数は日本語優先=混在対応)。
                // / Compare each engine's native-script yield: JP-result CJK count vs
                //   EN-result Latin-letter count. English clearly has more Latin letters,
                //   so sporadic misreads can't flip it; ties favor Japanese (mixed text).
                int jpNative = CjkCount(jpText);
                int enNative = LatinCount(enText);
                OutputOcr(jpNative >= enNative ? jpText : enText);
                return;
            }

            // 3) フォールバック / Fallbacks
            if (jpText != null)
            {
                OutputOcr(jpText);
                return;
            }
            if (enText != null)
            {
                OutputOcr(enText);
                return;
            }

            var profileEngine = OcrEngine.TryCreateFromUserProfileLanguages();
            if (profileEngine != null)
            {
                OutputOcr(RecognizedText(await profileEngine.RecognizeAsync(softwareBitmap)));
                return;
            }

            PrintJsonError("OCR Engine not available. Please install a language pack (Japanese or English).");
        }

        static void OutputOcr(string fullText)
        {
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
