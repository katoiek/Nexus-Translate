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
    ctranslate2::ReplicaPoolConfig config;
    config.num_threads_per_replica = 4; // threads per translation

    ctranslate2::Translator translator(model_path, ctranslate2::Device::CPU,
                                       ctranslate2::ComputeType::DEFAULT,
                                       {0},   // device_indices
                                       false, // tensor_parallel
                                       config);

    // Signal readiness
    std::cout << "{\"status\": \"ready\"}" << std::endl;

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

        // CTranslate2 expects tokenized input.
        // Using SentencePiece for tokenization.
        std::string sp_model_path = model_path + "/sentencepiece.bpe.model";
        sentencepiece::SentencePieceProcessor processor;
        const auto status = processor.Load(sp_model_path);
        if (!status.ok()) {
          // Try fallback
          sp_model_path = model_path + "/sentencepiece.model";
          if (!processor.Load(sp_model_path).ok()) {
            throw std::runtime_error("Could not load sentencepiece model: " +
                                     status.ToString());
          }
        }

        std::vector<std::vector<std::string>> batch_tokens;
        batch_tokens.reserve(input_texts.size());

        for (const auto &txt : input_texts) {
          std::vector<std::string> sp_tokens;
          processor.Encode(txt, &sp_tokens);

          std::vector<std::string> source_tokens;
          // NLLB requires: [source_lang] + tokens + [</s>]
          source_tokens.reserve(sp_tokens.size() + 2);
          source_tokens.push_back(source_lang);
          source_tokens.insert(source_tokens.end(), sp_tokens.begin(),
                               sp_tokens.end());
          source_tokens.push_back("</s>");

          batch_tokens.push_back(source_tokens);
        }

        std::vector<std::vector<std::string>> target_prefix;
        for (size_t i = 0; i < batch_tokens.size(); ++i) {
          target_prefix.push_back({target_lang});
        }

        ctranslate2::TranslationOptions options;
        options.beam_size = 4; // Beam search for better quality
        options.repetition_penalty = 1.2;
        options.max_decoding_length = 1024;

        // Perform batch translation
        auto results =
            translator.translate_batch(batch_tokens, target_prefix, options);

        std::string final_output;
        for (size_t i = 0; i < results.size(); ++i) {
          const auto &result = results[i];
          const auto &hypotheses = result.hypotheses[0];

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
