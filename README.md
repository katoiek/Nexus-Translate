# Nexus Translate

Nexus Translate is a modern, privacy-focused desktop translation application built with Electron, React, and Vite. It offers a seamless translation experience similar to DeepL, with support for multiple translation engines including LLMs.

## Features

- **Multi-Engine Support**:
    - **Google Translate (Web)**: Fast and free translation using the web API.
    - **OpenAI (GPT-4o)**: High-accuracy translation using your own API key.
    - **Anthropic (Claude 3.5 Sonnet)**: Natural and nuanced translation.
    - **Google Gemini (Flash)**: High-speed and cost-effective translation.
- **Cross-Platform**:
    - **Windows**: Native background integration.
    - **macOS**: Native clipboard monitoring and OCR support using Vision Framework.
- **OCR (Optical Character Recognition)**: Quickly capture and translate text from your screen.
- **Clipboard Monitoring**: Automatically translates text when you copy it twice (configurable).
- **Global Shortcuts**: `Alt+Space` to trigger OCR capture.

## Important Note on Privacy & Internet Usage

### Google Translate (Web)
The default "Google Translate (Web)" engine uses the undocumented public API of Google Translate.
- **Internet Connection Required**: This engine **requires an active internet connection** to function.
- **Data Privacy**: Text translated using this engine is **sent to Google's servers**. Please do not use this engine for highly confidential information if you are concerned about data data transmission.

### LLM Engines (OpenAI, Anthropic, Gemini)
When using LLM engines, data is sent to the respective provider's API. Please refer to their data privacy policies regarding API usage (typically, API data is not trained on).

## Development

### Setup

```bash
npm install
```

### Run (Development Mode)

```bash
npm run dev
```

### Build

```bash
npm run build
```

This command will generate installers for your current platform in the `release/` directory.

## License

MIT
