cmake_minimum_required(VERSION 3.10)
project(NexusTranslator)

set(CMAKE_CXX_STANDARD 17)

# Finds libraries installed via Homebrew or standard paths
find_package(nlohmann_json REQUIRED)

include(FetchContent)

# Fetch SentencePiece
FetchContent_Declare(
  sentencepiece
  GIT_REPOSITORY https://github.com/google/sentencepiece.git
  GIT_TAG        v0.2.0
)
# FetchContent_MakeAvailable(sentencepiece) # This might fail if hierarchical add_subdirectory is not supported perfectly, but trying standard way

# Fetch CTranslate2
FetchContent_Declare(
  ctranslate2
  GIT_REPOSITORY https://github.com/OpenNMT/CTranslate2.git
  GIT_TAG        v4.4.0
)
set(WITH_MKL OFF CACHE BOOL "" FORCE)
set(WITH_DNNL OFF CACHE BOOL "" FORCE)
set(WITH_ACCELERATE ON CACHE BOOL "" FORCE)
set(WITH_RUY ON CACHE BOOL "" FORCE)
set(WITH_CUDA OFF CACHE BOOL "" FORCE)
set(WITH_CUDNN OFF CACHE BOOL "" FORCE)
set(BUILD_CLI OFF CACHE BOOL "" FORCE)
set(BUILD_PYTHON_WRAPPER OFF CACHE BOOL "" FORCE)
set(BUILD_TESTS OFF CACHE BOOL "" FORCE)
# CTranslate2 uses OPENMP_RUNTIME, not WITH_OPENMP
set(OPENMP_RUNTIME "NONE" CACHE STRING "" FORCE)

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
    sentencepiece
)
