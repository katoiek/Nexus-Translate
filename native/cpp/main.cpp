#include <ctranslate2/translator.h>
#include <iostream>
#include <nlohmann/json.hpp>
#include <sentencepiece_processor.h>
#include <string>
#include <vector>

using json = nlohmann::json;

int main(int argc, char *argv[]) {
  if (argc < 2) {
    std::cerr << "Usage: " << argv[0] << " <model_path>" << std::endl;
    return 1;
  }

  std::string model_path = argv[1];

  try {
    // ① SentencePiece を起動時に1回だけロード（リクエストごとの再ロードバグを修正）
    std::string sp_model_path = model_path + "/sentencepiece.bpe.model";
    sentencepiece::SentencePieceProcessor processor;
    auto sp_status = processor.Load(sp_model_path);
    if (!sp_status.ok()) {
      // フォールバック: .bpe なしのモデルパスを試みる
      sp_model_path = model_path + "/sentencepiece.model";
      sp_status = processor.Load(sp_model_path);
      if (!sp_status.ok()) {
        std::cerr << "Could not load sentencepiece model: " << sp_status.ToString() << std::endl;
        return 1;
      }
    }
    std::cerr << "[INFO] SentencePiece loaded: " << sp_model_path << std::endl;

    // ② GPU 自動検出（CUDA ビルド時のみ有効）
    ctranslate2::Device device = ctranslate2::Device::CPU;
    ctranslate2::ComputeType compute_type = ctranslate2::ComputeType::DEFAULT;

#ifdef CT2_WITH_CUDA
    try {
      int gpu_count = ctranslate2::get_device_count(ctranslate2::Device::CUDA);
      if (gpu_count > 0) {
        device = ctranslate2::Device::CUDA;
        // GPU では float16 が最も高速（NLLB は float16 に対応）
        compute_type = ctranslate2::ComputeType::FLOAT16;
        std::cerr << "[INFO] CUDA GPU detected (" << gpu_count
                  << " device(s)): using GPU with float16" << std::endl;
      } else {
        std::cerr << "[INFO] No CUDA GPU found: falling back to CPU" << std::endl;
      }
    } catch (...) {
      std::cerr << "[INFO] CUDA detection failed: falling back to CPU" << std::endl;
    }
#else
    std::cerr << "[INFO] CPU-only build (CUDA not compiled in)" << std::endl;
#endif

    // ③ スレッド数: CPU 時は 4 スレッド、GPU 時は 1（GPU 側で並列化するため）
    ctranslate2::ReplicaPoolConfig config;
    config.num_threads_per_replica = (device == ctranslate2::Device::CPU) ? 4 : 1;

    ctranslate2::Translator translator(model_path, device, compute_type,
                                       {0},   // device_indices
                                       false, // tensor_parallel
                                       config);

    // 起動完了を通知
    std::cout << "{\"status\": \"ready\"}" << std::endl;

    // ④ リクエストループ（SentencePiece は processor を使い回す）
    std::string line;
    while (std::getline(std::cin, line)) {
      try {
        auto data = json::parse(line);
        std::string source_lang = data.value("source", "eng_Latn");
        std::string target_lang = data.value("target", "jpn_Jpan");

        std::vector<std::string> input_texts;
        if (data["text"].is_array()) {
          input_texts = data["text"].get<std::vector<std::string>>();
        } else {
          std::string t = data.value("text", "");
          if (!t.empty())
            input_texts.push_back(t);
        }

        if (input_texts.empty()) {
          std::cout << "{\"text\": \"\"}" << std::endl;
          continue;
        }

        // NLLB フォーマット: [source_lang] + tokens + [</s>] でトークン化
        std::vector<std::vector<std::string>> batch_tokens;
        batch_tokens.reserve(input_texts.size());

        for (const auto &txt : input_texts) {
          std::vector<std::string> sp_tokens;
          processor.Encode(txt, &sp_tokens);

          std::vector<std::string> source_tokens;
          source_tokens.reserve(sp_tokens.size() + 2);
          source_tokens.push_back(source_lang);
          source_tokens.insert(source_tokens.end(), sp_tokens.begin(), sp_tokens.end());
          source_tokens.push_back("</s>");

          batch_tokens.push_back(source_tokens);
        }

        // ターゲット言語プレフィックス
        std::vector<std::vector<std::string>> target_prefix;
        for (size_t i = 0; i < batch_tokens.size(); ++i) {
          target_prefix.push_back({target_lang});
        }

        ctranslate2::TranslationOptions options;
        options.beam_size = 4;
        options.repetition_penalty = 1.2f;
        options.max_decoding_length = 1024;

        auto results = translator.translate_batch(batch_tokens, target_prefix, options);

        // 結果を結合して返却
        std::string final_output;
        for (size_t i = 0; i < results.size(); ++i) {
          const auto &hypotheses = results[i].hypotheses[0];

          std::string translated_text;
          processor.Decode(hypotheses, &translated_text);

          if (i > 0)
            final_output += "\n";
          final_output += translated_text;
        }

        json response;
        response["text"] = final_output;
        std::cout << response.dump() << std::endl;

      } catch (const std::exception &e) {
        json error;
        error["error"] = e.what();
        std::cout << error.dump() << std::endl;
      }
    }
  } catch (const std::exception &e) {
    std::cerr << "Initialization Error: " << e.what() << std::endl;
    return 1;
  }

  return 0;
}
