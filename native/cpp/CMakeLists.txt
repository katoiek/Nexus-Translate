cmake_minimum_required(VERSION 3.10)
project(NexusTranslator)

set(CMAKE_CXX_STANDARD 17)

# Finds libraries installed via Homebrew or standard paths
# Static linking to avoid DLL hell
set(BUILD_SHARED_LIBS OFF CACHE BOOL "" FORCE)

# JSON
include(FetchContent)
FetchContent_Declare(
  json
  GIT_REPOSITORY https://github.com/nlohmann/json.git
  GIT_TAG        v3.11.2
)
FetchContent_MakeAvailable(json)

# Fetch SentencePiece
FetchContent_Declare(
  sentencepiece
  GIT_REPOSITORY https://github.com/google/sentencepiece.git
  GIT_TAG        v0.2.0
)

# Fetch CTranslate2
FetchContent_Declare(
  ctranslate2
  GIT_REPOSITORY https://github.com/OpenNMT/CTranslate2.git
  GIT_TAG        v4.4.0
)

# Backend selection
set(WITH_MKL OFF CACHE BOOL "" FORCE)
set(WITH_DNNL OFF CACHE BOOL "" FORCE)
set(WITH_CUDA OFF CACHE BOOL "" FORCE)
set(WITH_CUDNN OFF CACHE BOOL "" FORCE)
set(BUILD_CLI OFF CACHE BOOL "" FORCE)
set(BUILD_PYTHON_WRAPPER OFF CACHE BOOL "" FORCE)
set(BUILD_TESTS OFF CACHE BOOL "" FORCE)
set(OPENMP_RUNTIME "NONE" CACHE STRING "" FORCE)

if(APPLE)
  set(WITH_ACCELERATE ON CACHE BOOL "" FORCE)
  set(WITH_RUY OFF CACHE BOOL "" FORCE) # Accelerate is usually faster on Mac
elseif(WIN32)
   # On Windows, maybe use MKL or just generic
   # For simplicity/compatibility, RUY (ARM) or unoptimized might be default if MKL off.
   # CTranslate2 might warn, but functionality should be there.
   set(WITH_ACCELERATE OFF CACHE BOOL "" FORCE)
   set(WITH_RUY ON CACHE BOOL "" FORCE)
endif()


FetchContent_MakeAvailable(sentencepiece ctranslate2)

include_directories(include)

add_executable(translator main.cpp)

target_include_directories(translator PRIVATE
    ${sentencepiece_SOURCE_DIR}/src
)

target_link_libraries(translator
    PRIVATE
    nlohmann_json::nlohmann_json
    ctranslate2
    sentencepiece-static
)
