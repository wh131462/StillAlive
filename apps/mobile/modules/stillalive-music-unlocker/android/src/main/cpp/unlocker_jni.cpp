#include <jni.h>
#include <string>

extern "C" int stillalive_unlock_file(
    const char* input_path,
    const char* output_path,
    const char* metadata_path);

extern "C" JNIEXPORT jint JNICALL
Java_com_eternalheart_stillalive_musicunlocker_StillAliveMusicUnlockerModule_unlockNative(
    JNIEnv* env,
    jobject,
    jstring input_path,
    jstring output_path,
    jstring metadata_path) {
  if (input_path == nullptr || output_path == nullptr || metadata_path == nullptr) return 1;

  const char* input = env->GetStringUTFChars(input_path, nullptr);
  const char* output = env->GetStringUTFChars(output_path, nullptr);
  const char* metadata = env->GetStringUTFChars(metadata_path, nullptr);
  if (input == nullptr || output == nullptr || metadata == nullptr) {
    if (input != nullptr) env->ReleaseStringUTFChars(input_path, input);
    if (output != nullptr) env->ReleaseStringUTFChars(output_path, output);
    if (metadata != nullptr) env->ReleaseStringUTFChars(metadata_path, metadata);
    return 1;
  }

  const int status = stillalive_unlock_file(input, output, metadata);
  env->ReleaseStringUTFChars(input_path, input);
  env->ReleaseStringUTFChars(output_path, output);
  env->ReleaseStringUTFChars(metadata_path, metadata);
  return status;
}
