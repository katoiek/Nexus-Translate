#include <ctranslate2/translator.h>
#include <iostream>
#include <nlohmann/json.hpp>
#include <sentencepiece_processor.h>
#include <string>
#include <vector>

using json = nlohmann::json;

// Helper to map language codes if needed, or just pass through
std::string map_language(const std::string &lang) {
  if (lang == "en")
    return "eng_Latn";
  if (lang == "ja")
    return "jpn_Jpan";
  // Add more mappings as needed
  return lang;
}

int main(int argc, char *argv[]) {
  if (argc < 2) {
    std::cerr << "Usage: " << argv[0] << " <model_path>" << std::endl;
    return 1;
  }

  std::string model_path = argv[1];

  try {
    // Initialize Translator
    // Use CPU for broad compatibility
    ctranslate2::Translator translator(model_path, ctranslate2::Device::CPU);

    // Signal readiness
    std::cout << "{\"status\": \"ready\"}" << std::endl;

    std::string line;
    while (std::getline(std::cin, line)) {
      try {
        auto data = json::parse(line);
        std::string text = data.value("text", "");
        std::string source_lang = data.value("source", "eng_Latn");
        std::string target_lang = data.value("target", "jpn_Jpan");

        if (text.empty()) {
          std::cout << "{\"text\": \"\"}" << std::endl;
          continue;
        }

        // CTranslate2 expects tokenized input.
        // Using SentencePiece for tokenization.
        // Assuming model directory contains 'sentencepiece.bpe.model'

        std::string sp_model_path = model_path + "/sentencepiece.bpe.model";
        sentencepiece::SentencePieceProcessor processor;
        const auto status = processor.Load(sp_model_path);
        if (!status.ok()) {
          std::cerr << "Failed to load SentencePiece model: "
                    << status.ToString() << std::endl;
          // Try fallback name
          sp_model_path = model_path + "/sentencepiece.model";
          if (!processor.Load(sp_model_path).ok()) {
            // For MVP, if SP fails, maybe fallback or throw
            throw std::runtime_error("Could not load sentencepiece model");
          }
        }

        std::vector<std::string> sp_tokens;
        processor.Encode(text, &sp_tokens);

        std::vector<std::string> source_tokens;
        // NLLB requires: [source_lang] + tokens + [</s>]
        source_tokens.reserve(sp_tokens.size() + 2);
        source_tokens.push_back(source_lang);
        source_tokens.insert(source_tokens.end(), sp_tokens.begin(),
                             sp_tokens.end());
        source_tokens.push_back("</s>");

        std::vector<std::vector<std::string>> batch = {source_tokens};
        std::vector<std::vector<std::string>> target_prefix = {{target_lang}};

        ctranslate2::TranslationOptions options;
        options.beam_size = 1;
        options.repetition_penalty = 1.2;
        options.max_decoding_length = 1024;

        auto results =
            translator.translate_batch(batch, target_prefix, options);

        const auto &result = results[0];
        const auto &hypotheses = result.hypotheses[0];

        // Detokenize
        std::string translated_text;
        processor.Decode(hypotheses, &translated_text);

        json response;
        response["text"] = translated_text;
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
