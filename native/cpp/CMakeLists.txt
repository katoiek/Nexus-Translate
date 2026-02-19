cmake_minimum_required(VERSION 3.15)
if(POLICY CMP0000)
  cmake_policy(SET CMP0000 NEW)
endif()
if(POLICY CMP0126)
  cmake_policy(SET CMP0126 NEW)
endif()
project(NexusTranslator)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_MSVC_RUNTIME_LIBRARY "MultiThreaded$<$<CONFIG:Debug>:Debug>")

# Backend selection (Set BEFORE dependencies)
set(BUILD_SHARED_LIBS OFF CACHE BOOL "" FORCE)
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
  set(WITH_RUY OFF CACHE BOOL "" FORCE)
elseif(WIN32)
   set(WITH_ACCELERATE OFF CACHE BOOL "" FORCE)
   set(WITH_RUY ON CACHE BOOL "" FORCE)
endif()

include(FetchContent)

# JSON
FetchContent_Declare(
  json
  GIT_REPOSITORY https://github.com/nlohmann/json.git
  GIT_TAG        v3.11.3
)
FetchContent_GetProperties(json)
if(NOT json_POPULATED)
  FetchContent_Populate(json)
  file(READ "${json_SOURCE_DIR}/CMakeLists.txt" JSON_CMAKELISTS)
  string(REPLACE "cmake_minimum_required(VERSION 3.1...3.14)" "cmake_minimum_required(VERSION 3.15)" JSON_CMAKELISTS "${JSON_CMAKELISTS}")
  file(WRITE "${json_SOURCE_DIR}/CMakeLists.txt" "${JSON_CMAKELISTS}")
  add_subdirectory(${json_SOURCE_DIR} ${json_BINARY_DIR})
endif()

# Fetch SentencePiece
FetchContent_Declare(
  sentencepiece
  GIT_REPOSITORY https://github.com/google/sentencepiece.git
  GIT_TAG        v0.2.0
)
FetchContent_GetProperties(sentencepiece)
if(NOT sentencepiece_POPULATED)
  FetchContent_Populate(sentencepiece)
  file(READ "${sentencepiece_SOURCE_DIR}/CMakeLists.txt" SP_CMAKELISTS)
  string(REPLACE "cmake_minimum_required(VERSION 3.1 FATAL_ERROR)" "cmake_minimum_required(VERSION 3.15)" SP_CMAKELISTS "${SP_CMAKELISTS}")
  file(WRITE "${sentencepiece_SOURCE_DIR}/CMakeLists.txt" "${SP_CMAKELISTS}")
  add_subdirectory(${sentencepiece_SOURCE_DIR} ${sentencepiece_BINARY_DIR})
endif()

# Fetch CTranslate2
FetchContent_Declare(
  ctranslate2
  GIT_REPOSITORY https://github.com/OpenNMT/CTranslate2.git
  GIT_TAG        v4.5.0
)
FetchContent_GetProperties(ctranslate2)
if(NOT ctranslate2_POPULATED)
  FetchContent_Populate(ctranslate2)
  file(READ "${ctranslate2_SOURCE_DIR}/CMakeLists.txt" CT2_CMAKELISTS)
  string(REPLACE "cmake_minimum_required(VERSION 3.7)" "cmake_minimum_required(VERSION 3.15)" CT2_CMAKELISTS "${CT2_CMAKELISTS}")
  file(WRITE "${ctranslate2_SOURCE_DIR}/CMakeLists.txt" "${CT2_CMAKELISTS}")
  add_subdirectory(${ctranslate2_SOURCE_DIR} ${ctranslate2_BINARY_DIR})
endif()

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
